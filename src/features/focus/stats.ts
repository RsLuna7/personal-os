import { LANE_COLORS, type FocusSession, type LaneColor } from '@/data/schema'
import { toDay, todayISO } from '@/features/timeline/days'
import { mondayOf, WEEK } from '@/features/timeline/snap'

const MINUTE_MS = 60_000

/** 记录算在开始那一刻、使用者本地日历上的那一天；跨零点的一轮不拆分。 */
export function sessionDay(session: FocusSession): number {
  return toDay(todayISO(new Date(session.startAt)))
}

/** 那一天的记录，新的在前。 */
export function sessionsOn(sessions: FocusSession[], day: number): FocusSession[] {
  return sessions
    .filter((session) => sessionDay(session) === day)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
}

export function totalMs(sessions: FocusSession[]): number {
  return sessions.reduce((sum, session) => sum + session.focusMs, 0)
}

/** 每天专注的总毫秒数，键是整日数。 */
export function dayTotals(sessions: FocusSession[]): Map<number, number> {
  const totals = new Map<number, number>()
  for (const session of sessions) {
    const day = sessionDay(session)
    totals.set(day, (totals.get(day) ?? 0) + session.focusMs)
  }
  return totals
}

/** 0：没有；1：不到 30 分钟；2：30–59；3：60–119；4：120 分钟以上。 */
export type HeatLevel = 0 | 1 | 2 | 3 | 4

export function heatLevel(minutes: number): HeatLevel {
  if (minutes >= 120) return 4
  if (minutes >= 60) return 3
  if (minutes >= 30) return 2
  return minutes >= 1 ? 1 : 0
}

export interface HeatCell {
  day: number
  minutes: number
  level: HeatLevel
  /** 今天之后的格子，不画 */
  future: boolean
}

export interface Heatmap {
  /** 每列一周，每周 7 格，周一在上；最后一列是本周 */
  columns: HeatCell[][]
  /** 月份标签：放在第几列 */
  months: { column: number; month: number }[]
}

export const HEATMAP_WEEKS = 26

/** 最近 weeks 周（含本周）的日历热力图：每天专注的总分钟数。 */
export function heatmap(
  sessions: FocusSession[],
  today: number,
  weeks: number = HEATMAP_WEEKS,
): Heatmap {
  const totals = dayTotals(sessions)
  const first = mondayOf(today) - (weeks - 1) * WEEK
  const columns: HeatCell[][] = []
  for (let column = 0; column < weeks; column++) {
    const cells: HeatCell[] = []
    for (let row = 0; row < WEEK; row++) {
      const day = first + column * WEEK + row
      const minutes = Math.round((totals.get(day) ?? 0) / MINUTE_MS)
      cells.push({ day, minutes, level: heatLevel(minutes), future: day > today })
    }
    columns.push(cells)
  }

  // 每一列用它周四所在的月份（一周大半在哪个月就算哪个月），月份变了就在那一列标出来
  const monthOf = (column: number) =>
    new Date((first + column * WEEK + 3) * 86_400_000).getUTCMonth() + 1
  const months: Heatmap['months'] = []
  for (let column = 0; column < weeks; column++) {
    if (column === 0 || monthOf(column) !== monthOf(column - 1)) {
      months.push({ column, month: monthOf(column) })
    }
  }
  // 第一列和第二列都要标时挤在一起放不下，去掉第一个
  if (months.length > 1 && months[1].column - months[0].column < 2) months.shift()
  return { columns, months }
}

export interface TagTotal {
  tag: string
  ms: number
  /** 相对本周最多的那个标签，0–1，横条的宽度用 */
  ratio: number
}

/** 本周（周一到周日）每个标签用了多少时间，多的在前。 */
export function weekByTag(sessions: FocusSession[], today: number): TagTotal[] {
  const monday = mondayOf(today)
  const totals = new Map<string, number>()
  for (const session of sessions) {
    const day = sessionDay(session)
    if (day < monday || day >= monday + WEEK) continue
    totals.set(session.tag, (totals.get(session.tag) ?? 0) + session.focusMs)
  }
  const rows = [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  const max = rows[0]?.[1] ?? 1
  return rows.map(([tag, ms]) => ({ tag, ms, ratio: ms / max }))
}

/** 历史标签，最近用过的在前，每个只出现一次。 */
export function recentTags(sessions: FocusSession[], limit = 8): string[] {
  const sorted = [...sessions].sort((a, b) => b.startAt.localeCompare(a.startAt))
  return [...new Set(sorted.map((session) => session.tag))].slice(0, limit)
}

/** 标签的颜色：由文字决定，同一个标签永远是同一条板块色带，不用存。 */
export function tagColor(tag: string): LaneColor {
  let hash = 0x811c9dc5
  for (const char of tag) {
    hash ^= char.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return LANE_COLORS[(hash >>> 0) % LANE_COLORS.length]
}

/** 1 时 25 分 / 25 分 / 不足 1 分 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / MINUTE_MS)
  if (minutes < 1) return '不足 1 分'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} 分`
  return rest === 0 ? `${hours} 时` : `${hours} 时 ${rest} 分`
}

/** 14:05 （本地时间） */
export function clockTime(iso: string): string {
  const date = new Date(iso)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
