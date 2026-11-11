import { CELL_GAP_PX, dayAtPoint, exceedsThreshold, type GridRect } from './drag'

const RECT: GridRect = { left: 100, top: 50, width: 700, height: 500 }
// 5 周，每周 7 个连续整日数
const WEEKS = Array.from({ length: 5 }, (_, week) =>
  Array.from({ length: 7 }, (_, col) => 1000 + week * 7 + col),
)

describe('dayAtPoint', () => {
  it('finds the cell under the pointer', () => {
    expect(dayAtPoint(RECT, WEEKS, 100, 50)).toBe(WEEKS[0]![0])
    expect(dayAtPoint(RECT, WEEKS, 799, 549)).toBe(WEEKS[4]![6])
    expect(dayAtPoint(RECT, WEEKS, 250, 160)).toBe(WEEKS[1]![1])
  })

  it('returns null outside the grid, including the right and bottom edges', () => {
    expect(dayAtPoint(RECT, WEEKS, 99, 60)).toBeNull()
    expect(dayAtPoint(RECT, WEEKS, 800, 60)).toBeNull()
    expect(dayAtPoint(RECT, WEEKS, 150, 49)).toBeNull()
    expect(dayAtPoint(RECT, WEEKS, 150, 550)).toBeNull()
  })
})

describe('dayAtPoint with gaps between the cells', () => {
  // 700 宽、间隙 6：每格 (700 - 36) / 7 约 94.9，步长约 100.9
  const gapped: GridRect = { left: 0, top: 0, width: 700, height: 506 }
  const weeks = WEEKS.slice(0, 5)

  it('uses the stride of cell plus gap, which differs from an even split near a row boundary', () => {
    // 第 5 行从 4 × (96.4 + 6) 约 409.6 开始；平均分的话会在 404.8
    expect(dayAtPoint(gapped, weeks, 650, 405, 0)).toBe(weeks[4]![6])
    expect(dayAtPoint(gapped, weeks, 650, 405, 6)).toBe(weeks[3]![6])
    expect(dayAtPoint(gapped, weeks, 650, 420, 6)).toBe(weeks[4]![6])
  })

  it('counts a point inside a gap as the cell before it', () => {
    expect(dayAtPoint(gapped, weeks, 97, 10, 6)).toBe(weeks[0]![0])
    expect(dayAtPoint(gapped, weeks, 10, 97, 6)).toBe(weeks[0]![0])
  })

  it('defaults to the real gap of the calendar', () => {
    expect(CELL_GAP_PX).toBeGreaterThan(0)
    expect(dayAtPoint(gapped, weeks, 650, 495)).toBe(weeks[4]![6])
  })
})

describe('exceedsThreshold', () => {
  it('needs at least 4px of movement', () => {
    expect(exceedsThreshold(3, 0)).toBe(false)
    expect(exceedsThreshold(3, 3)).toBe(true)
    expect(exceedsThreshold(0, 4)).toBe(true)
  })
})
