import { useRef, type KeyboardEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import { SlidingPill, useSlidingPill } from '@/app/useSlidingPill'
import type { Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { addLaneAndRename } from '@/features/editor/AddMenu'
import { isIdle, summarizeLane, type LaneSummary } from '@/features/home/summary'
import { toDay } from '@/features/timeline/days'
import { countdownText, formatDay } from '@/features/timeline/format'
import { laneHref } from './select'

interface LaneSidebarProps {
  /** 已按 order 排好 */
  lanes: Lane[]
  selectedId: string
  today: number
}

/** 名字下面的一行：在做什么；没在做就写接下来是什么；什么都没安排就写“暂无安排”。 */
function subtitle({ current, next, nextMilestone }: LaneSummary, today: number): string {
  if (current) return current.name
  if (next) return `下一阶段：${next.name} · ${formatDay(toDay(next.start))}`
  if (nextMilestone) {
    return `下一个节点：${nextMilestone.name} · ${countdownText(toDay(nextMilestone.date), today)}`
  }
  return '暂无安排'
}

/** 左侧板块列表：每行是指向该板块网址的链接。什么都没安排的板块变淡（和主页概览一样）。 */
export function LaneSidebar({ lanes, selectedId, today }: LaneSidebarProps) {
  const phases = useStore((state) => state.data.phases)
  const milestones = useStore((state) => state.data.milestones)
  const list = useRef<HTMLElement | null>(null)
  // 选中那一行的底色是一块单独的“胶囊”：换板块时滑到新的那一行，颜色也渐变过去
  const pill = useSlidingPill(list, 'a[aria-current="page"]')

  const moveFocus = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const rows = Array.from(list.current?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
    const index = rows.findIndex((row) => row === document.activeElement)
    if (index === -1) return
    event.preventDefault()
    rows[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus()
  }

  const addLane = () => {
    const id = addLaneAndRename()
    window.location.hash = laneHref(id)
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-2 overflow-y-auto border-r border-(--border) bg-(--bg-page) p-3">
      <nav
        aria-label="板块列表"
        ref={list}
        onKeyDown={moveFocus}
        className="relative flex flex-col gap-1"
      >
        <SlidingPill
          pill={pill}
          testId="lane-side-pill"
          className="lane-side-pill rounded-[10px] bg-(--lane-fill)"
        />
        {lanes.map((lane) => {
          const summary = summarizeLane(lane, phases, milestones, today)
          const idle = isIdle(summary)
          const selected = lane.id === selectedId
          return (
            <a
              key={lane.id}
              href={laneHref(lane.id)}
              data-lane-color={lane.color}
              aria-current={selected ? 'page' : undefined}
              data-idle={String(idle)}
              className={
                'lane-side-row relative flex flex-col gap-0.5 rounded-[10px] px-3 py-2 transition-colors duration-(--dur-fast) ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text) ' +
                // 选中行自己不涂底色，由下面滑动的胶囊来涂；胶囊还没量好位置的第一帧先自己涂上
                (selected ? (pill ? '' : 'bg-(--lane-fill)') : 'hover:bg-(--bg-subtle)')
              }
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={`lane-side-dot size-2.5 shrink-0 rounded-full bg-(--lane-dot) ${idle ? 'opacity-40' : ''}`}
                />
                <span
                  className={
                    'min-w-0 truncate text-[14px] ' +
                    (idle ? 'text-(--text-muted) ' : 'text-(--text) ') +
                    (selected ? 'font-bold' : 'font-medium')
                  }
                >
                  {lane.name}
                </span>
              </span>
              <span className="truncate pl-[18px] text-[12px] text-(--text-muted)">
                {subtitle(summary, today)}
              </span>
            </a>
          )
        })}
      </nav>
      <button
        type="button"
        onClick={addLane}
        className="flex items-center gap-1 rounded-[6px] px-3 py-2 text-left text-[14px] text-(--text-muted) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-subtle) hover:text-(--text)"
      >
        <PlusIcon className="size-4" aria-hidden />
        添加板块
      </button>
    </aside>
  )
}
