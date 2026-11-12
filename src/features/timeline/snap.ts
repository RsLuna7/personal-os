export const WEEK = 7

/** 1970-01-05（第 4 天）是周一。 */
const MONDAY_OFFSET = 4

export function snapToMonday(day: number): number {
  return Math.round((day - MONDAY_OFFSET) / WEEK) * WEEK + MONDAY_OFFSET
}

/** day 所在那一周的周一。 */
export function mondayOf(day: number): number {
  return Math.floor((day - MONDAY_OFFSET) / WEEK) * WEEK + MONDAY_OFFSET
}

/** 拖动的距离换算成整周，不足半周的部分舍去或进一 */
function wholeWeeks(deltaDays: number): number {
  return Math.round(deltaDays / WEEK) * WEEK
}

/**
 * 平移：按整周挪动，长度不变，保持原来是星期几。
 * 在编辑面板里设成周三开始的阶段，拖完仍然是周三，不会被吸到周一。
 */
export function movePhase(
  startDay: number,
  endDay: number,
  deltaDays: number,
): { start: number; end: number } {
  const shift = wholeWeeks(deltaDays)
  return { start: startDay + shift, end: endDay + shift }
}

/** 拉伸一端：该端按整周挪动、保持星期几，阶段最短一周。 */
export function resizePhase(
  startDay: number,
  endDay: number,
  edge: 'start' | 'end',
  targetDay: number,
): { start: number; end: number } {
  if (edge === 'start') {
    const start = startDay + wholeWeeks(targetDay - startDay)
    return { start: Math.min(start, endDay - WEEK), end: endDay }
  }
  const end = endDay + wholeWeeks(targetDay - endDay)
  return { start: startDay, end: Math.max(end, startDay + WEEK) }
}
