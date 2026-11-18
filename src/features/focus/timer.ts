import { FOCUS_MIN_MS, TAG_MAX, type FocusSession } from '@/data/schema'

export type FocusMode = FocusSession['mode']
/** ready：休息结束，等着开始下一轮 */
export type Phase = 'focus' | 'break' | 'ready'

/**
 * 一轮专注的计时状态。只存时间戳：已用时间由“现在”减去开始时刻、再扣掉暂停算出来，
 * 不靠定时器一秒秒累加，所以后台标签页被降频、刷新、关掉再打开，时间都不会错。
 */
export interface RunState {
  mode: FocusMode
  phase: Phase
  tag: string
  note: string
  /** 番茄钟的专注时长；正计时为 0 */
  focusMs: number
  /** 番茄钟的休息时长；正计时为 0 */
  breakMs: number
  /** 当前阶段的开始时刻（毫秒时间戳）；专注阶段就是这一轮的开始 */
  startedAt: number
  /** 正在暂停时，暂停开始的时刻 */
  pausedAt: number | null
  /** 当前阶段已累计的暂停时长 */
  pausedMs: number
}

export interface StartConfig {
  mode: FocusMode
  tag: string
  note: string
  /** 分钟，只对番茄钟有意义 */
  focusMin: number
  breakMin: number
}

export const PRESETS = [
  { focusMin: 25, breakMin: 5 },
  { focusMin: 45, breakMin: 10 },
  { focusMin: 50, breakMin: 10 },
] as const

export const FOCUS_MINUTES = { min: 1, max: 180 } as const
export const BREAK_MINUTES = { min: 1, max: 60 } as const
export const DEFAULT_TAG = '未分类'

const MINUTE_MS = 60_000

export function clampMinutes(value: number, limits: { min: number; max: number }): number {
  if (!Number.isFinite(value)) return limits.min
  return Math.min(limits.max, Math.max(limits.min, Math.round(value)))
}

export function cleanTag(tag: string): string {
  return tag.trim().slice(0, TAG_MAX) || DEFAULT_TAG
}

export function startRun(config: StartConfig, now: number): RunState {
  const pomodoro = config.mode === 'pomodoro'
  return {
    mode: config.mode,
    phase: 'focus',
    tag: cleanTag(config.tag),
    note: config.note.trim(),
    focusMs: pomodoro ? clampMinutes(config.focusMin, FOCUS_MINUTES) * MINUTE_MS : 0,
    breakMs: pomodoro ? clampMinutes(config.breakMin, BREAK_MINUTES) * MINUTE_MS : 0,
    startedAt: now,
    pausedAt: null,
    pausedMs: 0,
  }
}

/** 休息结束后，用同样的设置开始下一轮。 */
export function nextRound(run: RunState, now: number): RunState {
  return { ...run, phase: 'focus', startedAt: now, pausedAt: null, pausedMs: 0 }
}

export function pauseRun(run: RunState, now: number): RunState {
  return run.pausedAt !== null || run.phase === 'ready' ? run : { ...run, pausedAt: now }
}

export function resumeRun(run: RunState, now: number): RunState {
  if (run.pausedAt === null) return run
  return { ...run, pausedAt: null, pausedMs: run.pausedMs + Math.max(0, now - run.pausedAt) }
}

/** 当前阶段已用的时间（不含暂停）。 */
export function elapsedMs(run: RunState, now: number): number {
  return Math.max(0, (run.pausedAt ?? now) - run.startedAt - run.pausedMs)
}

/** 当前阶段的目标时长；正计时的专注和 ready 没有目标。 */
export function targetMs(run: RunState): number | null {
  if (run.phase === 'break') return run.breakMs
  if (run.phase === 'focus' && run.mode === 'pomodoro') return run.focusMs
  return null
}

/** 屏幕上显示的时间：有目标的写剩余，没有的写已用。 */
export function displayMs(run: RunState, now: number): number {
  const target = targetMs(run)
  const elapsed = elapsedMs(run, now)
  return target === null ? elapsed : Math.max(0, target - elapsed)
}

/** 59:59 或 1:02:03。剩余时间向上取整（还差 0.4 秒仍显示 00:01），已用时间向下取整。 */
export function clock(ms: number, round: 'up' | 'down'): string {
  const total = Math.max(0, round === 'up' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

export function runClock(run: RunState, now: number): string {
  return clock(displayMs(run, now), targetMs(run) === null ? 'down' : 'up')
}

/** 同一轮专注在任何标签页里补算出来的记录 id 都一样，所以不会记两次。 */
export function sessionId(startedAt: number): string {
  return `focus-${startedAt}`
}

function buildSession(run: RunState, endAt: number, focusMs: number, completed: boolean) {
  if (focusMs < FOCUS_MIN_MS) return null
  const session: FocusSession = {
    id: sessionId(run.startedAt),
    mode: run.mode,
    tag: run.tag,
    note: run.note,
    startAt: new Date(run.startedAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
    focusMs,
    completed,
  }
  return session
}

export interface TimerEvent {
  type: 'focus-done' | 'break-done'
  /** 它该发生的时刻；页面一直开着时和“现在”几乎相同 */
  at: number
}

export interface Advanced {
  run: RunState
  sessions: FocusSession[]
  events: TimerEvent[]
}

/**
 * 按“现在”把状态推到该在的位置：专注到点就记一条并进入休息，休息到点就进入 ready。
 * 页面被关掉很久再打开时一次推完，每个阶段都落在它本来结束的那一刻。
 */
export function advance(run: RunState, now: number): Advanced {
  const sessions: FocusSession[] = []
  const events: TimerEvent[] = []
  let current = run
  for (;;) {
    if (
      current.phase === 'focus' &&
      current.mode === 'pomodoro' &&
      elapsedMs(current, now) >= current.focusMs
    ) {
      const endedAt = current.startedAt + current.pausedMs + current.focusMs
      const session = buildSession(current, endedAt, current.focusMs, true)
      if (session) sessions.push(session)
      events.push({ type: 'focus-done', at: endedAt })
      current = { ...current, phase: 'break', startedAt: endedAt, pausedAt: null, pausedMs: 0 }
      continue
    }
    if (current.phase === 'break' && elapsedMs(current, now) >= current.breakMs) {
      const endedAt = current.startedAt + current.pausedMs + current.breakMs
      events.push({ type: 'break-done', at: endedAt })
      current = { ...current, phase: 'ready', startedAt: endedAt, pausedAt: null, pausedMs: 0 }
      continue
    }
    return { run: current, sessions, events }
  }
}

/**
 * 手动结束专注（正计时的“完成”，番茄钟的“提前完成”）。不足 1 分钟返回 null，不保存。
 * 番茄钟提前结束时 completed 为 false：它是有效的专注，只是没跑满计划。
 */
export function finishSession(run: RunState, now: number): FocusSession | null {
  if (run.phase !== 'focus') return null
  const focusMs = Math.floor(elapsedMs(run, now))
  const completed = run.mode === 'stopwatch' || focusMs >= run.focusMs
  return buildSession(run, now, focusMs, completed)
}
