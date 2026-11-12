import type { MouseEvent } from 'react'
import { Minimize2Icon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { AddMenu } from '@/features/editor/AddMenu'
import { ZoomControls } from '@/features/timeline/ZoomControls'
import { MoreMenu } from './MoreMenu'
import { routeHref, type Route } from './useHashRoute'

const NAV: { route: Route; label: string }[] = [
  { route: 'home', label: '全局' },
  { route: 'calendar', label: '日历' },
  { route: 'modules', label: '板块' },
  { route: 'today', label: '今日' },
  { route: 'review', label: '回顾' },
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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-(--border) bg-(--bg-page) px-4 whitespace-nowrap sm:px-6 lg:gap-6">
      {/* 品牌字标：Kairos 是希腊神话里“恰当时机”之神 */}
      <span title="Kairos OS · 个人 OS" className="flex shrink-0 items-baseline gap-1 leading-none">
        <span className="font-['Playball_Kairos',cursive] text-[30px] text-(--text)">Kairos</span>
        <span className="font-['Cormorant_Garamond_OS',serif] text-[28px] font-semibold text-(--brand) italic">
          OS
        </span>
      </span>
      <nav aria-label="主导航" className="flex shrink-0 items-center gap-1 sm:gap-2">
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
                'rounded-[6px] px-2 py-1 text-[14px] lg:px-3 transition-colors duration-(--dur-fast) ease-(--ease-out) ' +
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
      <div className="ml-auto flex items-center gap-1.5 lg:gap-2">
        {route === 'timeline' && (
          <>
            <ZoomControls />
            <AddMenu />
            {/* 和主页卡片上的“展开”对称：回到主页，时间线缩回卡片 */}
            <a
              href={routeHref('home')}
              title="收起，回到主页"
              onClick={(event) => handleClick(event, 'home')}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Minimize2Icon className="size-3.5" aria-hidden />
              {/* 1024 以下顶栏放不下，只留图标；文字仍给读屏软件 */}
              <span className="max-lg:sr-only">收起</span>
            </a>
          </>
        )}
        <MoreMenu />
      </div>
    </header>
  )
}
