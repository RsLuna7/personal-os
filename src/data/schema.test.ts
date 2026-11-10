import { appDataSchema, createEmptyData } from './schema'

const base = createEmptyData()
const lane = { id: 'l1', name: '考研', color: 'iris', order: 0 }
const phase = {
  id: 'p1',
  laneId: 'l1',
  name: '基础',
  start: '2026-11-09',
  end: '2027-06-28',
  tentative: false,
  note: '',
}
const milestone = { id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', note: '' }

it('accepts empty data', () => expect(appDataSchema.safeParse(base).success).toBe(true))

it('accepts a valid lane with a phase', () =>
  expect(appDataSchema.safeParse({ ...base, lanes: [lane], phases: [phase] }).success).toBe(true))

it('trims names', () => {
  const parsed = appDataSchema.parse({ ...base, lanes: [{ ...lane, name: '  考研 ' }] })
  expect(parsed.lanes[0].name).toBe('考研')
})

it.each([
  ['phase pointing at a missing lane', { ...base, phases: [phase] }],
  ['milestone pointing at a missing lane', { ...base, milestones: [milestone] }],
  [
    'phase whose start is not before end',
    { ...base, lanes: [lane], phases: [{ ...phase, end: phase.start }] },
  ],
  ['duplicate ids', { ...base, lanes: [lane, lane] }],
  [
    'an id shared by a lane and a phase',
    { ...base, lanes: [lane], phases: [{ ...phase, id: 'l1' }] },
  ],
  ['impossible date', { ...base, lanes: [lane], phases: [{ ...phase, start: '2026-02-30' }] }],
  ['malformed date', { ...base, lanes: [lane], phases: [{ ...phase, start: '2026-2-3' }] }],
  ['unknown colour', { ...base, lanes: [{ ...lane, color: 'neon' }] }],
  ['name longer than 40', { ...base, lanes: [{ ...lane, name: 'x'.repeat(41) }] }],
  ['empty name', { ...base, lanes: [{ ...lane, name: '   ' }] }],
  [
    'note longer than 2000',
    { ...base, lanes: [lane], phases: [{ ...phase, note: 'x'.repeat(2001) }] },
  ],
  [
    'term whose start is not before end',
    { ...base, terms: [{ id: 't1', name: '大三上', start: '2027-01-10', end: '2027-01-10' }] },
  ],
  ['wrong schema version', { ...base, schemaVersion: 2 }],
])('rejects %s', (_, data) => expect(appDataSchema.safeParse(data).success).toBe(false))
