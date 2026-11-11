import { fromDay, toDay } from '@/features/timeline/days'
import {
  monthParam,
  monthTitle,
  monthWeeks,
  parseMonthParam,
  shiftMonth,
  type MonthRef,
} from './month'

const TODAY = toDay('2026-11-10')

describe('parseMonthParam', () => {
  it.each([
    ['2026-11', { year: 2026, month: 11 }],
    ['2026-12', { year: 2026, month: 12 }],
    ['1900-01', { year: 1900, month: 1 }],
    ['2100-12', { year: 2100, month: 12 }],
  ])('uses a valid month %j', (param, expected) => {
    expect(parseMonthParam(param, TODAY)).toEqual(expected)
  })

  it.each([
    [null],
    [''],
    ['2026-13'],
    ['2026-00'],
    ['2026-1'],
    ['0000-01'],
    ['1899-12'],
    ['2101-01'],
    ['2026-11/x'],
    ['abc'],
  ])('falls back to the current month for %j', (param) => {
    expect(parseMonthParam(param, TODAY)).toEqual({ year: 2026, month: 11 })
  })
})

it('formats the month for the address and the title', () => {
  expect(monthParam({ year: 2026, month: 3 })).toBe('2026-03')
  expect(monthTitle({ year: 2026, month: 3 })).toBe('2026年3月')
})

describe('shiftMonth', () => {
  it('moves across a year boundary in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 })
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2026, month: 12 })
  })

  it('refuses to leave 1900-01 to 2100-12', () => {
    expect(shiftMonth({ year: 1900, month: 1 }, -1)).toBeNull()
    expect(shiftMonth({ year: 2100, month: 12 }, 1)).toBeNull()
  })
})

describe('monthWeeks', () => {
  const first = (ref: MonthRef) => fromDay(monthWeeks(ref)[0]![0]!)
  const last = (ref: MonthRef) => {
    const weeks = monthWeeks(ref)
    return fromDay(weeks[weeks.length - 1]![6]!)
  }

  it('covers six weeks for November 2026', () => {
    const ref = { year: 2026, month: 11 }
    expect(monthWeeks(ref)).toHaveLength(6)
    expect(first(ref)).toBe('2026-10-26')
    expect(last(ref)).toBe('2026-12-06')
  })

  it('covers four weeks for February 2027', () => {
    const ref = { year: 2027, month: 2 }
    expect(monthWeeks(ref)).toHaveLength(4)
    expect(first(ref)).toBe('2027-02-01')
    expect(last(ref)).toBe('2027-02-28')
  })

  it('covers five weeks for a leap February', () => {
    const ref = { year: 2028, month: 2 }
    expect(monthWeeks(ref)).toHaveLength(5)
    expect(first(ref)).toBe('2028-01-31')
    expect(last(ref)).toBe('2028-03-05')
  })

  it('runs into the next year for December 2026', () => {
    expect(last({ year: 2026, month: 12 })).toBe('2027-01-03')
  })

  it('has seven consecutive days per week and starts on a Monday', () => {
    for (const ref of [
      { year: 2026, month: 11 },
      { year: 2027, month: 2 },
      { year: 1900, month: 1 },
      { year: 2100, month: 12 },
    ]) {
      const days = monthWeeks(ref).flat()
      expect(days.length % 7).toBe(0)
      days.forEach((day, index) => {
        if (index > 0) expect(day - days[index - 1]!).toBe(1)
      })
      // 1970-01-05 是周一：整日数减 4 能被 7 整除
      expect((((days[0]! - 4) % 7) + 7) % 7).toBe(0)
    }
  })
})
