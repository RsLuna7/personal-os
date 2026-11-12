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

/** 1970-01-05（第 4 天）是周一，和 snap.ts 一致 */
const MONDAY_OFFSET = 4
const WEEK_DAYS = 7

export interface WeekTick {
  /** 这一周周一的整日数 */
  day: number
}

/** 可见范围内每一周的周一（前后各多取一周，保证边缘完整）。 */
export function weekTicks(scale: Scale, width: number): WeekTick[] {
  const firstVisible = Math.floor(scale.originDay)
  const lastVisible = Math.ceil(scale.originDay + width / scale.pxPerDay)
  let monday =
    Math.floor((firstVisible - MONDAY_OFFSET) / WEEK_DAYS) * WEEK_DAYS + MONDAY_OFFSET - WEEK_DAYS
  const ticks: WeekTick[] = []
  for (; monday <= lastVisible + WEEK_DAYS; monday += WEEK_DAYS) ticks.push({ day: monday })
  return ticks
}

/** 学期的起止，用整日数表示；end 不含当天，和数据里一致 */
export interface TermSpan {
  start: number
  end: number
  /** 假期（寒假、暑假……）：不数“第几周”，周刻度照样写日期 */
  holiday?: boolean
}

/** 名字里带“假”字的一段算假期，比如寒假、暑假、假期、放假 */
export function isHolidayName(name: string): boolean {
  return name.includes('假')
}

/**
 * 标尺上一周的标注：
 * - 这一周和某个学期有重叠：写“第 N 周”，学期开始那天所在的周是第 1 周；
 * - 不在任何学期里，或只落在假期里：写周一的日期（几号）。
 * 多个学期重叠时用开始得最晚的那个（新学期优先）。
 */
export function weekLabel(monday: number, terms: TermSpan[]): string {
  let current: TermSpan | null = null
  for (const term of terms) {
    if (term.holiday) continue
    const overlaps = term.start < monday + WEEK_DAYS && monday < term.end
    if (overlaps && (current === null || term.start > current.start)) current = term
  }
  if (current) {
    const firstMonday =
      Math.floor((current.start - MONDAY_OFFSET) / WEEK_DAYS) * WEEK_DAYS + MONDAY_OFFSET
    return `第${(monday - firstMonday) / WEEK_DAYS + 1}周`
  }
  return String(new Date(monday * DAY_MS).getUTCDate())
}

/** 刻度标签大约要占的宽度：最左边留这么多给“常驻”标签 */
export const EDGE_LABEL_PX = 56

/**
 * 标尺每一行最左边的处理，避免两个标签叠在一起：
 * - 刻度滚出左边（x < 0）就不画它的标签，改由最左边的常驻标签显示同样的内容；
 * - 有刻度刚好落在最左边一个标签宽度以内时，不画常驻标签，让这个刻度自己占住左边。
 */
export function edgeLabels(xs: number[]): { leading: boolean; visible: boolean[] } {
  return {
    leading: !xs.some((x) => x >= 0 && x < EDGE_LABEL_PX),
    visible: xs.map((x) => x >= 0),
  }
}
