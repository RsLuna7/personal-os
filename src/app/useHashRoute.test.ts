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
    ['#/calendar', { route: 'calendar', param: null }],
    ['#/calendar/x', { route: 'calendar', param: 'x' }],
    ['#/calendar/2026-11', { route: 'calendar', param: '2026-11' }],
    ['#/calendar/%E0%A4%A', { route: 'calendar', param: null }],
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

  it('adds a month to the calendar link', () => {
    expect(routeHref('calendar', '2026-11')).toBe('#/calendar/2026-11')
    expect(routeHref('calendar')).toBe('#/calendar')
  })

  it('encodes the parameter for modules and the calendar only', () => {
    expect(routeHref('modules', 'a b')).toBe('#/modules/a%20b')
    expect(routeHref('timeline', 'a b')).toBe('#/timeline')
  })
})
