import { useCallback, useEffect, useRef } from 'react'
import { announce } from './alerts'
import { useFocusStore, watchRunStorage } from './focusStore'
import { runClock, targetMs, type Phase, type RunState } from './timer'
import { useNow } from './useNow'

const PHASE_LABEL: Record<Phase, string> = { focus: '专注', break: '休息', ready: '休息结束' }

export function titleFor(run: RunState, now: number): string {
  if (run.phase === 'ready') return '休息结束 · Kairos OS'
  const paused = run.pausedAt !== null ? '⏸ ' : ''
  return `${paused}${runClock(run, now)} · ${PHASE_LABEL[run.phase]} · Kairos OS`
}

/**
 * 常驻、不画任何东西：隔一会儿按时间戳重新算计时，到点的专注记下来、进入休息，
 * 发提醒，并让浏览器标签页的标题显示剩余或已用时间。
 */
export function FocusRuntime() {
  const run = useFocusStore((state) => state.run)
  const now = useNow(run !== null && run.phase !== 'ready')
  const baseTitle = useRef(document.title)

  useEffect(() => watchRunStorage(window), [])

  /** 按此刻推进计时，刚发生的事（专注到点、休息结束）发提醒。 */
  const process = useCallback(() => {
    const at = Date.now()
    const events = useFocusStore.getState().tick(at)
    if (events.length > 0) {
      const { run: current, prefs } = useFocusStore.getState()
      announce(events, current, prefs, at)
    }
  }, [])

  // 页面刷新、重新可见、时钟走了一格：重新算一次
  useEffect(() => process(), [now, run, process])

  // 另外在阶段该结束的那一刻设一个一次性的定时器：后台标签页里反复触发的定时器会被浏览器
  // 降到每分钟一次，单独设的这个不受影响，提醒不会晚太多
  useEffect(() => {
    if (!run || run.pausedAt !== null) return
    const target = targetMs(run)
    if (target === null) return
    const due = run.startedAt + run.pausedMs + target - Date.now()
    const timer = setTimeout(process, Math.max(0, due) + 50)
    return () => clearTimeout(timer)
  }, [run, process])

  useEffect(() => {
    document.title = run ? titleFor(run, now) : baseTitle.current
  }, [run, now])

  useEffect(() => {
    const title = baseTitle.current
    return () => {
      document.title = title
    }
  }, [])

  return null
}
