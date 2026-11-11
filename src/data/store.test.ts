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
  expect(s().data.phases[0]).toMatchObject({ name: '新阶段', tentative: false, note: '' })
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
