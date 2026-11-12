import { dayToX, panBy, presetScale, xToDay, zoomAt } from './scale'

const s = { originDay: 100, pxPerDay: 2 }

it('converts both ways', () => {
  expect(dayToX(s, 110)).toBe(20)
  expect(xToDay(s, 21)).toBe(110)
})
it('keeps the anchored day fixed when zooming', () => {
  const z = zoomAt(s, 2, 40)
  expect(z.pxPerDay).toBe(4)
  expect(dayToX(z, 120)).toBeCloseTo(40)
})
it('clamps zoom', () => {
  expect(zoomAt(s, 1000, 0).pxPerDay).toBe(24)
  expect(zoomAt(s, 0.0001, 0).pxPerDay).toBe(0.5)
})
it('pans so content follows the pointer', () => {
  const p = panBy(s, 20)
  expect(p.pxPerDay).toBe(2)
  expect(dayToX(p, 110)).toBe(40)
})
it('quarter preset shows 92 days with today a quarter of the way in', () => {
  const q = presetScale('quarter', 920, 1000, null)
  expect(q.pxPerDay).toBe(10)
  expect(dayToX(q, 1000)).toBeCloseTo(230)
})
it('year preset shows 365 days with today a quarter of the way in', () => {
  const y = presetScale('year', 730, 1000, null)
  expect(y.pxPerDay).toBe(2)
  expect(dayToX(y, 1000)).toBeCloseTo(182.5)
})
it('all preset fits the data range with 5% padding each side', () => {
  const a = presetScale('all', 1100, 1000, { min: 0, max: 1000 })
  expect(a.originDay).toBe(-50)
  expect(a.pxPerDay).toBe(1)
})
it('all preset shows at least a year, centred on short data', () => {
  // 只有四周的数据：不能放大到比“近三个月”还近
  const a = presetScale('all', 730, 1000, { min: 986, max: 1014 })
  expect(a.pxPerDay).toBe(2)
  expect(a.originDay).toBeCloseTo(1000 - 365 / 2)
})
it('all preset falls back to year when there is no data', () =>
  expect(presetScale('all', 730, 1000, null)).toEqual(presetScale('year', 730, 1000, null)))
