import type { MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { AddMenu } from '@/features/editor/AddMenu'
import type { ZoomPreset } from '@/features/timeline/scale'
import { useViewport } from '@/features/timeline/useViewport'
import { routeHref, type Route } from './useHashRoute'

const NAV: { route: Route; label: string }[] = [
  { route: 'timeline', label: '全局' },
  { route: 'calendar', label: '日历' },
  { route: 'modules', label: '板块' },
  { route: 'today', label: '今日' },
]

const ZOOM: { preset: ZoomPreset; label: string }[] = [
  { preset: 'quarter', label: '近三个月' },
  { preset: 'year', label: '一年' },
  { preset: 'all', label: '全部' },
]

interface TopBarProps {
  route: Route
  onNavigate: (route: Route) => void
}

function ZoomControls() {
  const { preset, setPreset, goToToday } = useViewport()

  return (
    <>
      <div
        role="group"
        aria-label="缩放"
        className="flex items-center rounded-[6px] border border-(--border) p-0.5"
      >
        {ZOOM.map((item) => {
          const active = item.preset === preset
          return (
            <button
              key={item.preset}
              type="button"
              aria-pressed={active}
              onClick={() => setPreset(item.preset)}
              className={
                'rounded-[4px] px-2 py-0.5 text-[14px] transition-colors duration-(--dur-fast) ease-(--ease-out) ' +
                (active
                  ? 'bg-(--bg-panel) font-medium text-(--text)'
                  : 'text-(--text-muted) hover:text-(--text)')
              }
            >
              {item.label}
            </button>
          )
        })}
      </div>
      <Button variant="outline" size="sm" onClick={goToToday}>
        回到今天
      </Button>
    </>
  )
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
          const active = item.route === route
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
      </div>
    </header>
  )
}
