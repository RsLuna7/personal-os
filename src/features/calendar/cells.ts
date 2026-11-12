import type { ISODate, Lane, LaneColor, Milestone, Todo } from '@/data/schema'

/** 不挂板块的待办用的中性色，对应 tokens.css 里的 `[data-lane-color='neutral']`。 */
export const NEUTRAL = 'neutral'
export type EntryColor = LaneColor | typeof NEUTRAL

export interface CalendarData {
  lanes: Lane[]
  milestones: Milestone[]
  todos: Todo[]
}

export type DayEntry = { kind: 'milestone'; milestone: Milestone } | { kind: 'todo'; todo: Todo }

const UNKNOWN_LANE_ORDER = Number.MAX_SAFE_INTEGER

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function laneOrderOf(lanes: Lane[]): (laneId: string | null) => number {
  const laneOrder = new Map(lanes.map((lane) => [lane.id, lane.order]))
  return (laneId) => (laneId === null ? undefined : laneOrder.get(laneId)) ?? UNKNOWN_LANE_ORDER
}

/** 待办的顺序：未完成在前，其次板块顺序（不挂板块的最后）、创建时间、id。 */
function todoComparator(lanes: Lane[]): (a: Todo, b: Todo) => number {
  const orderOf = laneOrderOf(lanes)
  return (a, b) =>
    Number(a.done) - Number(b.done) ||
    orderOf(a.laneId) - orderOf(b.laneId) ||
    compareText(a.createdAt, b.createdAt) ||
    compareText(a.id, b.id)
}

/** 条目的颜色：挂板块用板块色，不挂（或板块找不到）用中性色。 */
export function colorOfLane(lanes: Lane[], laneId: string | null): EntryColor {
  return lanes.find((lane) => lane.id === laneId)?.color ?? NEUTRAL
}

/** 条目所属的筛选项：板块的 id；不挂板块（或板块找不到）是 NEUTRAL。 */
export function laneKey(lanes: Lane[], laneId: string | null): string {
  return lanes.some((lane) => lane.id === laneId) ? laneId! : NEUTRAL
}

/**
 * 只显示选中板块的待办和节点（`active` 为空表示不筛选）。`keepIds` 里的条目不受筛选影响：
 * 正在编辑、拖动的那一条要是被筛掉，编辑面板就找不到它了。
 */
export function filterByLanes(
  data: CalendarData,
  active: ReadonlySet<string>,
  keepIds: readonly (string | null | undefined)[] = [],
): CalendarData {
  if (active.size === 0) return data
  const keep = new Set(keepIds.filter((id): id is string => !!id))
  const shown = (id: string, laneId: string | null) =>
    keep.has(id) || active.has(laneKey(data.lanes, laneId))
  return {
    ...data,
    milestones: data.milestones.filter((item) => shown(item.id, item.laneId)),
    todos: data.todos.filter((item) => shown(item.id, item.laneId)),
  }
}

export function entryId(entry: DayEntry): string {
  return entry.kind === 'todo' ? entry.todo.id : entry.milestone.id
}

/**
 * 按天分组，每天内部排好序：
 * 节点在前（按板块顺序、再按 id）；待办在后，未完成的在前、已完成的在后，
 * 各自按板块顺序（不挂板块的排最后）、创建时间、id。没有日期的待办不在这里。
 */
export function entriesByDay(data: CalendarData): Map<ISODate, DayEntry[]> {
  const orderOf = laneOrderOf(data.lanes)

  const milestones = [...data.milestones].sort(
    (a, b) => orderOf(a.laneId) - orderOf(b.laneId) || compareText(a.id, b.id),
  )
  const todos = data.todos.filter((todo) => todo.date !== null).sort(todoComparator(data.lanes))

  const byDay = new Map<ISODate, DayEntry[]>()
  const push = (date: ISODate, entry: DayEntry) => {
    const list = byDay.get(date)
    if (list) list.push(entry)
    else byDay.set(date, [entry])
  }
  for (const milestone of milestones) push(milestone.date, { kind: 'milestone', milestone })
  for (const todo of todos) push(todo.date!, { kind: 'todo', todo })
  return byDay
}

/** 一格最多直接显示这么多条，其余收进“+N”，点开看全部。 */
export const MAX_VISIBLE = 3

/**
 * 一格里显示哪些条目：前 `MAX_VISIBLE` 条；正在编辑、正在拖动的那一条（`pinnedIds`）
 * 永远显示，哪怕它排在后面——不然新建的待办一出生就被藏起来，编辑面板也找不到它。
 * 钉住的条目占掉后面的位置，顺序不变。`hidden` 是没显示的条数。
 */
export function visibleEntries(
  entries: DayEntry[],
  pinnedIds: readonly (string | null | undefined)[] = [],
  cap: number = MAX_VISIBLE,
): { shown: DayEntry[]; hidden: number } {
  if (entries.length <= cap) return { shown: entries, hidden: 0 }
  const pinned = new Set(pinnedIds.filter((id): id is string => !!id))
  const isPinned = (entry: DayEntry) => pinned.has(entryId(entry))
  const chosen = entries.slice(0, cap)
  for (const entry of entries.slice(cap)) {
    if (!isPinned(entry)) continue
    // 挤掉最靠后的一条没钉住的；全是钉住的就多显示一条
    const victim = chosen.findLastIndex((item) => !isPinned(item))
    if (victim !== -1) chosen.splice(victim, 1)
    chosen.push(entry)
  }
  const shown = entries.filter((entry) => chosen.includes(entry))
  return { shown, hidden: entries.length - shown.length }
}

/** 没有日期的待办：未完成的在前，其余顺序同上。 */
export function unscheduledTodos(data: CalendarData): Todo[] {
  return data.todos.filter((todo) => todo.date === null).sort(todoComparator(data.lanes))
}
