import type { Habit } from '@/data/schema'
import { todayISO, toDay } from '@/features/timeline/days'

/** 打卡栏显示最近几天（含今天）。更早的打卡记录不能在这里改。 */
export const RECENT_DAYS = 7

/** 那天是星期几：1 = 周一 … 7 = 周日。1970-01-01 是周四。 */
export function weekdayOf(day: number): number {
  return ((((day + 3) % 7) + 7) % 7) + 1
}

/** 习惯是哪天建的（使用者本地日历上的日期）。 */
function createdDay(habit: Habit): number {
  return toDay(todayISO(new Date(habit.createdAt)))
}

/** 那天要不要打卡：星期对得上，且不早于习惯创建那天。 */
export function isDue(habit: Habit, day: number): boolean {
  return day >= createdDay(habit) && habit.weekdays.includes(weekdayOf(day))
}

/** done：打了卡；missed：该打没打；off：那天不用打。 */
export type DayMark = 'done' | 'missed' | 'off'

/** 最近 count 天每天的状态，从旧到新，最后一个是今天。打了卡的日子总是 done，哪怕那天不用打。 */
export function recentDays(
  habit: Habit,
  today: number,
  count: number = RECENT_DAYS,
): { day: number; mark: DayMark }[] {
  const checked = new Set(habit.checks.map(toDay))
  return Array.from({ length: count }, (_, index) => {
    const day = today - count + 1 + index
    const mark: DayMark = checked.has(day) ? 'done' : isDue(habit, day) ? 'missed' : 'off'
    return { day, mark }
  })
}

/**
 * 连续记录：从今天往回数，每个该打的日子都打了就加 1。
 * 不用打的日子跳过、不算断；今天还没打不算断；遇到第一个该打没打的日子就停；创建之前的日子不算。
 */
export function streak(habit: Habit, today: number): number {
  const checked = new Set(habit.checks.map(toDay))
  const start = createdDay(habit)
  let day = isDue(habit, today) && !checked.has(today) ? today - 1 : today
  let count = 0
  for (; day >= start; day--) {
    if (!isDue(habit, day)) continue
    if (!checked.has(day)) break
    count++
  }
  return count
}
