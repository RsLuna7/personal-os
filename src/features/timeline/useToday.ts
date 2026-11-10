import { useEffect, useState } from 'react'
import { toDay, todayISO } from './days'

const currentDay = () => toDay(todayISO())

/** 今天的整日数；每 60 秒和页面重新可见时重新计算，过了零点会自动更新。 */
export function useToday(): number {
  const [day, setDay] = useState(currentDay)

  useEffect(() => {
    const update = () => setDay(currentDay())
    const timer = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', update)
    }
  }, [])

  return day
}
