import { appDataSchema, createEmptyData } from './schema'

const base = createEmptyData()
const lane = { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }
const link = { id: 'k1', title: '真题', url: 'https://example.com/a' }
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

it('accepts a lane with a note and links', () => {
  const data = { ...base, lanes: [{ ...lane, note: '目标：上岸', links: [link] }] }
  expect(appDataSchema.safeParse(data).success).toBe(true)
})

it('accepts exactly 50 links and a 2000 character note', () => {
  const links = Array.from({ length: 50 }, (_, i) => ({ ...link, id: `k${i}` }))
  const data = { ...base, lanes: [{ ...lane, note: 'x'.repeat(2000), links }] }
  expect(appDataSchema.safeParse(data).success).toBe(true)
})

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
  ['a newer schema version', { ...base, schemaVersion: 3 }],
  ['the old schema version', { ...base, schemaVersion: 1 }],
  ['a lane without a note', { ...base, lanes: [{ ...lane, note: undefined }] }],
  ['a lane without links', { ...base, lanes: [{ ...lane, links: undefined }] }],
  ['a lane note longer than 2000', { ...base, lanes: [{ ...lane, note: 'x'.repeat(2001) }] }],
  [
    'more than 50 links',
    {
      ...base,
      lanes: [{ ...lane, links: Array.from({ length: 51 }, (_, i) => ({ ...link, id: `k${i}` })) }],
    },
  ],
  [
    'a javascript: link',
    { ...base, lanes: [{ ...lane, links: [{ ...link, url: 'javascript:alert(1)' }] }] },
  ],
  [
    'a data: link',
    { ...base, lanes: [{ ...lane, links: [{ ...link, url: 'data:text/html,hi' }] }] },
  ],
  [
    'a link with an empty title',
    { ...base, lanes: [{ ...lane, links: [{ ...link, title: ' ' }] }] },
  ],
  [
    'a link title longer than 40',
    { ...base, lanes: [{ ...lane, links: [{ ...link, title: 'x'.repeat(41) }] }] },
  ],
  [
    'a link id shared with a phase',
    { ...base, lanes: [{ ...lane, links: [{ ...link, id: 'p1' }] }], phases: [phase] },
  ],
])('rejects %s', (_, data) => expect(appDataSchema.safeParse(data).success).toBe(false))
