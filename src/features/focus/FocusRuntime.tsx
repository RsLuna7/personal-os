import { useEffect, useRef } from 'react'
import { announce } from './alerts'
import { useFocusStore, watchRunStorage } from './focusStore'
import { runClock, type Phase, type RunState } from './timer'
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

  // 推进计时。用 getState 取最新的状态：同一个时刻可能已经被别的地方推进过
  useEffect(() => {
    const store = useFocusStore.getState()
    const events = store.tick(now)
    if (events.length > 0) {
      const state = useFocusStore.getState()
      announce(events, state.run, state.prefs, now)
    }
  }, [now, run])

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
