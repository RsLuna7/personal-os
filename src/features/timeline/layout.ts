import type { Phase } from '@/data/schema'

export const ROW_HEIGHT = 32
export const ROW_GAP = 8
export const LANE_PADDING = 12

/** 重叠的阶段错开到不同的行：按开始日期排序，贪心放入第一个不冲突的行。 */
export function assignRows(phases: Pick<Phase, 'id' | 'start' | 'end'>[]): Map<string, number> {
  const sorted = [...phases].sort(
    (a, b) =>
      a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id.localeCompare(b.id),
  )
  const rowEnds: string[] = []
  const rows = new Map<string, number>()
  for (const phase of sorted) {
    let row = rowEnds.findIndex((end) => end <= phase.start)
    if (row === -1) row = rowEnds.length
    rowEnds[row] = phase.end
    rows.set(phase.id, row)
  }
  return rows
}

export function rowCount(rows: Map<string, number>): number {
  let max = 0
  for (const row of rows.values()) max = Math.max(max, row + 1)
  return max
}

export function rowTop(row: number): number {
  return LANE_PADDING + row * (ROW_HEIGHT + ROW_GAP)
}

/** 空泳道按一行计算。 */
export function laneHeight(rows: number): number {
  const n = Math.max(1, rows)
  return LANE_PADDING * 2 + n * ROW_HEIGHT + (n - 1) * ROW_GAP
}
