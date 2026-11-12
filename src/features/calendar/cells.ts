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

/** 没有日期的待办：未完成的在前，其余顺序同上。 */
export function unscheduledTodos(data: CalendarData): Todo[] {
  return data.todos.filter((todo) => todo.date === null).sort(todoComparator(data.lanes))
}
