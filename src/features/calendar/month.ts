import { fromDay, toDay } from '@/features/timeline/days'
import { mondayOf, WEEK } from '@/features/timeline/snap'

export const MIN_YEAR = 1900
export const MAX_YEAR = 2100

export interface MonthRef {
  year: number
  /** 1 到 12 */
  month: number
}

const MONTH_PARAM = /^(\d{4})-(0[1-9]|1[0-2])$/

function currentMonth(today: number): MonthRef {
  const [year, month] = fromDay(today).split('-').map(Number)
  return { year: year!, month: month! }
}

/** 网址里的月份参数；缺失、不合法或超出 1900 到 2100 时取今天所在的月。 */
export function parseMonthParam(param: string | null, today: number): MonthRef {
  const match = param === null ? null : MONTH_PARAM.exec(param)
  if (!match) return currentMonth(today)
  const year = Number(match[1])
  if (year < MIN_YEAR || year > MAX_YEAR) return currentMonth(today)
  return { year, month: Number(match[2]) }
}

export function monthParam(ref: MonthRef): string {
  return `${String(ref.year).padStart(4, '0')}-${String(ref.month).padStart(2, '0')}`
}

export function monthTitle(ref: MonthRef): string {
  return `${ref.year}年${ref.month}月`
}

/** 上一个或下一个月；越过 1900-01 或 2100-12 返回 null。 */
export function shiftMonth(ref: MonthRef, delta: -1 | 1): MonthRef | null {
  const index = ref.year * 12 + (ref.month - 1) + delta
  const year = Math.floor(index / 12)
  if (year < MIN_YEAR || year > MAX_YEAR) return null
  return { year, month: (index % 12) + 1 }
}

/** 当月的完整周，每周 7 个整日数，周一起。 */
export function monthWeeks(ref: MonthRef): number[][] {
  const first = toDay(`${monthParam(ref)}-01`)
  const next = shiftMonthUnbounded(ref)
  const last = toDay(`${monthParam(next)}-01`) - 1
  const start = mondayOf(first)
  const count = Math.floor((last - start) / WEEK) + 1
  return Array.from({ length: count }, (_, week) =>
    Array.from({ length: WEEK }, (_, col) => start + week * WEEK + col),
  )
}

/** 下一个月，不受 1900 到 2100 的限制（只用来算当月的最后一天）。 */
function shiftMonthUnbounded(ref: MonthRef): MonthRef {
  const index = ref.year * 12 + ref.month
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}
