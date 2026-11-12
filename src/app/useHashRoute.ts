import { useCallback, useEffect, useRef, useState } from 'react'
import { runViewTransition, transitionBetween } from './viewTransition'

export const ROUTES = ['home', 'timeline', 'calendar', 'modules', 'today'] as const
export type Route = (typeof ROUTES)[number]

interface ParsedHash {
  route: Route
  /** 只有 modules（板块编号）和 calendar（月份）有参数，其他路由一律为 null */
  param: string | null
}

export function parseHash(hash: string): ParsedHash {
  const [name = '', rawParam = ''] = hash.replace(/^#\/?/, '').split('/', 2)
  if (!(ROUTES as readonly string[]).includes(name)) return { route: 'home', param: null }
  const route = name as Route
  if ((route !== 'modules' && route !== 'calendar') || rawParam === '')
    return { route, param: null }
  try {
    return { route, param: decodeURIComponent(rawParam) }
  } catch {
    // 手输的残缺转义，当作没有参数
    return { route, param: null }
  }
}

export function routeHref(route: Route, param?: string | null): string {
  if ((route === 'modules' || route === 'calendar') && param)
    return `#/${route}/${encodeURIComponent(param)}`
  return `#/${route}`
}

export function useHashRoute(): [Route, (r: Route, param?: string | null) => void, string | null] {
  const [parsed, setParsed] = useState<ParsedHash>(() => parseHash(window.location.hash))
  // 当前路由的最新值；切换时用它判断要不要播放过渡，不必等 React 渲染
  const currentRef = useRef(parsed)

  // 主页和完整时间线之间切换时播放展开或收起的过渡，其他切换直接换页
  const apply = useCallback((next: ParsedHash) => {
    const kind = transitionBetween(currentRef.current.route, next.route)
    currentRef.current = next
    if (kind) runViewTransition(kind, () => setParsed(next))
    else setParsed(next)
  }, [])

  useEffect(() => {
    const onChange = () => apply(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [apply])

  const setRoute = useCallback(
    (r: Route, param?: string | null) => {
      window.location.hash = routeHref(r, param)
      apply(parseHash(window.location.hash))
    },
    [apply],
  )

  return [parsed.route, setRoute, parsed.param]
}
