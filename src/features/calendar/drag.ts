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

/** 格子之间的间隙（像素），网格的 CSS 和换算要用同一个数。 */
export const CELL_GAP_PX = 6

/**
 * 指针下面的那一天（整日数）；在网格外返回 null。
 * 格子之间有间隙，落在间隙里的点算作它前面的那一格。
 */
export function dayAtPoint(
  rect: GridRect,
  weeks: number[][],
  x: number,
  y: number,
  gap: number = CELL_GAP_PX,
): number | null {
  const dx = x - rect.left
  const dy = y - rect.top
  if (dx < 0 || dy < 0 || dx >= rect.width || dy >= rect.height) return null
  const rows = weeks.length
  const cellWidth = (rect.width - gap * 6) / 7
  const cellHeight = (rect.height - gap * (rows - 1)) / rows
  const col = Math.min(6, Math.floor(dx / (cellWidth + gap)))
  const row = Math.min(rows - 1, Math.floor(dy / (cellHeight + gap)))
  return weeks[row]?.[col] ?? null
}
