import { useRef, type KeyboardEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import type { Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { addLaneAndRename } from '@/features/editor/AddMenu'
import { summarizeLane } from '@/features/home/summary'
import { laneHref } from './select'

interface LaneSidebarProps {
  /** 已按 order 排好 */
  lanes: Lane[]
  selectedId: string
  today: number
}

/** 左侧板块列表：每行是指向该板块网址的链接。 */
export function LaneSidebar({ lanes, selectedId, today }: LaneSidebarProps) {
  const phases = useStore((state) => state.data.phases)
  const list = useRef<HTMLElement | null>(null)

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
      <nav aria-label="板块列表" ref={list} onKeyDown={moveFocus} className="flex flex-col gap-1">
        {lanes.map((lane) => {
          const current = summarizeLane(lane, phases, [], today).current
          const selected = lane.id === selectedId
          return (
            <a
              key={lane.id}
              href={laneHref(lane.id)}
              data-lane-color={lane.color}
              aria-current={selected ? 'page' : undefined}
              className={
                'flex flex-col gap-0.5 rounded-[10px] px-3 py-2 transition-colors duration-(--dur-fast) ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text) ' +
                (selected ? 'bg-(--lane-fill)' : 'hover:bg-(--bg-subtle)')
              }
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--lane-dot)" />
                <span
                  className={
                    'min-w-0 truncate text-[14px] text-(--text) ' +
                    (selected ? 'font-bold' : 'font-medium')
                  }
                >
                  {lane.name}
                </span>
              </span>
              <span className="truncate pl-[18px] text-[12px] text-(--text-muted)">
                {current ? current.name : '暂无进行中阶段'}
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
