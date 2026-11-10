export const WEEK = 7

/** 1970-01-05（第 4 天）是周一。 */
const MONDAY_OFFSET = 4

export function snapToMonday(day: number): number {
  return Math.round((day - MONDAY_OFFSET) / WEEK) * WEEK + MONDAY_OFFSET
}

/** 平移：开始吸附到周一，长度不变。 */
export function movePhase(
  startDay: number,
  endDay: number,
  deltaDays: number,
): { start: number; end: number } {
  const start = snapToMonday(startDay + deltaDays)
  return { start, end: start + (endDay - startDay) }
}

/** 拉伸一端：该端吸附到周一，阶段最短一周。 */
export function resizePhase(
  startDay: number,
  endDay: number,
  edge: 'start' | 'end',
  targetDay: number,
): { start: number; end: number } {
  const snapped = snapToMonday(targetDay)
  if (edge === 'start') return { start: Math.min(snapped, endDay - WEEK), end: endDay }
  return { start: startDay, end: Math.max(snapped, startDay + WEEK) }
}
