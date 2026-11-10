import type { Scale } from './scale'

const DAY_MS = 86_400_000
const monthStartDay = (year: number, month: number) => Math.round(Date.UTC(year, month, 1) / DAY_MS)

export interface Tick {
  year: number
  /** 0–11 */
  month: number
  /** 该月第一天的整日数 */
  day: number
}

/** 可见范围内每个月的第一天（前后各多取一个月，保证边缘完整）。 */
export function monthTicks(scale: Scale, width: number): Tick[] {
  const first = new Date((Math.floor(scale.originDay) - 31) * DAY_MS)
  const lastDay = Math.ceil(scale.originDay + width / scale.pxPerDay) + 31
  const ticks: Tick[] = []
  let year = first.getUTCFullYear()
  let month = first.getUTCMonth()
  for (;;) {
    const day = monthStartDay(year, month)
    if (day > lastDay) break
    ticks.push({ year, month, day })
    month += 1
    if (month === 12) {
      month = 0
      year += 1
    }
  }
  return ticks
}
