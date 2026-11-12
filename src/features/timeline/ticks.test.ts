import { toDay } from './days'
import { edgeLabels, isHolidayName, weekLabel, weekTicks } from './ticks'

it('lists every Monday across the visible range', () => {
  // 2026-11-02 is a Monday; 30 days at 10px/day
  const ticks = weekTicks({ originDay: toDay('2026-11-02'), pxPerDay: 10 }, 300)
  const days = ticks.map((tick) => tick.day)
  expect(days).toContain(toDay('2026-11-02'))
  expect(days).toContain(toDay('2026-11-30'))
  for (const day of days) expect(new Date(day * 86_400_000).getUTCDay()).toBe(1)
})

describe('weekLabel', () => {
  const term = { start: toDay('2026-09-07'), end: toDay('2027-01-18') }

  it('numbers weeks from the week the term starts in', () => {
    expect(weekLabel(toDay('2026-09-07'), [term])).toBe('第1周')
    expect(weekLabel(toDay('2026-11-09'), [term])).toBe('第10周')
  })

  it('counts the first week even when the term starts mid-week', () => {
    const midWeek = { start: toDay('2026-09-09'), end: toDay('2026-12-01') }
    expect(weekLabel(toDay('2026-09-07'), [midWeek])).toBe('第1周')
    expect(weekLabel(toDay('2026-09-14'), [midWeek])).toBe('第2周')
  })

  it('falls back to the Monday date outside any term', () => {
    expect(weekLabel(toDay('2027-02-01'), [term])).toBe('1')
    expect(weekLabel(toDay('2026-11-16'), [])).toBe('16')
  })

  it('prefers the later term when two overlap', () => {
    const next = { start: toDay('2027-01-11'), end: toDay('2027-06-01') }
    expect(weekLabel(toDay('2027-01-11'), [term, next])).toBe('第1周')
  })
})

describe('holidays', () => {
  const autumn = { start: toDay('2026-09-07'), end: toDay('2027-01-18') }
  const winter = { start: toDay('2027-01-18'), end: toDay('2027-03-01'), holiday: true }
  const spring = { start: toDay('2027-03-01'), end: toDay('2027-07-01') }

  it('writes dates during a holiday instead of counting its weeks', () => {
    expect(weekLabel(toDay('2027-01-25'), [autumn, winter, spring])).toBe('25')
    expect(weekLabel(toDay('2027-02-22'), [autumn, winter, spring])).toBe('22')
  })

  it('still numbers the terms on either side', () => {
    expect(weekLabel(toDay('2027-01-11'), [autumn, winter, spring])).toBe('第19周')
    expect(weekLabel(toDay('2027-03-01'), [autumn, winter, spring])).toBe('第1周')
  })

  it('treats names with 假 as holidays', () => {
    for (const name of ['寒假', '暑假', '示例假期', '国庆放假'])
      expect(isHolidayName(name)).toBe(true)
    for (const name of ['大三上', '秋季学期', '小学期']) expect(isHolidayName(name)).toBe(false)
  })
})

describe('edgeLabels', () => {
  it('hides ticks that scrolled off the left edge and shows the leading label instead', () => {
    expect(edgeLabels([-27, 300])).toEqual({ leading: true, visible: [false, true] })
  })
  it('drops the leading label when a tick sits right at the left edge', () => {
    expect(edgeLabels([-200, 20, 300])).toEqual({ leading: false, visible: [false, true, true] })
  })
})
