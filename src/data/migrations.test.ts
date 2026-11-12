import { appDataSchema } from './schema'
import { migrations, NewerVersionError, runMigrations, type Migration } from './migrations'

const registry: Record<number, Migration> = {
  0: (old) => ({ ...(old as object), schemaVersion: 1, terms: [] }),
}

it('runs migrations in order up to the target', () =>
  expect(runMigrations({ schemaVersion: 0, lanes: [] }, registry, 1)).toEqual({
    data: { schemaVersion: 1, lanes: [], terms: [] },
    from: 0,
  }))
it('leaves current data untouched', () =>
  expect(runMigrations({ schemaVersion: 1 }, registry, 1).from).toBe(1))
it('refuses data from a newer version', () =>
  expect(() => runMigrations({ schemaVersion: 2 }, registry, 1)).toThrow(NewerVersionError))
it('refuses data with no usable version', () => {
  expect(() => runMigrations({}, registry, 1)).toThrow()
  expect(() => runMigrations(null, registry, 1)).toThrow()
  expect(() => runMigrations({ schemaVersion: '1' }, registry, 1)).toThrow()
})
it('refuses when a migration step is missing', () =>
  expect(() => runMigrations({ schemaVersion: 0 }, {}, 1)).toThrow())

describe('migrations[1] (v1 to v2)', () => {
  const v1 = {
    schemaVersion: 1,
    lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0 }],
    phases: [],
    milestones: [],
    terms: [],
    lastExportAt: null,
  }

  it('adds an empty note and links to every lane and bumps the version', () => {
    const result = migrations[1](v1) as typeof v1 & { lanes: { note: string; links: unknown[] }[] }
    expect(result.schemaVersion).toBe(2)
    expect(result.lanes[0]).toEqual({ ...v1.lanes[0], note: '', links: [] })
  })

  it('produces data that passes the current schema once every step has run', () => {
    expect(appDataSchema.safeParse(runMigrations(v1, migrations, 5).data).success).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(v1)
    migrations[1](v1)
    expect(v1).toEqual(copy)
  })

  it('passes a non-array lanes value through for the schema to reject', () => {
    const broken = { ...v1, lanes: 'x' }
    const result = migrations[1](broken) as { lanes: unknown }
    expect(result.lanes).toBe('x')
    expect(appDataSchema.safeParse(result).success).toBe(false)
  })
})

describe('migrations[3] (v3 to v4)', () => {
  const v3 = {
    schemaVersion: 3,
    lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
    phases: [
      {
        id: 'p1',
        laneId: 'l1',
        name: '复习',
        start: '2026-11-01',
        end: '2026-11-08',
        tentative: false,
        note: '',
      },
    ],
    milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', note: '' }],
    terms: [],
    todos: [],
    lastExportAt: null,
  }

  it('marks every phase and milestone as not done and bumps the version', () => {
    const result = migrations[3](v3) as {
      schemaVersion: number
      phases: { done: boolean; name: string }[]
      milestones: { done: boolean; name: string }[]
    }
    expect(result.schemaVersion).toBe(4)
    expect(result.phases).toEqual([{ ...v3.phases[0], done: false }])
    expect(result.milestones).toEqual([{ ...v3.milestones[0], done: false }])
  })

  it('keeps a done value that is already there', () => {
    const result = migrations[3]({
      ...v3,
      phases: [{ ...v3.phases[0], done: true }],
    }) as { phases: { done: boolean }[] }
    expect(result.phases[0].done).toBe(true)
  })

  it('leaves non-array phases for validation to reject', () => {
    const result = migrations[3]({ ...v3, phases: 'x' })
    expect(appDataSchema.safeParse(result).success).toBe(false)
  })

  it('produces data that passes the current schema', () => {
    expect(appDataSchema.safeParse(runMigrations(v3, migrations, 5).data).success).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(v3)
    migrations[3](v3)
    expect(v3).toEqual(copy)
  })

  it('runs from version 3 up to the current version', () => {
    expect(runMigrations(v3, migrations, 5).from).toBe(3)
  })
})

describe('migrations[2] (v2 to v3)', () => {
  const v2 = {
    schemaVersion: 2,
    lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
    phases: [],
    milestones: [],
    terms: [],
    lastExportAt: null,
  }

  it('adds an empty todo list and bumps the version', () => {
    const result = migrations[2](v2) as typeof v2 & { todos: unknown[] }
    expect(result.schemaVersion).toBe(3)
    expect(result.todos).toEqual([])
    expect(result.lanes).toEqual(v2.lanes)
  })

  it('produces data that passes the current schema', () => {
    expect(appDataSchema.safeParse(runMigrations(v2, migrations, 5).data).success).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(v2)
    migrations[2](v2)
    expect(v2).toEqual(copy)
  })

  it('runs from version 2 up to the current version', () => {
    expect(runMigrations(v2, migrations, 5).from).toBe(2)
  })
})

describe('migrations[4] (v4 to v5)', () => {
  const v4 = {
    schemaVersion: 4,
    lanes: [],
    phases: [],
    milestones: [],
    terms: [],
    todos: [],
    lastExportAt: null,
  }

  it('adds an empty habit list', () => {
    const result = migrations[4](v4)
    expect(result).toEqual({ ...v4, schemaVersion: 5, habits: [] })
    expect(appDataSchema.safeParse(result).success).toBe(true)
  })

  it('keeps habits that are already there', () => {
    const habits = [
      {
        id: 'h1',
        name: '跑步',
        laneId: null,
        weekdays: [1],
        checks: [],
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ]
    expect((migrations[4]({ ...v4, habits }) as { habits: unknown }).habits).toEqual(habits)
  })
})
