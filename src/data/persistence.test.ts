import { migrations, type Migration } from './migrations'
import {
  backupKey,
  DATA_KEY,
  getStorage,
  loadData,
  loadUiPrefs,
  saveData,
  saveUiPrefs,
  startPersistence,
  UI_KEY,
} from './persistence'
import { createSampleData } from './sample'
import { createEmptyData, type AppData } from './schema'
import { useStore } from './store'

function mem(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  }
}

function throwing(name: string): Storage {
  return {
    ...mem(),
    setItem: () => {
      throw new DOMException('nope', name)
    },
  }
}

const sample = createSampleData('2026-11-10')
const other: AppData = {
  ...createEmptyData(),
  lanes: [{ id: 'x', name: '别处', color: 'blue', order: 0, note: '', links: [] }],
}

let stop: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  useStore.getState().hydrate(createEmptyData())
})
afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
})

it('reports empty when nothing is stored', () => expect(loadData(mem()).status).toBe('empty'))

it('round-trips saved data', () => {
  const st = mem()
  saveData(st, sample)
  expect(loadData(st)).toEqual({ status: 'ok', data: sample })
})

it('reports corrupt for unparseable or invalid content and leaves it in place', () => {
  const st = mem({ [DATA_KEY]: '{oops' })
  expect(loadData(st).status).toBe('corrupt')
  expect(st.getItem(DATA_KEY)).toBe('{oops')

  const invalid = JSON.stringify({ ...sample, lanes: [] })
  const st2 = mem({ [DATA_KEY]: invalid })
  expect(loadData(st2)).toMatchObject({ status: 'corrupt', raw: invalid })
  expect(st2.getItem(DATA_KEY)).toBe(invalid)
})

it('reports corrupt for data from a newer version', () => {
  const st = mem({ [DATA_KEY]: JSON.stringify({ ...sample, schemaVersion: 5 }) })
  expect(loadData(st).status).toBe('corrupt')
})

it('reports quota when storage throws on write', () =>
  expect(saveData(throwing('QuotaExceededError'), sample)).toEqual({ ok: false, reason: 'quota' }))

it('reports unavailable for other write failures', () =>
  expect(saveData(throwing('SecurityError'), sample)).toEqual({
    ok: false,
    reason: 'unavailable',
  }))

it('writes a backup of the old version before saving migrated data', () => {
  const old = JSON.stringify({
    ...sample,
    todos: undefined, // 旧版本没有待办（JSON 里整个字段不存在）
    terms: undefined,
    schemaVersion: 0,
  })
  const registry: Record<number, Migration> = {
    0: (raw) => ({ ...(raw as object), schemaVersion: 1, terms: [] }),
    1: migrations[1],
    2: migrations[2],
    3: migrations[3],
  }
  const st = mem({ [DATA_KEY]: old })
  const result = loadData(st, registry)
  expect(result.status).toBe('ok')
  expect(result).toMatchObject({ data: { schemaVersion: 4, terms: [], todos: [] } })
  expect(st.getItem(backupKey(0))).toBe(old)
  expect(JSON.parse(st.getItem(DATA_KEY)!).schemaVersion).toBe(4)
})

it('hydrates the store from storage on start', () => {
  const st = mem({ [DATA_KEY]: JSON.stringify(sample) })
  const p = startPersistence(st, window)
  stop = p.stop
  expect(p.status.status).toBe('ok')
  expect(useStore.getState().data).toEqual(sample)
  expect(useStore.getState().past).toEqual([])
})

it('saves 300 ms after a change, and immediately on pagehide', () => {
  const st = mem()
  stop = startPersistence(st, window).stop
  useStore.getState().addLane()
  vi.advanceTimersByTime(299)
  expect(st.getItem(DATA_KEY)).toBeNull()
  vi.advanceTimersByTime(1)
  expect(JSON.parse(st.getItem(DATA_KEY)!).lanes).toHaveLength(1)

  useStore.getState().addLane()
  window.dispatchEvent(new Event('pagehide'))
  expect(JSON.parse(st.getItem(DATA_KEY)!).lanes).toHaveLength(2)
})

it('never writes while the stored data is corrupt', () => {
  const st = mem({ [DATA_KEY]: '{oops' })
  const p = startPersistence(st, window)
  stop = p.stop
  expect(p.status.status).toBe('corrupt')
  useStore.getState().addLane()
  vi.advanceTimersByTime(1000)
  window.dispatchEvent(new Event('pagehide'))
  expect(st.getItem(DATA_KEY)).toBe('{oops')
})

it('reports a save error and clears it after a successful save', () => {
  let fail = true
  const st = mem()
  const flaky: Storage = {
    ...st,
    setItem: (key, value) => {
      if (fail && key === DATA_KEY) throw new DOMException('full', 'QuotaExceededError')
      st.setItem(key, value)
    },
  }
  const p = startPersistence(flaky, window)
  stop = p.stop
  const seen: (string | null)[] = []
  p.subscribe(() => seen.push(p.saveError()))
  useStore.getState().addLane()
  vi.advanceTimersByTime(300)
  expect(p.saveError()).toBe('quota')
  fail = false
  useStore.getState().addLane()
  vi.advanceTimersByTime(300)
  expect(p.saveError()).toBeNull()
  expect(seen).toEqual(['quota', null])
})

it('adopts data written by another tab', () => {
  const st = mem()
  stop = startPersistence(st, window).stop
  useStore.getState().addLane()
  window.dispatchEvent(
    new StorageEvent('storage', { key: DATA_KEY, newValue: JSON.stringify(other) }),
  )
  expect(useStore.getState().data).toEqual(other)
  expect(useStore.getState().past).toEqual([])
})

it('does not overwrite the other tab with a pending stale save', () => {
  const st = mem()
  stop = startPersistence(st, window).stop
  useStore.getState().addLane('旧')
  st.setItem(DATA_KEY, JSON.stringify(other))
  window.dispatchEvent(
    new StorageEvent('storage', { key: DATA_KEY, newValue: JSON.stringify(other) }),
  )
  vi.advanceTimersByTime(1000)
  expect(JSON.parse(st.getItem(DATA_KEY)!)).toEqual(other)
})

it('ignores a storage event carrying invalid data', () => {
  const st = mem()
  stop = startPersistence(st, window).stop
  const id = useStore.getState().addLane()
  for (const newValue of ['{oops', JSON.stringify({ ...other, lanes: 'x' }), null])
    window.dispatchEvent(new StorageEvent('storage', { key: DATA_KEY, newValue }))
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'unrelated', newValue: JSON.stringify(other) }),
  )
  expect(useStore.getState().data.lanes[0].id).toBe(id)
})

it('creates UI prefs on first use and remembers them', () => {
  const st = mem()
  const first = loadUiPrefs(st, new Date('2026-11-10T08:00:00Z'))
  expect(first).toEqual({
    zoomPreset: 'year',
    pxPerDay: null,
    firstUsedAt: '2026-11-10T08:00:00.000Z',
  })
  saveUiPrefs(st, { ...first, zoomPreset: 'quarter' })
  expect(loadUiPrefs(st, new Date('2027-01-01T00:00:00Z'))).toEqual({
    ...first,
    zoomPreset: 'quarter',
  })
})

it('falls back to default UI prefs when the stored ones are broken', () => {
  const st = mem({ [UI_KEY]: '{oops' })
  expect(loadUiPrefs(st, new Date('2026-11-10T08:00:00Z')).zoomPreset).toBe('year')
})

it('falls back to a storage that reports unavailable when localStorage is blocked', () => {
  const blocked = {
    get localStorage(): Storage {
      throw new DOMException('blocked', 'SecurityError')
    },
  }
  const st = getStorage(blocked)
  expect(loadData(st).status).toBe('empty')
  expect(saveData(st, sample)).toEqual({ ok: false, reason: 'unavailable' })
})

it('upgrades stored version 1 data with the real migrations and keeps a v1 backup', () => {
  const v1 = {
    ...sample,
    todos: undefined, // 旧版本没有待办（JSON 里整个字段不存在）

    schemaVersion: 1,
    lanes: sample.lanes.map(({ note: _note, links: _links, ...lane }) => lane),
  }
  const old = JSON.stringify(v1)
  const st = mem({ [DATA_KEY]: old })
  const result = loadData(st)
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  expect(result.data.schemaVersion).toBe(4)
  expect(result.data.todos).toEqual([])
  expect(result.data.lanes.every((lane) => lane.note === '' && lane.links.length === 0)).toBe(true)
  expect(st.getItem(backupKey(1))).toBe(old)
  expect(JSON.parse(st.getItem(DATA_KEY)!).schemaVersion).toBe(4)
})

it('upgrades stored version 2 data to the current version with no todos and keeps a v2 backup', () => {
  const old = JSON.stringify({
    ...sample,
    todos: undefined, // 旧版本没有待办（JSON 里整个字段不存在）
    schemaVersion: 2,
  })
  const st = mem({ [DATA_KEY]: old })
  const result = loadData(st)
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  expect(result.data).toEqual({ ...sample, todos: [] })
  expect(st.getItem(backupKey(2))).toBe(old)
  expect(JSON.parse(st.getItem(DATA_KEY)!)).toMatchObject({ schemaVersion: 4, todos: [] })
})

it('upgrades stored version 3 data to version 4 with done false and keeps a v3 backup', () => {
  const stripDone = <T extends { done: boolean }>({ done: _done, ...rest }: T) => rest
  const old = JSON.stringify({
    ...sample,
    schemaVersion: 3,
    phases: sample.phases.map(stripDone),
    milestones: sample.milestones.map(stripDone),
  })
  const st = mem({ [DATA_KEY]: old })
  const result = loadData(st)
  expect(result.status).toBe('ok')
  if (result.status !== 'ok') return
  expect(result.data).toEqual(sample)
  expect(result.data.phases.every((phase) => phase.done === false)).toBe(true)
  expect(result.data.milestones.every((milestone) => milestone.done === false)).toBe(true)
  expect(st.getItem(backupKey(3))).toBe(old)
  expect(JSON.parse(st.getItem(DATA_KEY)!)).toMatchObject({ schemaVersion: 4 })
})
