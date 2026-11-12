import { createEmptyData } from './schema'
import { HISTORY_LIMIT, useStore } from './store'

const s = () => useStore.getState()

beforeEach(() => s().hydrate(createEmptyData()))

it('adds lanes with the first unused colour and sequential order', () => {
  const a = s().addLane('考研')
  const b = s().addLane()
  expect(s().data.lanes.map((l) => [l.id, l.name, l.color, l.order])).toEqual([
    [a, '考研', 'iris', 0],
    [b, '新板块', 'tomato', 1],
  ])
})
it('cycles colours once all eight are used', () => {
  for (let i = 0; i < 9; i++) s().addLane()
  expect(s().data.lanes[8].color).toBe('iris')
})
it('removes a lane together with its phases and milestones', () => {
  const l = s().addLane()
  s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().addMilestone({ laneId: l, date: '2026-12-19' })
  s().removeLane(l)
  expect([s().data.lanes, s().data.phases, s().data.milestones]).toEqual([[], [], []])
})
it('closes the gap in order after removing a lane', () => {
  const a = s().addLane()
  s().addLane()
  s().removeLane(a)
  expect(s().data.lanes.map((l) => l.order)).toEqual([0])
})
it('adds phases and milestones with default names', () => {
  const l = s().addLane()
  s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().addMilestone({ laneId: l, date: '2026-12-19' })
  expect(s().data.phases[0]).toMatchObject({
    name: '新阶段',
    tentative: false,
    done: false,
    note: '',
  })
  expect(s().data.milestones[0]).toMatchObject({ name: '新节点', note: '' })
})
it('undoes and redoes', () => {
  const l = s().addLane()
  s().updateLane(l, { name: '四级' })
  s().undo()
  expect(s().data.lanes[0].name).toBe('新板块')
  s().redo()
  expect(s().data.lanes[0].name).toBe('四级')
})
it('restores a removed lane with its children in one undo', () => {
  const l = s().addLane()
  s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().removeLane(l)
  s().undo()
  expect(s().data.lanes).toHaveLength(1)
  expect(s().data.phases).toHaveLength(1)
})
it('clears redo after a new change', () => {
  s().addLane()
  s().undo()
  s().addLane()
  expect(s().future).toEqual([])
})
it('does not record a no-op update', () => {
  const l = s().addLane()
  const n = s().past.length
  s().updateLane(l, { name: '新板块' })
  expect(s().past.length).toBe(n)
})
it('keeps at most 100 history entries', () => {
  for (let i = 0; i < 130; i++) s().addLane()
  expect(s().past.length).toBe(HISTORY_LIMIT)
  expect(HISTORY_LIMIT).toBe(100)
})
it('swaps order when moving a lane and ignores moves past the edge', () => {
  const a = s().addLane()
  const b = s().addLane()
  s().moveLane(b, -1)
  expect(s().data.lanes.find((l) => l.id === b)!.order).toBe(0)
  const n = s().past.length
  s().moveLane(b, -1)
  expect(s().past.length).toBe(n)
  expect(s().data.lanes.find((l) => l.id === a)!.order).toBe(1)
})
it('rejects a patch that would make the data invalid', () => {
  const l = s().addLane()
  const p = s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  expect(() => s().updatePhase(p, { end: '2026-11-09' })).toThrow()
  expect(s().data.phases[0].end).toBe('2026-12-07')
})
it('clears the selection when its target is removed', () => {
  const l = s().addLane()
  const p = s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().select({ kind: 'phase', id: p })
  s().removePhase(p)
  expect(s().selection).toBeNull()
})
it('clears the selection when undo removes its target', () => {
  const l = s().addLane()
  const p = s().addPhase({ laneId: l, start: '2026-11-09', end: '2026-12-07' })
  s().select({ kind: 'phase', id: p })
  s().undo()
  expect(s().selection).toBeNull()
})
it('replaces terms in one undoable step', () => {
  s().setTerms([{ id: 't1', name: '大三上', start: '2026-09-07', end: '2027-01-18' }])
  expect(s().data.terms).toHaveLength(1)
  s().undo()
  expect(s().data.terms).toEqual([])
})
it('replaceData can be undone', () => {
  const l = s().addLane()
  s().replaceData(createEmptyData())
  expect(s().data.lanes).toEqual([])
  s().undo()
  expect(s().data.lanes[0].id).toBe(l)
})
it('hydrate replaces data and clears history', () => {
  s().addLane()
  s().hydrate(createEmptyData())
  expect([s().past, s().future]).toEqual([[], []])
})
it('markExported does not create an undo step', () => {
  const n = s().past.length
  s().markExported('2026-11-10T00:00:00.000Z')
  expect(s().past.length).toBe(n)
  expect(s().data.lastExportAt).toBe('2026-11-10T00:00:00.000Z')
})
it('keeps the export time when undoing an earlier change', () => {
  s().addLane()
  s().markExported('2026-11-10T00:00:00.000Z')
  s().undo()
  expect(s().data.lastExportAt).toBe('2026-11-10T00:00:00.000Z')
})

describe('lane notes and links', () => {
  const lane = () => s().data.lanes[0]

  it('creates new lanes with an empty note and no links', () => {
    s().addLane()
    expect(lane().note).toBe('')
    expect(lane().links).toEqual([])
  })

  it('adds a link with a normalized url and returns its id', () => {
    const laneId = s().addLane()
    const id = s().addLink(laneId, { title: '  真题  ', url: 'example.com' })
    expect(id).not.toBe('')
    expect(lane().links).toEqual([{ id, title: '真题', url: 'https://example.com/' }])
  })

  it.each([
    ['a javascript: url', { title: '坏', url: 'javascript:alert(1)' }],
    ['a data: url', { title: '坏', url: 'data:text/html,hi' }],
    ['an empty url', { title: '空', url: '  ' }],
    ['an empty title', { title: '   ', url: 'https://a.com' }],
    ['a 41 character title', { title: 'x'.repeat(41), url: 'https://a.com' }],
  ])('refuses to add a link with %s', (_, input) => {
    const laneId = s().addLane()
    const before = s().data
    expect(s().addLink(laneId, input)).toBe('')
    expect(s().data).toBe(before)
  })

  it('refuses a link for a lane that does not exist', () => {
    s().addLane()
    const before = s().data
    expect(s().addLink('missing', { title: 'x', url: 'https://a.com' })).toBe('')
    expect(s().data).toBe(before)
  })

  it('refuses the 51st link', () => {
    const laneId = s().addLane()
    for (let i = 0; i < 50; i++) s().addLink(laneId, { title: `l${i}`, url: 'https://a.com' })
    const before = s().data
    expect(lane().links).toHaveLength(50)
    expect(s().addLink(laneId, { title: '多了', url: 'https://a.com' })).toBe('')
    expect(s().data).toBe(before)
  })

  it('updates a link and normalizes the new url', () => {
    const laneId = s().addLane()
    const id = s().addLink(laneId, { title: '旧', url: 'https://a.com' })
    s().updateLink(laneId, id, { title: '新', url: 'b.com/x' })
    expect(lane().links[0]).toEqual({ id, title: '新', url: 'https://b.com/x' })
  })

  it('ignores an update that would make the link invalid', () => {
    const laneId = s().addLane()
    const id = s().addLink(laneId, { title: '好', url: 'https://a.com' })
    const before = s().data
    s().updateLink(laneId, id, { url: 'javascript:alert(1)' })
    s().updateLink(laneId, id, { title: '' })
    s().updateLink(laneId, id, { title: 'x'.repeat(41) })
    expect(s().data).toBe(before)
  })

  it('removes a link', () => {
    const laneId = s().addLane()
    const id = s().addLink(laneId, { title: '好', url: 'https://a.com' })
    s().removeLink(laneId, id)
    expect(lane().links).toEqual([])
  })

  it('changes the note, and ignores one longer than 2000 characters', () => {
    const laneId = s().addLane()
    s().updateLane(laneId, { note: '目标：上岸' })
    expect(lane().note).toBe('目标：上岸')
    const before = s().data
    s().updateLane(laneId, { note: 'x'.repeat(2001), name: '不该生效' })
    expect(s().data).toBe(before)
    s().updateLane(laneId, { note: 'x'.repeat(2000) })
    expect(lane().note).toHaveLength(2000)
  })

  it('records each change as one undo step and can redo it', () => {
    const laneId = s().addLane()
    const id = s().addLink(laneId, { title: '好', url: 'https://a.com' })
    s().updateLink(laneId, id, { title: '改' })
    s().updateLane(laneId, { note: '备注' })
    s().removeLink(laneId, id)

    s().undo()
    expect(lane().links).toHaveLength(1)
    s().undo()
    expect(lane().note).toBe('')
    s().undo()
    expect(lane().links[0].title).toBe('好')
    s().undo()
    expect(lane().links).toEqual([])
    s().redo()
    expect(lane().links).toHaveLength(1)
  })

  it('takes a lane links and note with it when the lane is removed, and brings them back on undo', () => {
    const laneId = s().addLane()
    s().addLink(laneId, { title: '好', url: 'https://a.com' })
    s().updateLane(laneId, { note: '备注' })
    s().removeLane(laneId)
    expect(s().data.lanes).toEqual([])
    s().undo()
    expect(lane().note).toBe('备注')
    expect(lane().links).toHaveLength(1)
  })
})

describe('todos', () => {
  const todos = () => s().data.todos

  it('adds an undated todo without a lane by default', () => {
    const id = s().addTodo()
    expect(todos()).toEqual([
      {
        id,
        title: '新待办',
        date: null,
        done: false,
        laneId: null,
        createdAt: expect.any(String),
      },
    ])
    expect(Number.isNaN(Date.parse(todos()[0].createdAt))).toBe(false)
  })

  it('adds a todo with a title, a date and a lane', () => {
    const laneId = s().addLane('考研')
    const id = s().addTodo({ title: '写周报', date: '2026-11-12', laneId })
    expect(todos()[0]).toMatchObject({ id, title: '写周报', date: '2026-11-12', laneId })
  })

  it('refuses a todo on a lane that does not exist', () => {
    const before = s().data
    expect(() => s().addTodo({ laneId: 'missing' })).toThrow()
    expect(s().data).toBe(before)
  })

  it('updates, toggles and removes, each as one undo step', () => {
    const id = s().addTodo({ title: '甲' })
    const n = s().past.length
    s().updateTodo(id, { title: '乙', date: '2026-11-12' })
    s().toggleTodo(id)
    s().removeTodo(id)
    expect(todos()).toEqual([])
    expect(s().past.length).toBe(n + 3)
    s().undo()
    expect(todos()[0]).toMatchObject({ title: '乙', date: '2026-11-12', done: true })
    s().undo()
    expect(todos()[0].done).toBe(false)
    s().undo()
    expect(todos()[0]).toMatchObject({ title: '甲', date: null })
    s().redo()
    expect(todos()[0].title).toBe('乙')
  })

  it('moves several todos to one date as a single undo step', () => {
    const a = s().addTodo({ title: '甲', date: '2026-11-09' })
    const b = s().addTodo({ title: '乙', date: '2026-11-10' })
    s().addTodo({ title: '丙', date: '2026-11-11' })
    const n = s().past.length
    s().moveTodos([a, b], '2026-11-12')
    expect(todos().map((todo) => todo.date)).toEqual(['2026-11-12', '2026-11-12', '2026-11-11'])
    expect(s().past.length).toBe(n + 1)
    s().undo()
    expect(todos().map((todo) => todo.date)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11'])
    s().moveTodos(['missing'], '2026-11-12')
    expect(s().past.length).toBe(n)
  })

  it('clears a date with null and does not record a no-op', () => {
    const id = s().addTodo({ date: '2026-11-12' })
    s().updateTodo(id, { date: null })
    expect(todos()[0].date).toBeNull()
    const n = s().past.length
    s().updateTodo(id, { date: null })
    s().toggleTodo('missing')
    expect(s().past.length).toBe(n)
  })

  it('rejects an invalid patch and leaves the data alone', () => {
    const id = s().addTodo()
    const before = s().data
    expect(() => s().updateTodo(id, { title: '   ' })).toThrow()
    expect(() => s().updateTodo(id, { date: '2026-02-30' })).toThrow()
    expect(() => s().updateTodo(id, { laneId: 'missing' })).toThrow()
    expect(s().data).toBe(before)
  })

  it('keeps todos when their lane is removed: they lose the lane instead', () => {
    const laneId = s().addLane()
    const id = s().addTodo({ title: '留下', laneId })
    const other = s().addTodo({ title: '无关' })
    s().removeLane(laneId)
    expect(todos().map((todo) => [todo.id, todo.laneId])).toEqual([
      [id, null],
      [other, null],
    ])
  })

  it('restores the lane and the todo link in a single undo', () => {
    const laneId = s().addLane()
    const id = s().addTodo({ laneId })
    const n = s().past.length
    s().removeLane(laneId)
    expect(s().past.length).toBe(n + 1)
    s().undo()
    expect(s().data.lanes).toHaveLength(1)
    expect(todos().find((todo) => todo.id === id)!.laneId).toBe(laneId)
  })

  it('is replaced as a whole by replaceData, and that can be undone', () => {
    s().addTodo({ title: '甲' })
    s().replaceData(createEmptyData())
    expect(todos()).toEqual([])
    s().undo()
    expect(todos()).toHaveLength(1)
  })
})

describe('habits', () => {
  it('adds a daily habit with no lane by default', () => {
    const id = s().addHabit()
    expect(s().data.habits).toEqual([
      expect.objectContaining({
        id,
        name: '新习惯',
        laneId: null,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        checks: [],
      }),
    ])
  })
  it('toggles a check on and off', () => {
    const id = s().addHabit()
    s().toggleCheck(id, '2026-11-12')
    expect(s().data.habits[0].checks).toEqual(['2026-11-12'])
    s().toggleCheck(id, '2026-11-12')
    expect(s().data.habits[0].checks).toEqual([])
  })
  it('keeps checks sorted', () => {
    const id = s().addHabit()
    s().toggleCheck(id, '2026-11-12')
    s().toggleCheck(id, '2026-11-10')
    expect(s().data.habits[0].checks).toEqual(['2026-11-10', '2026-11-12'])
  })
  it('ignores a check for a missing habit', () => {
    s().addHabit()
    const before = s().past.length
    s().toggleCheck('missing', '2026-11-12')
    expect(s().past.length).toBe(before)
  })
  it('stores weekdays sorted and unique', () => {
    const id = s().addHabit()
    s().updateHabit(id, { weekdays: [5, 1, 5, 3] })
    expect(s().data.habits[0].weekdays).toEqual([1, 3, 5])
  })
  it('ignores an update that leaves no weekday', () => {
    const id = s().addHabit()
    s().updateHabit(id, { weekdays: [] })
    expect(s().data.habits[0].weekdays).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
  it('renames and links a habit to a lane', () => {
    const l = s().addLane()
    const id = s().addHabit({ name: '跑步' })
    s().updateHabit(id, { name: '晨跑', laneId: l })
    expect(s().data.habits[0]).toMatchObject({ name: '晨跑', laneId: l })
  })
  it('removes a habit and undo brings it back', () => {
    const id = s().addHabit()
    s().removeHabit(id)
    expect(s().data.habits).toEqual([])
    s().undo()
    expect(s().data.habits.map((h) => h.id)).toEqual([id])
  })
  it('each habit action is one undo step', () => {
    const id = s().addHabit()
    s().toggleCheck(id, '2026-11-12')
    s().undo()
    expect(s().data.habits[0].checks).toEqual([])
  })
  it('unlinks habits from a removed lane', () => {
    const l = s().addLane()
    s().addHabit({ laneId: l })
    s().removeLane(l)
    expect(s().data.habits[0].laneId).toBeNull()
  })
})
