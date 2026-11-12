import type { Habit } from '@/data/schema'
import { toDay } from '@/features/timeline/days'
import { isDue, recentDays, streak, weekdayOf } from './habits'

const today = toDay('2026-11-12') // 周四

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: '背单词',
    laneId: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    checks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('weekdayOf', () => {
  it('counts Monday as 1', () => expect(weekdayOf(toDay('2026-11-09'))).toBe(1))
  it('counts Sunday as 7', () => expect(weekdayOf(toDay('2026-11-15'))).toBe(7))
  it('counts Thursday as 4', () => expect(weekdayOf(today)).toBe(4))
})

describe('isDue', () => {
  it('is due on a listed Sunday', () =>
    expect(isDue(habit({ weekdays: [7] }), toDay('2026-11-15'))).toBe(true))
  it('is not due on an unlisted day', () =>
    expect(isDue(habit({ weekdays: [7] }), today)).toBe(false))
  it('is not due before the habit was created', () => {
    const fresh = habit({ createdAt: '2026-11-12T08:00:00.000Z' })
    expect(isDue(fresh, toDay('2026-11-11'))).toBe(false)
    expect(isDue(fresh, today)).toBe(true)
  })
})

describe('streak', () => {
  it('counts consecutive checked days up to today', () =>
    expect(streak(habit({ checks: ['2026-11-10', '2026-11-11', '2026-11-12'] }), today)).toBe(3))
  it('does not break when today is not checked yet', () =>
    expect(streak(habit({ checks: ['2026-11-10', '2026-11-11'] }), today)).toBe(2))
  it('stops at the first missed due day', () =>
    expect(streak(habit({ checks: ['2026-11-10', '2026-11-12'] }), today)).toBe(1))
  it('skips days that are not due', () =>
    expect(
      streak(habit({ weekdays: [1, 3, 5], checks: ['2026-11-09', '2026-11-11'] }), today),
    ).toBe(2))
  it('does not count days before the habit was created', () =>
    expect(
      streak(habit({ createdAt: '2026-11-11T08:00:00.000Z', checks: ['2026-11-11'] }), today),
    ).toBe(1))
  it('is 0 with no checks', () => expect(streak(habit(), today)).toBe(0))
  it('crosses a week boundary', () =>
    expect(
      streak(
        habit({ weekdays: [7], checks: ['2026-11-01', '2026-11-08', '2026-11-15'] }),
        toDay('2026-11-16'),
      ),
    ).toBe(3))
})

describe('recentDays', () => {
  it('marks days before creation as off and today as missed for a new habit', () =>
    expect(
      recentDays(habit({ createdAt: '2026-11-12T08:00:00.000Z' }), today).map((d) => d.mark),
    ).toEqual(['off', 'off', 'off', 'off', 'off', 'off', 'missed']))
  it('ends with today', () => {
    const days = recentDays(habit({ checks: ['2026-11-12'] }), today)
    expect(days).toHaveLength(7)
    expect(days[6]).toEqual({ day: today, mark: 'done' })
    expect(days[0].day).toBe(toDay('2026-11-06'))
  })
  it('marks off days for a weekday habit', () =>
    expect(recentDays(habit({ weekdays: [1, 3, 5] }), today).map((d) => d.mark)).toEqual([
      'missed',
      'off',
      'off',
      'missed',
      'off',
      'missed',
      'off',
    ]))
  it('shows a check on an off day as done', () =>
    expect(recentDays(habit({ weekdays: [1], checks: ['2026-11-12'] }), today)[6].mark).toBe(
      'done',
    ))
})
