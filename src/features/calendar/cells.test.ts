import type { Lane, Milestone, Todo } from '@/data/schema'
import {
  cellTint,
  colorOfLane,
  entriesByDay,
  entryId,
  NEUTRAL,
  unscheduledTodos,
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

describe('cellTint', () => {
  const tintOf = (todos: Todo[], milestones: Milestone[] = []) =>
    cellTint(entriesByDay(data({ todos, milestones })).get('2026-11-12') ?? [], lanes)

  it('is plain (null) with nothing on the day', () => expect(cellTint([], lanes)).toBeNull())

  it('is plain with only finished todos', () => {
    expect(tintOf([todo({ done: true, laneId: 'l1' })])).toBeNull()
  })

  it('is plain with only a milestone', () => expect(tintOf([], [milestone()])).toBeNull())

  it('takes the lane colour of the first unfinished todo', () => {
    expect(tintOf([todo({ laneId: 'l2' })])).toBe('teal')
  })

  it('goes by sorted order: the earlier lane wins over the later one', () => {
    expect(tintOf([todo({ laneId: 'l2' }), todo({ laneId: 'l1' })])).toBe('iris')
  })

  it('is neutral when the first unfinished todo has no lane', () => {
    expect(tintOf([todo({ laneId: null })])).toBe(NEUTRAL)
  })

  it('skips a finished todo to find the first unfinished one', () => {
    expect(tintOf([todo({ done: true, laneId: 'l1' }), todo({ laneId: 'l2' })])).toBe('teal')
  })

  it('puts a todo with a lane ahead of one without, so the lane colour wins', () => {
    expect(tintOf([todo({ laneId: null }), todo({ laneId: 'l2' })])).toBe('teal')
  })

  it('changes when the first unfinished todo is finished', () => {
    const a = todo({ laneId: 'l1' })
    const b = todo({ laneId: 'l2' })
    expect(tintOf([a, b])).toBe('iris')
    expect(tintOf([{ ...a, done: true }, b])).toBe('teal')
    expect(
      tintOf([
        { ...a, done: true },
        { ...b, done: true },
      ]),
    ).toBeNull()
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
