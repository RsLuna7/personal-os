import { NewerVersionError, runMigrations, type Migration } from './migrations'

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
