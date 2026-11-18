import { act, render } from '@testing-library/react'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { FocusRuntime, titleFor } from './FocusRuntime'
import { DEFAULT_PREFS, useFocusStore } from './focusStore'
import { pauseRun, startRun } from './timer'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const MIN = 60_000
const T0 = new Date(2026, 10, 18, 10, 0, 0).getTime()
const pomodoro = { mode: 'pomodoro' as const, tag: '学习', note: '', focusMin: 25, breakMin: 5 }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  localStorage.clear()
  document.title = '原来的标题'
  useStore.getState().hydrate(createEmptyData())
  useFocusStore.setState({ run: null, prefs: { ...DEFAULT_PREFS, sound: false, notify: false } })
})
afterEach(() => vi.useRealTimers())

describe('titleFor', () => {
  it('writes the remaining time for a pomodoro and the elapsed time for a stopwatch', () => {
    const p = startRun(pomodoro, T0)
    expect(titleFor(p, T0 + 5 * MIN)).toBe('20:00 · 专注 · Kairos OS')
    const w = startRun({ ...pomodoro, mode: 'stopwatch' }, T0)
    expect(titleFor(w, T0 + 65_000)).toBe('01:05 · 专注 · Kairos OS')
  })
  it('marks a pause and names the break and the end of it', () => {
    expect(titleFor(pauseRun(startRun(pomodoro, T0), T0 + MIN), T0 + 9 * MIN)).toBe(
      '⏸ 24:00 · 专注 · Kairos OS',
    )
    expect(titleFor({ ...startRun(pomodoro, T0), phase: 'break' }, T0 + MIN)).toBe(
      '04:00 · 休息 · Kairos OS',
    )
    expect(titleFor({ ...startRun(pomodoro, T0), phase: 'ready' }, T0)).toBe('休息结束 · Kairos OS')
  })
})

describe('FocusRuntime', () => {
  it('ends the focus and then the break on time', () => {
    render(<FocusRuntime />)
    act(() => useFocusStore.getState().start(pomodoro, T0))
    expect(useFocusStore.getState().run?.phase).toBe('focus')
    act(() => {
      vi.advanceTimersByTime(25 * MIN + 100)
    })
    expect(useFocusStore.getState().run?.phase).toBe('break')
    expect(useStore.getState().data.focusSessions).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(5 * MIN + 100)
    })
    expect(useFocusStore.getState().run?.phase).toBe('ready')
  })

  it('catches up at once when the page opens with a round that has run out', () => {
    useFocusStore.setState({ run: startRun(pomodoro, T0 - 40 * MIN) })
    render(<FocusRuntime />)
    expect(useFocusStore.getState().run?.phase).toBe('ready')
    expect(useStore.getState().data.focusSessions).toHaveLength(1)
  })

  it('keeps the title in step and restores it when the round ends', () => {
    render(<FocusRuntime />)
    act(() => useFocusStore.getState().start(pomodoro, T0))
    expect(document.title).toBe('25:00 · 专注 · Kairos OS')
    act(() => {
      vi.advanceTimersByTime(2 * MIN)
    })
    expect(document.title).toBe('23:00 · 专注 · Kairos OS')
    act(() => useFocusStore.getState().abandon())
    expect(document.title).toBe('原来的标题')
  })

  it('puts the original title back when it goes away', () => {
    const { unmount } = render(<FocusRuntime />)
    act(() => useFocusStore.getState().start(pomodoro, T0))
    unmount()
    expect(document.title).toBe('原来的标题')
  })

  it('does not end a paused focus however long it waits', () => {
    render(<FocusRuntime />)
    act(() => useFocusStore.getState().start(pomodoro, T0))
    act(() => useFocusStore.getState().pause(T0 + 10 * MIN))
    act(() => {
      vi.advanceTimersByTime(3 * 60 * MIN)
    })
    expect(useFocusStore.getState().run?.phase).toBe('focus')
    expect(useStore.getState().data.focusSessions).toEqual([])
  })
})
