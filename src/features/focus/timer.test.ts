import { appDataSchema, createEmptyData } from '@/data/schema'
import {
  advance,
  clampMinutes,
  clock,
  displayMs,
  elapsedMs,
  finishSession,
  nextRound,
  pauseRun,
  resumeRun,
  runClock,
  sessionId,
  startRun,
  targetMs,
  type RunState,
  type StartConfig,
} from './timer'

const MIN = 60_000
const T0 = Date.UTC(2026, 10, 18, 2, 0, 0)

const pomodoro: StartConfig = {
  mode: 'pomodoro',
  tag: '学习',
  note: '错题',
  focusMin: 25,
  breakMin: 5,
}
const stopwatch: StartConfig = {
  mode: 'stopwatch',
  tag: '阅读',
  note: '',
  focusMin: 25,
  breakMin: 5,
}

describe('startRun', () => {
  it('starts a pomodoro in the focus phase with the chosen lengths', () => {
    expect(startRun(pomodoro, T0)).toEqual({
      mode: 'pomodoro',
      phase: 'focus',
      tag: '学习',
      note: '错题',
      focusMs: 25 * MIN,
      breakMs: 5 * MIN,
      startedAt: T0,
      pausedAt: null,
      pausedMs: 0,
    })
  })
  it('gives a stopwatch no target lengths', () => {
    const run = startRun(stopwatch, T0)
    expect([run.focusMs, run.breakMs, targetMs(run)]).toEqual([0, 0, null])
  })
  it('clamps custom lengths to 1–180 and 1–60 minutes', () => {
    const run = startRun({ ...pomodoro, focusMin: 999, breakMin: 0 }, T0)
    expect([run.focusMs, run.breakMs]).toEqual([180 * MIN, 1 * MIN])
    expect(clampMinutes(Number.NaN, { min: 1, max: 60 })).toBe(1)
    expect(clampMinutes(12.6, { min: 1, max: 60 })).toBe(13)
  })
  it('trims the tag, cuts it to 20 characters and falls back to a default', () => {
    expect(startRun({ ...pomodoro, tag: '  数学  ' }, T0).tag).toBe('数学')
    expect(startRun({ ...pomodoro, tag: 'x'.repeat(30) }, T0).tag).toHaveLength(20)
    expect(startRun({ ...pomodoro, tag: '   ' }, T0).tag).toBe('未分类')
  })
})

describe('elapsed time from timestamps', () => {
  const run = startRun(pomodoro, T0)

  it('is the distance from the start, however the clock is sampled', () => {
    expect(elapsedMs(run, T0)).toBe(0)
    expect(elapsedMs(run, T0 + 90_000)).toBe(90_000)
    // 后台标签页被降频：一分钟才算一次，结果和每秒算一次一样
    expect(elapsedMs(run, T0 + 17 * MIN)).toBe(17 * MIN)
  })
  it('never goes negative if the system clock steps back', () => {
    expect(elapsedMs(run, T0 - 5000)).toBe(0)
  })
  it('stands still while paused', () => {
    const paused = pauseRun(run, T0 + 10 * MIN)
    expect(elapsedMs(paused, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(elapsedMs(paused, T0 + 40 * MIN)).toBe(10 * MIN)
  })
  it('leaves the paused stretch out once resumed', () => {
    const resumed = resumeRun(pauseRun(run, T0 + 10 * MIN), T0 + 15 * MIN)
    expect(resumed.pausedAt).toBeNull()
    expect(resumed.pausedMs).toBe(5 * MIN)
    expect(elapsedMs(resumed, T0 + 20 * MIN)).toBe(15 * MIN)
  })
  it('adds up several pauses', () => {
    let current = run
    current = resumeRun(pauseRun(current, T0 + 5 * MIN), T0 + 7 * MIN)
    current = resumeRun(pauseRun(current, T0 + 10 * MIN), T0 + 13 * MIN)
    expect(current.pausedMs).toBe(5 * MIN)
    expect(elapsedMs(current, T0 + 20 * MIN)).toBe(15 * MIN)
  })
  it('ignores a second pause and a resume that was not paused', () => {
    const paused = pauseRun(run, T0 + MIN)
    expect(pauseRun(paused, T0 + 2 * MIN)).toBe(paused)
    expect(resumeRun(run, T0 + 2 * MIN)).toBe(run)
  })
})

describe('what the screen shows', () => {
  it('counts a pomodoro down and a stopwatch up', () => {
    const p = startRun(pomodoro, T0)
    expect(displayMs(p, T0 + 5 * MIN)).toBe(20 * MIN)
    expect(runClock(p, T0 + 5 * MIN)).toBe('20:00')
    const w = startRun(stopwatch, T0)
    expect(runClock(w, T0 + 65_000)).toBe('01:05')
  })
  it('rounds a remaining time up and an elapsed time down', () => {
    expect(clock(1400, 'up')).toBe('00:02')
    expect(clock(1400, 'down')).toBe('00:01')
    expect(clock(0, 'up')).toBe('00:00')
  })
  it('shows hours once past 60 minutes', () => {
    expect(clock(3_723_000, 'down')).toBe('1:02:03')
    expect(clock(-5, 'down')).toBe('00:00')
  })
})

describe('advance', () => {
  const run = startRun(pomodoro, T0)

  it('does nothing before the focus time is up', () => {
    const result = advance(run, T0 + 24 * MIN + 59_000)
    expect(result.run).toBe(run)
    expect(result.sessions).toEqual([])
    expect(result.events).toEqual([])
  })
  it('records the pomodoro and starts the break the moment the focus time is up', () => {
    const result = advance(run, T0 + 25 * MIN)
    expect(result.sessions).toEqual([
      {
        id: sessionId(T0),
        mode: 'pomodoro',
        tag: '学习',
        note: '错题',
        startAt: new Date(T0).toISOString(),
        endAt: new Date(T0 + 25 * MIN).toISOString(),
        focusMs: 25 * MIN,
        completed: true,
      },
    ])
    expect(result.events).toEqual([{ type: 'focus-done', at: T0 + 25 * MIN }])
    expect(result.run).toMatchObject({ phase: 'break', startedAt: T0 + 25 * MIN, pausedMs: 0 })
  })
  it('counts the break from when focus ended, not from when the page noticed', () => {
    const result = advance(run, T0 + 27 * MIN)
    expect(result.run.phase).toBe('break')
    expect(elapsedMs(result.run, T0 + 27 * MIN)).toBe(2 * MIN)
  })
  it('moves a finished break to ready and reports it', () => {
    const result = advance(run, T0 + 30 * MIN)
    expect(result.run).toMatchObject({ phase: 'ready', startedAt: T0 + 30 * MIN })
    expect(result.events.map((e) => e.type)).toEqual(['focus-done', 'break-done'])
  })
  it('catches up after the page was closed for a long time', () => {
    const result = advance(run, T0 + 3 * 86_400_000)
    expect(result.run.phase).toBe('ready')
    expect(result.sessions).toHaveLength(1)
    // 记录落在它本来结束的那一刻，不是页面重新打开的时刻
    expect(result.sessions[0].endAt).toBe(new Date(T0 + 25 * MIN).toISOString())
    expect(result.events.map((e) => e.at)).toEqual([T0 + 25 * MIN, T0 + 30 * MIN])
  })
  it('pushes the end out by the time spent paused, and keeps the focus time exact', () => {
    const paused = resumeRun(pauseRun(run, T0 + 10 * MIN), T0 + 20 * MIN)
    expect(advance(paused, T0 + 34 * MIN).sessions).toEqual([])
    const done = advance(paused, T0 + 35 * MIN)
    expect(done.sessions[0]).toMatchObject({
      endAt: new Date(T0 + 35 * MIN).toISOString(),
      focusMs: 25 * MIN,
    })
    expect(done.run.phase).toBe('break')
  })
  it('does not end a focus that is paused, however long the pause', () => {
    const paused = pauseRun(run, T0 + 10 * MIN)
    const result = advance(paused, T0 + 5 * 86_400_000)
    expect(result.run).toBe(paused)
    expect(result.sessions).toEqual([])
  })
  it('stays in a paused break until it is resumed', () => {
    const inBreak = advance(run, T0 + 26 * MIN).run
    const paused = pauseRun(inBreak, T0 + 27 * MIN)
    expect(advance(paused, T0 + 99 * MIN).run).toBe(paused)
    const resumed = resumeRun(paused, T0 + 40 * MIN)
    expect(advance(resumed, T0 + 42 * MIN).run.phase).toBe('break')
    expect(advance(resumed, T0 + 42 * MIN + 59_000).run.phase).toBe('break')
    expect(advance(resumed, T0 + 43 * MIN).run.phase).toBe('ready')
  })
  it('never ends a stopwatch by itself', () => {
    const w = startRun(stopwatch, T0)
    expect(advance(w, T0 + 9 * 3_600_000).run).toBe(w)
  })
  it('leaves ready alone', () => {
    const ready = advance(run, T0 + 31 * MIN).run
    expect(advance(ready, T0 + 99 * MIN).run).toBe(ready)
  })
  it('gives the same session id from any tab, so it is only recorded once', () => {
    const a = advance(run, T0 + 26 * MIN).sessions[0].id
    const b = advance(run, T0 + 40 * MIN).sessions[0].id
    expect(a).toBe(b)
  })
  it('produces sessions the data schema accepts', () => {
    const { sessions } = advance(run, T0 + 26 * MIN)
    expect(appDataSchema.safeParse({ ...createEmptyData(), focusSessions: sessions }).success).toBe(
      true,
    )
  })
})

describe('finishSession', () => {
  it('records a finished stopwatch as completed', () => {
    const w = startRun(stopwatch, T0)
    expect(finishSession(w, T0 + 42 * MIN)).toMatchObject({
      mode: 'stopwatch',
      tag: '阅读',
      focusMs: 42 * MIN,
      endAt: new Date(T0 + 42 * MIN).toISOString(),
      completed: true,
    })
  })
  it('records a pomodoro finished early as valid but not completed', () => {
    const early = finishSession(startRun(pomodoro, T0), T0 + 12 * MIN)
    expect(early).toMatchObject({ focusMs: 12 * MIN, completed: false })
  })
  it('leaves the paused time out of the focus time', () => {
    const run = resumeRun(pauseRun(startRun(stopwatch, T0), T0 + 10 * MIN), T0 + 30 * MIN)
    expect(finishSession(run, T0 + 40 * MIN)?.focusMs).toBe(20 * MIN)
  })
  it('counts only up to the pause when finished while paused', () => {
    const run = pauseRun(startRun(stopwatch, T0), T0 + 10 * MIN)
    const session = finishSession(run, T0 + 50 * MIN)
    expect(session?.focusMs).toBe(10 * MIN)
    expect(
      appDataSchema.safeParse({ ...createEmptyData(), focusSessions: [session] }).success,
    ).toBe(true)
  })
  it('does not save less than a minute', () => {
    expect(finishSession(startRun(stopwatch, T0), T0 + 59_999)).toBeNull()
    expect(finishSession(startRun(stopwatch, T0), T0 + 60_000)).not.toBeNull()
  })
  it('records nothing outside the focus phase', () => {
    const inBreak = advance(startRun(pomodoro, T0), T0 + 26 * MIN).run
    expect(finishSession(inBreak, T0 + 27 * MIN)).toBeNull()
  })
})

describe('nextRound', () => {
  it('starts a new focus round with the same settings', () => {
    const ready = advance(startRun(pomodoro, T0), T0 + 31 * MIN).run
    const next: RunState = nextRound(ready, T0 + 33 * MIN)
    expect(next).toMatchObject({
      phase: 'focus',
      tag: '学习',
      focusMs: 25 * MIN,
      startedAt: T0 + 33 * MIN,
      pausedAt: null,
      pausedMs: 0,
    })
    expect(sessionId(next.startedAt)).not.toBe(sessionId(T0))
  })
})
