import { z } from 'zod'
import { create } from 'zustand'
import { useStore } from '@/data/store'
import {
  advance,
  BREAK_MINUTES,
  clampMinutes,
  FOCUS_MINUTES,
  finishSession,
  nextRound,
  pauseRun,
  resumeRun,
  startRun,
  type FocusMode,
  type RunState,
  type StartConfig,
  type TimerEvent,
} from './timer'

/** 正在计时的状态。只对这个浏览器、此刻有意义，所以不进规划数据和导出的备份。 */
export const RUN_KEY = 'personal-os:focus-run'
export const PREFS_KEY = 'personal-os:focus-prefs'

export interface FocusPrefs {
  /** 系统通知 */
  notify: boolean
  /** 提示音 */
  sound: boolean
  /** 上次开始时用的设置，首页组件一键照着开始 */
  last: { mode: FocusMode; focusMin: number; breakMin: number; tag: string }
}

export const DEFAULT_PREFS: FocusPrefs = {
  notify: true,
  sound: true,
  last: { mode: 'pomodoro', focusMin: 25, breakMin: 5, tag: '' },
}

const runSchema = z.object({
  mode: z.enum(['pomodoro', 'stopwatch']),
  phase: z.enum(['focus', 'break', 'ready']),
  tag: z.string(),
  note: z.string(),
  focusMs: z.number().finite().min(0),
  breakMs: z.number().finite().min(0),
  startedAt: z.number().finite(),
  pausedAt: z.number().finite().nullable(),
  pausedMs: z.number().finite().min(0),
})

const prefsSchema = z.object({
  notify: z.boolean().catch(DEFAULT_PREFS.notify),
  sound: z.boolean().catch(DEFAULT_PREFS.sound),
  last: z
    .object({
      mode: z.enum(['pomodoro', 'stopwatch']),
      focusMin: z.number().transform((v) => clampMinutes(v, FOCUS_MINUTES)),
      breakMin: z.number().transform((v) => clampMinutes(v, BREAK_MINUTES)),
      tag: z.string(),
    })
    .catch(DEFAULT_PREFS.last),
})

function read(storage: Storage, key: string): unknown {
  try {
    const raw = storage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: unknown): void {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, JSON.stringify(value))
  } catch {
    // 存不下就算了：这一轮还在内存里继续走，只是刷新后不能恢复
  }
}

/** 读出计时状态；没有、读不出来或内容不对都当作没有在计时。 */
export function loadRun(storage: Storage): RunState | null {
  const parsed = runSchema.safeParse(read(storage, RUN_KEY))
  return parsed.success ? parsed.data : null
}

export function loadPrefs(storage: Storage): FocusPrefs {
  const parsed = prefsSchema.safeParse(read(storage, PREFS_KEY) ?? {})
  return parsed.success ? parsed.data : DEFAULT_PREFS
}

function browserStorage(): Storage {
  try {
    return window.localStorage
  } catch {
    return {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => {},
    }
  }
}

/** short：不足 1 分钟，没有保存 */
export type FinishResult = 'saved' | 'short' | 'none'

interface FocusState {
  run: RunState | null
  prefs: FocusPrefs

  start(config: StartConfig, now?: number): void
  pause(now?: number): void
  resume(now?: number): void
  /** 提前完成（番茄钟）或完成（正计时）：按已用时间记一条，回到空闲。 */
  finish(now?: number): FinishResult
  /** 放弃：不记录。 */
  abandon(): void
  /** 休息中或休息结束后，不再继续，回到空闲。 */
  endCycle(): void
  /** 休息结束后，用同样的设置开始下一轮。 */
  next(now?: number): void
  /** 按现在的时刻推进计时：到点的专注记下来、进入休息，休息到点进入 ready。返回刚发生的事。 */
  tick(now?: number): TimerEvent[]
  setPrefs(patch: Partial<Pick<FocusPrefs, 'notify' | 'sound'>>): void
  /** 从存储重新读（另一个标签页改了计时状态时）。 */
  reload(): void
}

export const useFocusStore = create<FocusState>()((set, get) => {
  const setRun = (run: RunState | null) => {
    set({ run })
    write(browserStorage(), RUN_KEY, run)
  }

  return {
    run: loadRun(browserStorage()),
    prefs: loadPrefs(browserStorage()),

    start(config, now = Date.now()) {
      if (get().run) return
      const run = startRun(config, now)
      const prefs: FocusPrefs = {
        ...get().prefs,
        last: {
          mode: config.mode,
          focusMin: clampMinutes(config.focusMin, FOCUS_MINUTES),
          breakMin: clampMinutes(config.breakMin, BREAK_MINUTES),
          tag: run.tag,
        },
      }
      set({ prefs })
      write(browserStorage(), PREFS_KEY, prefs)
      setRun(run)
    },

    pause(now = Date.now()) {
      const { run } = get()
      if (run) setRun(pauseRun(run, now))
    },

    resume(now = Date.now()) {
      const { run } = get()
      if (run) setRun(resumeRun(run, now))
    },

    finish(now = Date.now()) {
      const { run } = get()
      if (!run) return 'none'
      // 点的时候番茄钟其实已经到点了（页面刚被唤醒）：先照常记下，不再重复记
      const advanced = advance(run, now)
      for (const session of advanced.sessions) useStore.getState().addFocus(session)
      if (advanced.run.phase !== 'focus') {
        setRun(advanced.run)
        return 'saved'
      }
      const session = finishSession(advanced.run, now)
      if (session) useStore.getState().addFocus(session)
      setRun(null)
      return session ? 'saved' : 'short'
    },

    abandon() {
      setRun(null)
    },

    endCycle() {
      const { run } = get()
      if (run && run.phase !== 'focus') setRun(null)
    },

    next(now = Date.now()) {
      const { run } = get()
      if (run?.phase === 'ready') setRun(nextRound(run, now))
    },

    tick(now = Date.now()) {
      const { run } = get()
      if (!run) return []
      const advanced = advance(run, now)
      if (advanced.run === run) return []
      for (const session of advanced.sessions) useStore.getState().addFocus(session)
      setRun(advanced.run)
      return advanced.events
    },

    setPrefs(patch) {
      const prefs = { ...get().prefs, ...patch }
      set({ prefs })
      write(browserStorage(), PREFS_KEY, prefs)
    },

    reload() {
      set({ run: loadRun(browserStorage()) })
    },
  }
})

/** 另一个标签页改了计时状态，这边跟着变。返回取消监听的函数。 */
export function watchRunStorage(win: Window): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === RUN_KEY || event.key === null) useFocusStore.getState().reload()
  }
  win.addEventListener('storage', onStorage)
  return () => win.removeEventListener('storage', onStorage)
}
