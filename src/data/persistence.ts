import type { ZoomPreset } from '@/features/timeline/scale'
import { migrations, runMigrations, type Migration } from './migrations'
import { appDataSchema, createEmptyData, CURRENT_SCHEMA_VERSION, type AppData } from './schema'
import { useStore } from './store'

export const DATA_KEY = 'personal-os:data'
export const UI_KEY = 'personal-os:ui'
export const backupKey = (version: number) => `personal-os:data:backup-v${version}`

export const SAVE_DEBOUNCE_MS = 300

export type LoadResult =
  | { status: 'empty' }
  | { status: 'ok'; data: AppData }
  | { status: 'corrupt'; raw: string; reason: string }

export type SaveError = 'quota' | 'unavailable'
export type SaveResult = { ok: true } | { ok: false; reason: SaveError }

type ParseResult = { ok: true; data: AppData; from: number } | { ok: false; reason: string }

function parseStored(raw: string, registry: Record<number, Migration>): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, reason: '不是有效的 JSON' }
  }
  try {
    const migrated = runMigrations(json, registry, CURRENT_SCHEMA_VERSION)
    const parsed = appDataSchema.safeParse(migrated.data)
    if (!parsed.success) return { ok: false, reason: '数据结构校验失败' }
    return { ok: true, data: parsed.data, from: migrated.from }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '无法识别的数据' }
  }
}

/** 读取并在需要时升级。任何失败都不改动已存的内容。 */
export function loadData(
  storage: Storage,
  registry: Record<number, Migration> = migrations,
): LoadResult {
  let raw: string | null
  try {
    raw = storage.getItem(DATA_KEY)
  } catch {
    return { status: 'empty' }
  }
  if (raw === null) return { status: 'empty' }

  const parsed = parseStored(raw, registry)
  if (!parsed.ok) return { status: 'corrupt', raw, reason: parsed.reason }

  if (parsed.from < CURRENT_SCHEMA_VERSION) {
    try {
      storage.setItem(backupKey(parsed.from), raw)
    } catch {
      return { status: 'corrupt', raw, reason: '升级前无法写入备份' }
    }
    saveData(storage, parsed.data)
  }
  return { status: 'ok', data: parsed.data }
}

export function saveData(storage: Storage, data: AppData): SaveResult {
  try {
    storage.setItem(DATA_KEY, JSON.stringify(data))
    return { ok: true }
  } catch (error) {
    const quota =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return { ok: false, reason: quota ? 'quota' : 'unavailable' }
  }
}

export interface UiPrefs {
  zoomPreset: ZoomPreset | 'custom'
  /** 仅在 zoomPreset 为 'custom' 时有意义 */
  pxPerDay: number | null
  /** 第一次使用的时间，用于备份提醒 */
  firstUsedAt: string
}

const ZOOM_VALUES = ['quarter', 'year', 'all', 'custom']

export function loadUiPrefs(storage: Storage, now: Date): UiPrefs {
  const defaults: UiPrefs = { zoomPreset: 'year', pxPerDay: null, firstUsedAt: now.toISOString() }
  try {
    const raw = storage.getItem(UI_KEY)
    if (raw !== null) {
      const stored = JSON.parse(raw) as Partial<UiPrefs> | null
      if (stored && typeof stored === 'object' && typeof stored.firstUsedAt === 'string') {
        return {
          zoomPreset: ZOOM_VALUES.includes(stored.zoomPreset as string)
            ? (stored.zoomPreset as UiPrefs['zoomPreset'])
            : defaults.zoomPreset,
          pxPerDay: typeof stored.pxPerDay === 'number' ? stored.pxPerDay : null,
          firstUsedAt: stored.firstUsedAt,
        }
      }
    }
  } catch {
    // 读不出来就用默认值
  }
  saveUiPrefs(storage, defaults)
  return defaults
}

export function saveUiPrefs(storage: Storage, prefs: UiPrefs): void {
  try {
    storage.setItem(UI_KEY, JSON.stringify(prefs))
  } catch {
    // 界面偏好丢了不要紧
  }
}

export interface Persistence {
  status: LoadResult
  saveError: () => SaveError | null
  /** saveError 变化时通知 */
  subscribe: (listener: () => void) => () => void
  /** 已存数据损坏时，用一份有效数据（导入的备份）覆盖并恢复自动保存 */
  recover: (data: AppData) => void
  stop: () => void
}

/**
 * 启动时读取数据放进状态，之后负责自动保存和跨标签页同步。
 * 已存数据损坏时不订阅保存，保证原数据不被覆盖；直到调用 recover。
 */
export function startPersistence(
  storage: Storage,
  win: Window,
  registry: Record<number, Migration> = migrations,
): Persistence {
  const status = loadData(storage, registry)
  const listeners = new Set<() => void>()
  let saveError: SaveError | null = null
  let detach: (() => void) | null = null

  const setSaveError = (next: SaveError | null) => {
    if (next === saveError) return
    saveError = next
    listeners.forEach((listener) => listener())
  }

  /** 把数据放进状态并开始自动保存。alreadySaved 为 false 时立即写一次。 */
  const attach = (initial: AppData, alreadySaved: boolean) => {
    detach?.()
    useStore.getState().hydrate(initial)

    let saved: AppData | null = alreadySaved ? useStore.getState().data : null
    let timer: ReturnType<typeof setTimeout> | null = null

    const cancelTimer = () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
    }
    const flush = () => {
      cancelTimer()
      const { data } = useStore.getState()
      if (data === saved) return
      const result = saveData(storage, data)
      if (result.ok) saved = data
      setSaveError(result.ok ? null : result.reason)
    }

    const unsubscribe = useStore.subscribe((state) => {
      if (state.data === saved) return
      cancelTimer()
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS)
    })

    const onPageHide = () => flush()
    const onVisibility = () => {
      if (win.document.visibilityState === 'hidden') flush()
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key !== DATA_KEY || event.newValue === null) return
      const parsed = parseStored(event.newValue, registry)
      if (!parsed.ok || parsed.from !== CURRENT_SCHEMA_VERSION) return
      // 另一个标签页刚保存过：采用它的数据，并丢弃这边还没写出去的旧数据
      cancelTimer()
      useStore.getState().hydrate(parsed.data)
      saved = useStore.getState().data
      cancelTimer()
    }

    win.addEventListener('pagehide', onPageHide)
    win.document.addEventListener('visibilitychange', onVisibility)
    win.addEventListener('storage', onStorage)

    detach = () => {
      cancelTimer()
      unsubscribe()
      win.removeEventListener('pagehide', onPageHide)
      win.document.removeEventListener('visibilitychange', onVisibility)
      win.removeEventListener('storage', onStorage)
    }

    if (!alreadySaved) flush()
  }

  if (status.status !== 'corrupt') {
    attach(status.status === 'ok' ? status.data : createEmptyData(), true)
  }

  return {
    status,
    saveError: () => saveError,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    recover: (data) => attach(data, false),
    stop: () => {
      detach?.()
      detach = null
    },
  }
}

/** 取 localStorage；被浏览器禁用时返回一个写入必然失败的替身，让界面能给出警告。 */
export function getStorage(source: { readonly localStorage: Storage }): Storage {
  try {
    return source.localStorage
  } catch {
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {
        throw new DOMException('storage unavailable', 'SecurityError')
      },
    }
  }
}
