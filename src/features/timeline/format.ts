import { fromDay } from './days'
import { WEEK } from './snap'

function parts(day: number): { y: number; m: number; d: number } {
  const [y, m, d] = fromDay(day).split('-').map(Number)
  return { y, m, d }
}

/** 11月9日 */
export function formatDay(day: number): string {
  const { m, d } = parts(day)
  return `${m}月${d}日`
}

/** 2026年11月9日 */
export function formatDayWithYear(day: number): string {
  return `${parts(day).y}年${formatDay(day)}`
}

/** 11月9日 – 12月6日（endDay 不含当天，显示为前一天） */
export function formatRange(startDay: number, endDay: number): string {
  return `${formatDay(startDay)} – ${formatDay(endDay - 1)}`
}

/** 2026年11月9日 – 12月6日；跨年时两端都带年份 */
export function formatRangeWithYear(startDay: number, endDay: number): string {
  const last = endDay - 1
  const sameYear = parts(startDay).y === parts(last).y
  return `${formatDayWithYear(startDay)} – ${sameYear ? formatDay(last) : formatDayWithYear(last)}`
}

/** 4 周；不足整周时为 10 天 */
export function formatDuration(days: number): string {
  return days % WEEK === 0 ? `${days / WEEK} 周` : `${days} 天`
}

export function countdownText(day: number, today: number): string {
  if (day === today) return '就是今天'
  return day > today ? `还有 ${day - today} 天` : `已过 ${today - day} 天`
}
