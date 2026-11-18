import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import {
  DEFAULT_PREFS,
  loadPrefs,
  loadRun,
  PREFS_KEY,
  RUN_KEY,
  useFocusStore,
  watchRunStorage,
} from './focusStore'
import { startRun, type StartConfig } from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 10, 18, 2, 0, 0)
const f = () => useFocusStore.getState()
const sessions = () => useStore.getState().data.focusSessions

const pomodoro: StartConfig = { mode: 'pomodoro', tag: '学习', note: '', focusMin: 25, breakMin: 5 }
const stopwatch: StartConfig = {
  mode: 'stopwatch',
  tag: '阅读',
  note: '',
  focusMin: 25,
  breakMin: 5,
}
const stored = () => JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null')

beforeEach(() => {
  localStorage.clear()
  useStore.getState().hydrate(createEmptyData())
  useFocusStore.setState({ run: null, prefs: DEFAULT_PREFS })
})

describe('starting and persisting', () => {
  it('starts a run and writes it to storage', () => {
    f().start(pomodoro, T0)
    expect(f().run).toMatchObject({ phase: 'focus', tag: '学习', startedAt: T0 })
    expect(stored()).toEqual(f().run)
  })
  it('keeps the running round when asked to start another', () => {
    f().start(pomodoro, T0)
    f().start(stopwatch, T0 + MIN)
    expect(f().run).toMatchObject({ mode: 'pomodoro', startedAt: T0 })
  })
  it('remembers the last settings for a one-tap start', () => {
    f().start({ ...pomodoro, focusMin: 50, breakMin: 10, tag: '英语' }, T0)
    expect(f().prefs.last).toEqual({ mode: 'pomodoro', focusMin: 50, breakMin: 10, tag: '英语' })
    expect(loadPrefs(localStorage).last.tag).toBe('英语')
  })
  it('restores the run after a reload, still counting from the original start', () => {
    f().start(pomodoro, T0)
    f().pause(T0 + 10 * MIN)
    useFocusStore.setState({ run: null })
    f().reload()
    expect(f().run).toMatchObject({ startedAt: T0, pausedAt: T0 + 10 * MIN })
  })
  it('ignores stored data that is not a run', () => {
    for (const bad of ['{', '"x"', '{"mode":"pomodoro"}', 'null'])
      expect(loadRun(memory(RUN_KEY, bad))).toBeNull()
    localStorage.setItem(RUN_KEY, '{"phase":"nope"}')
    f().reload()
    expect(f().run).toBeNull()
  })
  it('falls back to the default settings when the stored ones are broken', () => {
    expect(loadPrefs(memory(PREFS_KEY, 'oops'))).toEqual(DEFAULT_PREFS)
    expect(loadPrefs(memory(PREFS_KEY, '{"notify":false,"sound":"x","last":5}'))).toEqual({
      ...DEFAULT_PREFS,
      notify: false,
    })
    expect(
      loadPrefs(
        memory(PREFS_KEY, '{"last":{"mode":"pomodoro","focusMin":999,"breakMin":0,"tag":"x"}}'),
      ).last,
    ).toEqual({ mode: 'pomodoro', focusMin: 180, breakMin: 1, tag: 'x' })
  })
})

describe('pause, resume, abandon', () => {
  it('pauses and resumes, writing each change', () => {
    f().start(stopwatch, T0)
    f().pause(T0 + 5 * MIN)
    expect(stored().pausedAt).toBe(T0 + 5 * MIN)
    f().resume(T0 + 8 * MIN)
    expect(stored()).toMatchObject({ pausedAt: null, pausedMs: 3 * MIN })
  })
  it('abandons without recording anything', () => {
    f().start(pomodoro, T0)
    f().abandon()
    expect(f().run).toBeNull()
    expect(localStorage.getItem(RUN_KEY)).toBeNull()
    expect(sessions()).toEqual([])
  })
})

describe('finish', () => {
  it('records a stopwatch as completed and goes back to idle', () => {
    f().start(stopwatch, T0)
    expect(f().finish(T0 + 40 * MIN)).toBe('saved')
    expect(f().run).toBeNull()
    expect(sessions()).toMatchObject([{ tag: '阅读', focusMs: 40 * MIN, completed: true }])
  })
  it('records a pomodoro finished early as not completed', () => {
    f().start(pomodoro, T0)
    expect(f().finish(T0 + 10 * MIN)).toBe('saved')
    expect(sessions()).toMatchObject([{ focusMs: 10 * MIN, completed: false }])
  })
  it('saves nothing under a minute, but still ends the round', () => {
    f().start(stopwatch, T0)
    expect(f().finish(T0 + 30_000)).toBe('short')
    expect(f().run).toBeNull()
    expect(sessions()).toEqual([])
  })
  it('does nothing when no round is running', () => {
    expect(f().finish(T0)).toBe('none')
  })
  it('does not record a pomodoro twice when it was already due', () => {
    f().start(pomodoro, T0)
    expect(f().finish(T0 + 26 * MIN)).toBe('saved')
    expect(sessions()).toMatchObject([{ focusMs: 25 * MIN, completed: true }])
    expect(f().run?.phase).toBe('break')
  })
  it('counts the paused time out', () => {
    f().start(stopwatch, T0)
    f().pause(T0 + 10 * MIN)
    f().resume(T0 + 30 * MIN)
    f().finish(T0 + 45 * MIN)
    expect(sessions()[0].focusMs).toBe(25 * MIN)
  })
})

describe('tick', () => {
  it('does nothing while the focus time is not up', () => {
    f().start(pomodoro, T0)
    const before = f().run
    expect(f().tick(T0 + 24 * MIN)).toEqual([])
    expect(f().run).toBe(before)
    expect(sessions()).toEqual([])
  })
  it('records the pomodoro and starts the break when the time is up', () => {
    f().start(pomodoro, T0)
    expect(f().tick(T0 + 25 * MIN)).toEqual([{ type: 'focus-done', at: T0 + 25 * MIN }])
    expect(sessions()).toHaveLength(1)
    expect(f().run?.phase).toBe('break')
    expect(stored().phase).toBe('break')
  })
  it('finishes the break into ready, then the next round starts the same way', () => {
    f().start(pomodoro, T0)
    expect(
      f()
        .tick(T0 + 31 * MIN)
        .map((e) => e.type),
    ).toEqual(['focus-done', 'break-done'])
    expect(f().run?.phase).toBe('ready')
    f().next(T0 + 33 * MIN)
    expect(f().run).toMatchObject({ phase: 'focus', tag: '学习', startedAt: T0 + 33 * MIN })
  })
  it('catches up from storage after the tab was closed for hours', () => {
    localStorage.setItem(RUN_KEY, JSON.stringify(startRun(pomodoro, T0)))
    f().reload()
    f().tick(T0 + 6 * 3_600_000)
    expect(f().run?.phase).toBe('ready')
    expect(sessions()).toMatchObject([{ endAt: new Date(T0 + 25 * MIN).toISOString() }])
  })
  it('does not record the same round twice when two tabs both catch up', () => {
    f().start(pomodoro, T0)
    f().tick(T0 + 26 * MIN)
    // 另一个标签页还在用旧状态，也补算了一遍
    useFocusStore.setState({ run: startRun(pomodoro, T0) })
    f().tick(T0 + 26 * MIN)
    expect(sessions()).toHaveLength(1)
  })
  it('keeps a stopwatch running however long it has been', () => {
    f().start(stopwatch, T0)
    expect(f().tick(T0 + 10 * 3_600_000)).toEqual([])
    expect(f().run?.phase).toBe('focus')
  })
  it('does nothing when idle', () => {
    expect(f().tick(T0)).toEqual([])
  })
})

describe('breaks', () => {
  it('ends the cycle from a break or from ready, but not from a focus', () => {
    f().start(pomodoro, T0)
    f().endCycle()
    expect(f().run?.phase).toBe('focus')
    f().tick(T0 + 26 * MIN)
    f().endCycle()
    expect(f().run).toBeNull()
  })
  it('only starts a next round from ready', () => {
    f().start(pomodoro, T0)
    f().next(T0 + MIN)
    expect(f().run?.startedAt).toBe(T0)
  })
})

describe('settings', () => {
  it('turns notifications and sound off and keeps that across reloads', () => {
    f().setPrefs({ notify: false })
    f().setPrefs({ sound: false })
    expect(loadPrefs(localStorage)).toMatchObject({ notify: false, sound: false })
  })
})

describe('other tabs', () => {
  it('follows a run another tab wrote to storage', () => {
    const stop = watchRunStorage(window)
    localStorage.setItem(RUN_KEY, JSON.stringify(startRun(stopwatch, T0)))
    window.dispatchEvent(new StorageEvent('storage', { key: RUN_KEY }))
    expect(f().run).toMatchObject({ mode: 'stopwatch', startedAt: T0 })
    localStorage.removeItem(RUN_KEY)
    window.dispatchEvent(new StorageEvent('storage', { key: RUN_KEY }))
    expect(f().run).toBeNull()
    stop()
  })
  it('ignores unrelated storage changes and stops listening when asked', () => {
    const stop = watchRunStorage(window)
    f().start(pomodoro, T0)
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: 'personal-os:data' }))
    expect(f().run).not.toBeNull()
    stop()
    window.dispatchEvent(new StorageEvent('storage', { key: RUN_KEY }))
    expect(f().run).not.toBeNull()
  })
})

function memory(key: string, value: string): Storage {
  localStorage.clear()
  localStorage.setItem(key, value)
  return localStorage
}
