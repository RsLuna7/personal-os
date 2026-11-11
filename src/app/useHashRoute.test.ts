import { parseHash, routeHref } from './useHashRoute'

describe('parseHash', () => {
  it.each([
    ['', { route: 'home', param: null }],
    ['#/home', { route: 'home', param: null }],
    ['#/timeline', { route: 'timeline', param: null }],
    ['#/modules', { route: 'modules', param: null }],
    ['#/modules/', { route: 'modules', param: null }],
    ['#/modules/abc', { route: 'modules', param: 'abc' }],
    ['#/modules/a%20b', { route: 'modules', param: 'a b' }],
    ['#/modules/%E0%A4%A', { route: 'modules', param: null }],
    ['#/home/x', { route: 'home', param: null }],
    ['#/calendar/x', { route: 'calendar', param: null }],
    ['#/nope', { route: 'home', param: null }],
    ['#/nope/abc', { route: 'home', param: null }],
  ])('reads %j', (hash, expected) => {
    expect(parseHash(hash)).toEqual(expected)
  })
})

describe('routeHref', () => {
  it('builds plain route links', () => {
    expect(routeHref('home')).toBe('#/home')
    expect(routeHref('modules')).toBe('#/modules')
  })

  it('encodes the parameter for modules only', () => {
    expect(routeHref('modules', 'a b')).toBe('#/modules/a%20b')
    expect(routeHref('timeline', 'a b')).toBe('#/timeline')
  })
})
