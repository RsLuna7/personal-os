import type { Lane, Milestone, Todo } from '@/data/schema'
import {
  colorOfLane,
  entriesByDay,
  entryId,
  NEUTRAL,
  unscheduledTodos,
  visibleEntries,
  type CalendarData,
  type DayEntry,
} from './cells'

const lanes: Lane[] = [
  { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
  { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
]

let counter = 0
function todo(patch: Partial<Todo> = {}): Todo {
  counter += 1
  return {
    id: `t${counter}`,
    title: `待办${counter}`,
    date: '2026-11-12',
    done: false,
    laneId: null,
    createdAt: `2026-11-10T08:${String(counter).padStart(2, '0')}:00.000Z`,
    ...patch,
  }
}

function milestone(patch: Partial<Milestone> = {}): Milestone {
  counter += 1
  return {
    id: `m${counter}`,
    laneId: 'l1',
    name: '节点',
    date: '2026-11-12',
    done: false,
    note: '',
    ...patch,
  }
}

const data = (patch: Partial<CalendarData> = {}): CalendarData => ({
  lanes,
  milestones: [],
  todos: [],
  ...patch,
})

const ids = (entries: DayEntry[] | undefined) => (entries ?? []).map(entryId)

describe('entriesByDay', () => {
  it('groups by date and leaves out undated todos', () => {
    const a = todo({ date: '2026-11-12' })
    const b = todo({ date: '2026-11-13' })
    const c = todo({ date: null })
    const byDay = entriesByDay(data({ todos: [a, b, c] }))
    expect([...byDay.keys()].sort()).toEqual(['2026-11-12', '2026-11-13'])
    expect(ids(byDay.get('2026-11-12'))).toEqual([a.id])
  })

  it('puts milestones before todos', () => {
    const t = todo()
    const m = milestone()
    expect(ids(entriesByDay(data({ todos: [t], milestones: [m] })).get('2026-11-12'))).toEqual([
      m.id,
      t.id,
    ])
  })

  it('orders todos: unfinished first, then lane order, lane-less last, then creation time', () => {
    const noLane = todo({ title: '无板块', createdAt: '2026-11-10T01:00:00.000Z' })
    const second = todo({ laneId: 'l2', createdAt: '2026-11-10T01:00:00.000Z' })
    const firstLate = todo({ laneId: 'l1', createdAt: '2026-11-10T09:00:00.000Z' })
    const firstEarly = todo({ laneId: 'l1', createdAt: '2026-11-10T02:00:00.000Z' })
    const doneFirstLane = todo({ laneId: 'l1', done: true, createdAt: '2026-11-10T00:00:00.000Z' })
    const byDay = entriesByDay(
      data({ todos: [doneFirstLane, noLane, firstLate, second, firstEarly] }),
    )
    expect(ids(byDay.get('2026-11-12'))).toEqual([
      firstEarly.id,
      firstLate.id,
      second.id,
      noLane.id,
      doneFirstLane.id,
    ])
  })

  it('breaks a full tie by id and does not change the input', () => {
    const b = todo({ id: 'b', createdAt: '2026-11-10T00:00:00.000Z' })
    const a = todo({ id: 'a', createdAt: '2026-11-10T00:00:00.000Z' })
    const input = [b, a]
    expect(ids(entriesByDay(data({ todos: input })).get('2026-11-12'))).toEqual(['a', 'b'])
    expect(input).toEqual([b, a])
  })
})

describe('colorOfLane', () => {
  it('uses the lane colour, or neutral without a lane', () => {
    expect(colorOfLane(lanes, 'l2')).toBe('teal')
    expect(colorOfLane(lanes, null)).toBe(NEUTRAL)
    expect(colorOfLane(lanes, 'gone')).toBe(NEUTRAL)
  })
})

describe('unscheduledTodos', () => {
  it('lists only undated todos, unfinished first', () => {
    const open = todo({ date: null })
    const done = todo({ date: null, done: true, createdAt: '2026-11-01T00:00:00.000Z' })
    const dated = todo({ date: '2026-11-12' })
    expect(unscheduledTodos(data({ todos: [done, dated, open] })).map((t) => t.id)).toEqual([
      open.id,
      done.id,
    ])
  })
})

describe('visibleEntries', () => {
  const day = (n: number) =>
    Array.from({ length: n }, (_, index): DayEntry => ({
      kind: 'todo',
      todo: todo({ id: `x${index}`, title: `事${index}` }),
    }))
  const ids = (entries: DayEntry[]) => entries.map(entryId)

  it('shows everything up to the cap', () => {
    const { shown, hidden } = visibleEntries(day(3))
    expect(shown).toHaveLength(3)
    expect(hidden).toBe(0)
  })

  it('shows the first three and counts the rest', () => {
    const { shown, hidden } = visibleEntries(day(8))
    expect(ids(shown)).toEqual(['x0', 'x1', 'x2'])
    expect(hidden).toBe(5)
  })

  it('always shows a pinned entry, which takes the last visible place', () => {
    const { shown, hidden } = visibleEntries(day(8), ['x6'])
    expect(ids(shown)).toEqual(['x0', 'x1', 'x6'])
    expect(hidden).toBe(5)
  })

  it('keeps entries in their original order and ignores empty pins', () => {
    const { shown } = visibleEntries(day(8), [null, undefined, 'x4', 'x7'])
    expect(ids(shown)).toEqual(['x0', 'x4', 'x7'])
  })

  it('does not change anything for a pin that is already visible', () => {
    expect(ids(visibleEntries(day(8), ['x1']).shown)).toEqual(['x0', 'x1', 'x2'])
  })

  it('shows an extra entry when every visible place is pinned', () => {
    const { shown } = visibleEntries(day(8), ['x0', 'x1', 'x2', 'x5'])
    expect(ids(shown)).toEqual(['x0', 'x1', 'x2', 'x5'])
  })
})
