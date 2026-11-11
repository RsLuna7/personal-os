import {
  createRange,
  dayAtPoint,
  exceedsThreshold,
  resizeRange,
  shiftRange,
  type GridRect,
} from './drag'

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

describe('createRange', () => {
  it('makes a half-open range from either drag direction', () => {
    expect(createRange(10, 14)).toEqual({ start: 10, end: 15 })
    expect(createRange(14, 10)).toEqual({ start: 10, end: 15 })
    expect(createRange(10, 10)).toEqual({ start: 10, end: 11 })
  })
})

describe('shiftRange', () => {
  it('moves the whole range and keeps its length', () => {
    expect(shiftRange(10, 20, 3)).toEqual({ start: 13, end: 23 })
    const back = shiftRange(10, 20, -30)
    expect(back.end - back.start).toBe(10)
  })
})

describe('resizeRange', () => {
  it('drags the start edge but keeps at least one day', () => {
    expect(resizeRange(10, 20, 'start', 12)).toEqual({ start: 12, end: 20 })
    expect(resizeRange(10, 20, 'start', 25)).toEqual({ start: 19, end: 20 })
  })

  it('drags the end edge so the hovered day is the last day', () => {
    expect(resizeRange(10, 20, 'end', 14)).toEqual({ start: 10, end: 15 })
    expect(resizeRange(10, 20, 'end', 3)).toEqual({ start: 10, end: 11 })
    expect(resizeRange(10, 20, 'end', 19)).toEqual({ start: 10, end: 20 })
  })
})

describe('exceedsThreshold', () => {
  it('needs at least 4px of movement', () => {
    expect(exceedsThreshold(3, 0)).toBe(false)
    expect(exceedsThreshold(3, 3)).toBe(true)
    expect(exceedsThreshold(0, 4)).toBe(true)
  })
})
