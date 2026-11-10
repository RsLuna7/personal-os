import type { ISODate } from '@/data/schema'

const DAY_MS = 86_400_000

/** 自 1970-01-01 起的 UTC 整日数。 */
export function toDay(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

export function fromDay(day: number): ISODate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(date: ISODate, n: number): ISODate {
  return fromDay(toDay(date) + n)
}

/** 今天，取使用者本地日历上的日期。 */
export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
