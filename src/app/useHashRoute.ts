import { useCallback, useEffect, useState } from 'react'

export const ROUTES = ['home', 'timeline', 'calendar', 'modules', 'today'] as const
export type Route = (typeof ROUTES)[number]

function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '')
  return (ROUTES as readonly string[]).includes(name) ? (name as Route) : 'home'
}

export function routeHref(route: Route): string {
  return `#/${route}`
}

export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRouteState] = useState<Route>(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRouteState(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const setRoute = useCallback((r: Route) => {
    window.location.hash = routeHref(r)
    setRouteState(r)
  }, [])

  return [route, setRoute]
}
