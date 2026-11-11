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
    expect(appDataSchema.safeParse(migrations[2](migrations[1](v1))).success).toBe(true)
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
    expect(appDataSchema.safeParse(migrations[2](v2)).success).toBe(true)
  })

  it('does not mutate its input', () => {
    const copy = structuredClone(v2)
    migrations[2](v2)
    expect(v2).toEqual(copy)
  })

  it('runs from version 2 up to the current version', () => {
    expect(runMigrations(v2, migrations, 3).from).toBe(2)
  })
})
