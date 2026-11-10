import { addDays, fromDay, toDay, todayISO } from './days'

it('round-trips', () => expect(fromDay(toDay('2028-02-29'))).toBe('2028-02-29'))
it('counts from 1970-01-01', () => expect(toDay('1970-01-05')).toBe(4))
it('counts days across a leap year', () =>
  expect(toDay('2028-03-01') - toDay('2028-02-28')).toBe(2))
it('is unaffected by daylight saving', () =>
  expect(toDay('2026-03-09') - toDay('2026-03-08')).toBe(1))
it('reads today from the local calendar', () =>
  expect(todayISO(new Date(2026, 10, 10, 23, 59))).toBe('2026-11-10'))
it('reads today from the local calendar just after midnight', () =>
  expect(todayISO(new Date(2026, 10, 11, 0, 0, 30))).toBe('2026-11-11'))
it('adds days across a year boundary', () => {
  expect(addDays('2026-12-28', 7)).toBe('2027-01-04')
  expect(addDays('2027-01-04', -7)).toBe('2026-12-28')
})
