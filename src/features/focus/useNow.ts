import { useEffect, useState } from 'react'

/**
 * 当前时刻（毫秒时间戳），active 时每 interval 毫秒刷新一次，页面重新可见时立刻刷新。
 * 显示的时间都由它和开始时刻相减得出，所以后台被降频只会让刷新变慢，不会让时间变错。
 */
export function useNow(active: boolean, interval = 250): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
    const update = () => setNow(Date.now())
    update()
    const timer = setInterval(update, interval)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [active, interval])

  return now
}
