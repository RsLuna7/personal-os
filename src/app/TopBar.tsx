import type { MouseEvent } from 'react'
import { AddMenu } from '@/features/editor/AddMenu'
import { ZoomControls } from '@/features/timeline/ZoomControls'
import { MoreMenu } from './MoreMenu'
import { routeHref, type Route } from './useHashRoute'

const NAV: { route: Route; label: string }[] = [
  { route: 'home', label: '全局' },
  { route: 'calendar', label: '日历' },
  { route: 'modules', label: '板块' },
  { route: 'today', label: '今日' },
]

interface TopBarProps {
  route: Route
  onNavigate: (route: Route) => void
}

export function TopBar({ route, onNavigate }: TopBarProps) {
  const handleClick = (event: MouseEvent, target: Route) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    onNavigate(target)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b border-(--border) bg-(--bg-page) px-6">
      <span className="text-[16px] font-medium text-(--text)">个人 OS</span>
      <nav aria-label="主导航" className="flex items-center gap-2">
        {NAV.map((item) => {
          // 展开的完整时间线属于“全局”
          const active = item.route === route || (item.route === 'home' && route === 'timeline')
          return (
            <a
              key={item.route}
              href={routeHref(item.route)}
              aria-current={active ? 'page' : undefined}
              onClick={(event) => handleClick(event, item.route)}
              className={
                'rounded-[6px] px-3 py-1 text-[14px] transition-colors duration-(--dur-fast) ease-(--ease-out) ' +
                (active
                  ? 'bg-(--bg-panel) font-medium text-(--text)'
                  : 'text-(--text-muted) hover:bg-(--bg-subtle) hover:text-(--text)')
              }
            >
              {item.label}
            </a>
          )
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {route === 'timeline' && (
          <>
            <ZoomControls />
            <AddMenu />
          </>
        )}
        <MoreMenu />
      </div>
    </header>
  )
}
