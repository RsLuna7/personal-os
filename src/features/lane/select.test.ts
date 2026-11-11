import { routeHref } from '@/app/useHashRoute'
import type { Lane } from '@/data/schema'
import { laneHref, resolveLaneId } from './select'

const lane = (id: string, order: number): Lane => ({
  id,
  name: id,
  color: 'iris',
  order,
  note: '',
  links: [],
})
// 数组顺序故意和 order 不一致
const lanes = [lane('b', 1), lane('c', 2), lane('a', 0)]

describe('resolveLaneId', () => {
  it('returns the lane the parameter points at', () => {
    expect(resolveLaneId(lanes, 'c')).toBe('c')
  })

  it('falls back to the first lane by order when the parameter is unknown', () => {
    expect(resolveLaneId(lanes, 'missing')).toBe('a')
  })

  it('falls back to the first lane by order when there is no parameter', () => {
    expect(resolveLaneId(lanes, null)).toBe('a')
  })

  it('returns null when there are no lanes', () => {
    expect(resolveLaneId([], 'a')).toBeNull()
    expect(resolveLaneId([], null)).toBeNull()
  })
})

describe('laneHref', () => {
  it('matches the route helper', () => {
    expect(laneHref('a b')).toBe(routeHref('modules', 'a b'))
    expect(laneHref('abc')).toBe('#/modules/abc')
  })
})
