import { assignRows, laneHeight } from './layout'

it('keeps non-overlapping phases on one row', () => {
  const rows = assignRows([
    { id: 'a', start: '2026-01-05', end: '2026-02-02' },
    { id: 'b', start: '2026-02-02', end: '2026-03-02' },
  ])
  expect([rows.get('a'), rows.get('b')]).toEqual([0, 0])
})
it('puts overlapping phases on separate rows', () => {
  const rows = assignRows([
    { id: 'a', start: '2026-01-05', end: '2026-03-02' },
    { id: 'b', start: '2026-02-02', end: '2026-04-06' },
  ])
  expect([rows.get('a'), rows.get('b')]).toEqual([0, 1])
})
it('reuses the first row once it is free again', () => {
  const rows = assignRows([
    { id: 'c', start: '2026-03-02', end: '2026-05-04' },
    { id: 'b', start: '2026-02-02', end: '2026-04-06' },
    { id: 'a', start: '2026-01-05', end: '2026-03-02' },
  ])
  expect([rows.get('a'), rows.get('b'), rows.get('c')]).toEqual([0, 1, 0])
})
it('computes lane height', () => {
  expect(laneHeight(1)).toBe(56)
  expect(laneHeight(2)).toBe(96)
  expect(laneHeight(0)).toBe(56)
})
