import type { AppData, ISODate, Lane } from '@/data/schema'
import { fromDay, toDay } from '@/features/timeline/days'
import { mondayOf, WEEK } from '@/features/timeline/snap'

export type ReviewKind = 'phase' | 'milestone' | 'todo'

export interface ReviewItem {
  kind: ReviewKind
  id: string
  name: string
  /** 节点和待办的日期，阶段的开始日期；排序用 */
  date: ISODate
  /** 阶段才有：最后一天（含当天） */
  lastDay?: ISODate
  /** 下周到期里，阶段是“开始”还是“结束”（或同一周内开始并结束） */
  tag?: '开始' | '结束' | '开始并结束'
}

export interface ReviewGroup {
  /** null 表示不挂板块的待办 */
  lane: Lane | null
  items: ReviewItem[]
}

export interface WeekReview {
  /** 这一周的周一 */
  weekStart: ISODate
  /** 这一周的周日（含） */
  weekEnd: ISODate
  /** 本周完成 */
  done: ReviewGroup[]
  /** 逾期未完成（相对今天，和选的是哪一周无关） */
  overdue: ReviewGroup[]
  /** 下周到期 */
  upcoming: ReviewGroup[]
}

/** 某一天所在那一周的周一。 */
export function weekStartOf(date: ISODate): ISODate {
  return fromDay(mondayOf(toDay(date)))
}

const KIND_ORDER: Record<ReviewKind, number> = { phase: 0, milestone: 1, todo: 2 }

function compareItems(a: ReviewItem, b: ReviewItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** 按板块分组：板块按 order 排，不挂板块的放最后；每组里按日期排。没有条目的板块不出现。 */
function group(lanes: Lane[], entries: { laneId: string | null; item: ReviewItem }[]) {
  const result: ReviewGroup[] = []
  const known = new Set(lanes.map((lane) => lane.id))
  for (const lane of [...lanes].sort((a, b) => a.order - b.order)) {
    const items = entries.filter((entry) => entry.laneId === lane.id).map((entry) => entry.item)
    if (items.length > 0) result.push({ lane, items: items.sort(compareItems) })
  }
  const loose = entries
    .filter((entry) => entry.laneId === null || !known.has(entry.laneId))
    .map((entry) => entry.item)
  if (loose.length > 0) result.push({ lane: null, items: loose.sort(compareItems) })
  return result
}

type Entry = { laneId: string | null; item: ReviewItem }

/**
 * 一周回顾。只读，不改数据。
 * 周是周一到周日；weekStart 不是周一时按它所在那一周算。
 * - 本周完成：已完成的节点和待办，日期落在这一周；已完成的阶段，时间段和这一周有重叠。
 * - 逾期未完成：没完成、日期（阶段是最后一天）早于今天的节点、待办和阶段。
 * - 下周到期：没完成的节点和待办，日期落在下一周；没完成的阶段，在下一周开始或结束。
 */
export function buildWeekReview(data: AppData, weekStart: ISODate, today: ISODate): WeekReview {
  const start = mondayOf(toDay(weekStart))
  const end = start + WEEK - 1
  const nextStart = start + WEEK
  const nextEnd = nextStart + WEEK - 1
  const todayDay = toDay(today)

  const done: Entry[] = []
  const overdue: Entry[] = []
  const upcoming: Entry[] = []

  for (const phase of data.phases) {
    const first = toDay(phase.start)
    // end 不含当天
    const last = toDay(phase.end) - 1
    const item: ReviewItem = {
      kind: 'phase',
      id: phase.id,
      name: phase.name,
      date: phase.start,
      lastDay: fromDay(last),
    }
    if (phase.done) {
      if (first <= end && last >= start) done.push({ laneId: phase.laneId, item })
      continue
    }
    if (last < todayDay) overdue.push({ laneId: phase.laneId, item })
    const starts = first >= nextStart && first <= nextEnd
    const ends = last >= nextStart && last <= nextEnd
    if (starts || ends) {
      const tag = starts && ends ? '开始并结束' : starts ? '开始' : '结束'
      upcoming.push({ laneId: phase.laneId, item: { ...item, tag } })
    }
  }

  for (const milestone of data.milestones) {
    const day = toDay(milestone.date)
    const item: ReviewItem = {
      kind: 'milestone',
      id: milestone.id,
      name: milestone.name,
      date: milestone.date,
    }
    if (milestone.done) {
      if (day >= start && day <= end) done.push({ laneId: milestone.laneId, item })
      continue
    }
    if (day < todayDay) overdue.push({ laneId: milestone.laneId, item })
    if (day >= nextStart && day <= nextEnd) upcoming.push({ laneId: milestone.laneId, item })
  }

  for (const todo of data.todos) {
    if (todo.date === null) continue
    const day = toDay(todo.date)
    const item: ReviewItem = { kind: 'todo', id: todo.id, name: todo.title, date: todo.date }
    if (todo.done) {
      if (day >= start && day <= end) done.push({ laneId: todo.laneId, item })
      continue
    }
    if (day < todayDay) overdue.push({ laneId: todo.laneId, item })
    if (day >= nextStart && day <= nextEnd) upcoming.push({ laneId: todo.laneId, item })
  }

  return {
    weekStart: fromDay(start),
    weekEnd: fromDay(end),
    done: group(data.lanes, done),
    overdue: group(data.lanes, overdue),
    upcoming: group(data.lanes, upcoming),
  }
}

export const countItems = (groups: ReviewGroup[]) =>
  groups.reduce((total, entry) => total + entry.items.length, 0)
