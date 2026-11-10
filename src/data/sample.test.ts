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
