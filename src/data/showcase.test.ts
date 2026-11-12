import { toDay } from '@/features/timeline/days'
import { isIdle, summarizeLane, type LaneSummary } from '@/features/home/summary'
import { createShowcaseData } from './showcase'
import { appDataSchema } from './schema'

const TODAY = '2026-11-12'

it('produces valid data', () => {
  expect(appDataSchema.safeParse(createShowcaseData(TODAY)).success).toBe(true)
})

it('is a full semester: many lanes, phases, milestones, terms and todos', () => {
  const data = createShowcaseData(TODAY)
  expect(data.lanes.length).toBeGreaterThanOrEqual(6)
  expect(data.phases.length).toBeGreaterThanOrEqual(18)
  expect(data.milestones.length).toBeGreaterThanOrEqual(15)
  expect(data.terms).toHaveLength(3)
  expect(data.todos.length).toBeGreaterThanOrEqual(15)
})

it('uses distinct lane colours', () => {
  const colors = createShowcaseData(TODAY).lanes.map((lane) => lane.color)
  expect(new Set(colors).size).toBe(colors.length)
})

it('starts and ends every phase on a Monday', () => {
  for (const p of createShowcaseData(TODAY).phases) {
    expect(new Date(`${p.start}T00:00:00Z`).getUTCDay()).toBe(1)
    expect(new Date(`${p.end}T00:00:00Z`).getUTCDay()).toBe(1)
  }
})

it('shows every phase state: finished, in progress, upcoming and tentative', () => {
  const data = createShowcaseData(TODAY)
  expect(data.phases.some((p) => p.done && p.end <= TODAY)).toBe(true)
  expect(data.phases.some((p) => p.start <= TODAY && TODAY < p.end && !p.tentative)).toBe(true)
  expect(data.phases.some((p) => p.start > TODAY && !p.tentative)).toBe(true)
  expect(data.phases.filter((p) => p.tentative).length).toBeGreaterThanOrEqual(2)
})

it('has parallel phases inside one lane', () => {
  const data = createShowcaseData(TODAY)
  const overlaps = data.phases.some((a) =>
    data.phases.some(
      (b) => a.id < b.id && a.laneId === b.laneId && a.start < b.end && b.start < a.end,
    ),
  )
  expect(overlaps).toBe(true)
})

it('has finished and open milestones, and one within a few days', () => {
  const data = createShowcaseData(TODAY)
  expect(data.milestones.some((m) => m.done)).toBe(true)
  const soonest = data.milestones
    .filter((m) => m.date >= TODAY)
    .map((m) => toDay(m.date) - toDay(TODAY))
    .sort((a, b) => a - b)[0]
  expect(soonest).toBeLessThanOrEqual(3)
})

it('puts at least five lanes in progress, one with nothing in progress, and one idle', () => {
  const data = createShowcaseData(TODAY)
  const summaries: LaneSummary[] = data.lanes.map((lane) =>
    summarizeLane(lane, data.phases, data.milestones, toDay(TODAY)),
  )
  expect(summaries.filter((s) => s.current).length).toBeGreaterThanOrEqual(5)
  expect(summaries.some((s) => !s.current && !isIdle(s))).toBe(true)
  expect(summaries.some(isIdle)).toBe(true)
  expect(summaries.some((s) => s.alsoActive.length > 0)).toBe(true)
})

it('gives every lane a note and uses https links only', () => {
  for (const lane of createShowcaseData(TODAY).lanes) {
    expect(lane.note.length).toBeGreaterThan(0)
    for (const link of lane.links) expect(link.url).toMatch(/^https:\/\//)
  }
})

it('covers every kind of todo and has a crowded day', () => {
  const todos = createShowcaseData(TODAY).todos
  expect(todos.some((t) => t.date !== null && t.date < TODAY && !t.done)).toBe(true)
  expect(todos.some((t) => t.date === TODAY && !t.done)).toBe(true)
  expect(todos.some((t) => t.date === TODAY && t.done)).toBe(true)
  expect(todos.some((t) => t.date !== null && t.date > TODAY)).toBe(true)
  expect(todos.some((t) => t.date === null)).toBe(true)
  expect(todos.some((t) => t.laneId === null)).toBe(true)
  const counts = new Map<string, number>()
  for (const t of todos) if (t.date) counts.set(t.date, (counts.get(t.date) ?? 0) + 1)
  expect(Math.max(...counts.values())).toBeGreaterThan(5)
})

it('keeps every date relative to the given day and does not read the clock', () => {
  const a = createShowcaseData('2026-11-12')
  const b = createShowcaseData('2027-03-01')
  expect(a.phases.map((p) => p.start)).not.toEqual(b.phases.map((p) => p.start))
  expect(createShowcaseData('2026-11-12')).toEqual(createShowcaseData('2026-11-12'))
})
