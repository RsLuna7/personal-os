import { movePhase, resizePhase, snapToMonday } from './snap'
import { toDay } from './days'

// 1970-01-05 (day 4) is a Monday
it('snaps to the nearest Monday', () => {
  expect(snapToMonday(4)).toBe(4)
  expect(snapToMonday(7)).toBe(4)
  expect(snapToMonday(8)).toBe(11)
})
it('snaps across a year boundary and a leap day', () => {
  expect(snapToMonday(toDay('2026-12-31'))).toBe(toDay('2026-12-28'))
  expect(snapToMonday(toDay('2027-01-01'))).toBe(toDay('2027-01-04'))
  expect(snapToMonday(toDay('2028-02-29'))).toBe(toDay('2028-02-28'))
})
it('moves a phase keeping its length', () =>
  expect(movePhase(4, 32, 9)).toEqual({ start: 11, end: 39 }))
it('keeps the length of a phase that is not a whole number of weeks', () =>
  expect(movePhase(4, 14, 7)).toEqual({ start: 11, end: 21 }))
it('resizes the end and enforces one week minimum', () => {
  expect(resizePhase(4, 32, 'end', 20)).toEqual({ start: 4, end: 18 })
  expect(resizePhase(4, 32, 'end', 5)).toEqual({ start: 4, end: 11 })
  expect(resizePhase(4, 32, 'start', 31)).toEqual({ start: 25, end: 32 })
})
it('keeps the weekday of a phase that does not start on a Monday', () => {
  // day 6 is a Wednesday
  expect(movePhase(6, 34, 9)).toEqual({ start: 13, end: 41 })
  expect(movePhase(6, 34, -10)).toEqual({ start: -1, end: 27 })
})
it('resizes a non-Monday phase by whole weeks', () => {
  expect(resizePhase(6, 34, 'end', 44)).toEqual({ start: 6, end: 41 })
  expect(resizePhase(6, 34, 'start', 15)).toEqual({ start: 13, end: 34 })
})
