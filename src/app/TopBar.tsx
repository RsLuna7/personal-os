import { useRef, type MouseEvent } from 'react'
import { Minimize2Icon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { AddMenu } from '@/features/editor/AddMenu'
import { ZoomControls } from '@/features/timeline/ZoomControls'
import { MoreMenu } from './MoreMenu'
import { routeHref, type Route } from './useHashRoute'
import { SlidingPill, useSlidingPill } from './useSlidingPill'

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
  const nav = useRef<HTMLElement | null>(null)
  // 当前页的底色是一块胶囊，换页面时滑过去
  const pill = useSlidingPill(nav, 'a[aria-current="page"]')
  const handleClick = (event: MouseEvent, target: Route) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    onNavigate(target)
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-(--border) bg-(--bg-page) px-4 whitespace-nowrap sm:px-6 lg:gap-6">
      {/* 品牌字标：Kairos 是希腊神话里“恰当时机”之神 */}
      <span title="Kairos OS · 个人 OS" className="flex shrink-0 items-baseline gap-1 leading-none">
        <span className="brand-kairos font-['Playball_Kairos',cursive] text-[30px] text-(--text)">
          Kairos
        </span>
        <span className="brand-os font-['Cormorant_Garamond_OS',serif] text-[28px] font-semibold text-(--brand) italic">
          OS
        </span>
      </span>
      <nav
        aria-label="主导航"
        ref={nav}
        className="relative flex shrink-0 items-center gap-1 sm:gap-2"
      >
        <SlidingPill pill={pill} testId="nav-pill" className="rounded-[6px] bg-(--bg-panel)" />
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
                // 当前页自己不涂底色，由滑动的胶囊来涂；胶囊还没量好位置的第一帧先自己涂上
                'relative ' +
                (active
                  ? `${pill ? '' : 'bg-(--bg-panel) '}font-medium text-(--text)`
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
