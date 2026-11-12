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
  done: false,
  note: '',
}
const todo = {
  id: 't1',
  title: '写周报',
  date: '2026-11-12',
  done: false,
  laneId: 'l1',
  createdAt: '2026-11-10T08:00:00.000Z',
}
const milestone = {
  id: 'm1',
  laneId: 'l1',
  name: '初试',
  date: '2026-12-19',
  done: false,
  note: '',
}

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

it.each([
  ['a dated todo on a lane', { ...todo }],
  ['an undated todo', { ...todo, date: null }],
  ['a todo without a lane', { ...todo, laneId: null }],
  ['a finished todo', { ...todo, done: true }],
])('accepts %s', (_, value) =>
  expect(appDataSchema.safeParse({ ...base, lanes: [lane], todos: [value] }).success).toBe(true),
)

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
  ['a newer schema version', { ...base, schemaVersion: 6 }],
  ['the old schema version', { ...base, schemaVersion: 1 }],
  ['an older schema version', { ...base, schemaVersion: 2 }],
  ['the previous schema version', { ...base, schemaVersion: 4 }],
  [
    'a phase with a non-boolean done',
    { ...base, lanes: [lane], phases: [{ ...phase, done: 'yes' }] },
  ],
  [
    'a milestone with a non-boolean done',
    { ...base, lanes: [lane], milestones: [{ ...milestone, done: 1 }] },
  ],
  ['data without todos', { ...base, todos: undefined }],
  ['a todo pointing at a missing lane', { ...base, todos: [todo] }],
  [
    'a todo without a date field',
    { ...base, lanes: [lane], todos: [{ ...todo, date: undefined }] },
  ],
  [
    'a todo without a lane field',
    { ...base, lanes: [lane], todos: [{ ...todo, laneId: undefined }] },
  ],
  [
    'a todo with an impossible date',
    { ...base, lanes: [lane], todos: [{ ...todo, date: '2026-02-30' }] },
  ],
  ['a todo with an empty title', { ...base, lanes: [lane], todos: [{ ...todo, title: '  ' }] }],
  [
    'a todo title longer than 40',
    { ...base, lanes: [lane], todos: [{ ...todo, title: 'x'.repeat(41) }] },
  ],
  ['a todo with a non-boolean done', { ...base, lanes: [lane], todos: [{ ...todo, done: 1 }] }],
  [
    'a todo with an unreadable creation time',
    { ...base, lanes: [lane], todos: [{ ...todo, createdAt: 'yesterday' }] },
  ],
  ['two todos with the same id', { ...base, lanes: [lane], todos: [todo, todo] }],
  ['a todo whose id is a lane id', { ...base, lanes: [lane], todos: [{ ...todo, id: 'l1' }] }],
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

describe('habits', () => {
  const habit = {
    id: 'h1',
    name: '背单词',
    laneId: 'l1',
    weekdays: [1, 3, 5],
    checks: ['2026-11-09', '2026-11-11'],
    createdAt: '2026-11-01T08:00:00.000Z',
  }
  const withHabit = (overrides: object) => ({
    ...base,
    lanes: [lane],
    habits: [{ ...habit, ...overrides }],
  })

  it('accepts a valid habit', () =>
    expect(appDataSchema.safeParse(withHabit({})).success).toBe(true))
  it.each([[[]], [[0]], [[8]], [[1, 1]], [[1.5]]])('rejects weekdays %j', (weekdays) =>
    expect(appDataSchema.safeParse(withHabit({ weekdays })).success).toBe(false),
  )
  it('rejects duplicate check dates', () =>
    expect(
      appDataSchema.safeParse(withHabit({ checks: ['2026-11-09', '2026-11-09'] })).success,
    ).toBe(false))
  it('rejects an invalid check date', () =>
    expect(appDataSchema.safeParse(withHabit({ checks: ['2026-02-30'] })).success).toBe(false))
  it('rejects a habit pointing at a missing lane', () =>
    expect(appDataSchema.safeParse(withHabit({ laneId: 'missing' })).success).toBe(false))
  it('rejects a habit whose id clashes with a todo', () =>
    expect(appDataSchema.safeParse({ ...withHabit({ id: 't1' }), todos: [todo] }).success).toBe(
      false,
    ))
})
