import { createSampleData } from './sample'
import { appDataSchema } from './schema'

it('produces valid data around the given day', () => {
  const data = createSampleData('2026-11-10')
  expect(appDataSchema.safeParse(data).success).toBe(true)
  expect(data.lanes.length).toBeGreaterThanOrEqual(3)
  expect(data.phases.some((p) => p.tentative)).toBe(true)
  expect(data.milestones.length).toBeGreaterThanOrEqual(2)
  expect(data.terms.length).toBeGreaterThanOrEqual(2)
})

it('includes a finished phase and one in progress', () => {
  const today = '2026-11-10'
  const data = createSampleData(today)
  expect(data.phases.some((p) => p.end <= today)).toBe(true)
  expect(data.phases.some((p) => p.start <= today && today < p.end && !p.tentative)).toBe(true)
})

it('starts every phase on a Monday', () => {
  for (const p of createSampleData('2026-11-10').phases)
    expect(new Date(`${p.start}T00:00:00Z`).getUTCDay()).toBe(1)
})

it('gives every lane a note and at least one link, all fictional https urls', () => {
  for (const lane of createSampleData('2026-11-10').lanes) {
    expect(lane.note.length).toBeGreaterThan(0)
    expect(lane.links.length).toBeGreaterThanOrEqual(1)
    for (const link of lane.links) expect(link.url).toMatch(/^https:\/\/example\.(com|org)\//)
  }
})

it('includes todos of every kind: dated, undated, finished, on a lane and without one', () => {
  const todos = createSampleData('2026-11-10').todos
  expect(todos.some((todo) => todo.date !== null)).toBe(true)
  expect(todos.some((todo) => todo.date === null)).toBe(true)
  expect(todos.some((todo) => todo.done)).toBe(true)
  expect(todos.some((todo) => todo.laneId !== null)).toBe(true)
  expect(todos.some((todo) => todo.laneId === null)).toBe(true)
})

it('puts a crowded day in the sample so the overflow can be seen', () => {
  const counts = new Map<string, number>()
  for (const todo of createSampleData('2026-11-10').todos)
    if (todo.date) counts.set(todo.date, (counts.get(todo.date) ?? 0) + 1)
  expect(Math.max(...counts.values())).toBeGreaterThan(3)
})

it('keeps todo dates relative to the given day and does not read the clock', () => {
  const a = createSampleData('2026-11-10').todos.map((todo) => todo.date)
  const b = createSampleData('2027-03-01').todos.map((todo) => todo.date)
  expect(a).not.toEqual(b)
  expect(createSampleData('2026-11-10')).toEqual(createSampleData('2026-11-10'))
})

it('includes a few habits with checks', () => {
  const data = createSampleData('2026-11-10')
  expect(data.habits.length).toBeGreaterThanOrEqual(2)
  expect(data.habits.some((h) => h.checks.length > 0)).toBe(true)
})
