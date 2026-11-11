/** 指针移动超过这么多像素才算拖动，否则算点击。 */
export const DRAG_THRESHOLD_PX = 4

export function exceedsThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX
}

export interface GridRect {
  left: number
  top: number
  width: number
  height: number
}

/** 指针下面的那一天（整日数）；在网格外返回 null。 */
export function dayAtPoint(rect: GridRect, weeks: number[][], x: number, y: number): number | null {
  const dx = x - rect.left
  const dy = y - rect.top
  if (dx < 0 || dy < 0 || dx >= rect.width || dy >= rect.height) return null
  const col = Math.floor(dx / (rect.width / 7))
  const row = Math.floor(dy / (rect.height / weeks.length))
  return weeks[row]?.[col] ?? null
}

/** 拖选出的区间，半开：end 是最后一天加 1。 */
export function createRange(anchorDay: number, currentDay: number): { start: number; end: number } {
  return {
    start: Math.min(anchorDay, currentDay),
    end: Math.max(anchorDay, currentDay) + 1,
  }
}

export function shiftRange(
  start: number,
  end: number,
  delta: number,
): { start: number; end: number } {
  return { start: start + delta, end: end + delta }
}

/** 拖开始端或结束端；hoverDay 是指针下的那一天，最短保留 1 天。 */
export function resizeRange(
  start: number,
  end: number,
  edge: 'start' | 'end',
  hoverDay: number,
): { start: number; end: number } {
  if (edge === 'start') return { start: Math.min(hoverDay, end - 1), end }
  return { start, end: Math.max(hoverDay + 1, start + 1) }
}
