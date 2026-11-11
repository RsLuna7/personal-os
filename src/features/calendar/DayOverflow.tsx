import { useRef, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { formatDay } from '@/features/timeline/format'
import { dayItems, type CalendarData, type DayItem } from './layout'

interface DayOverflowProps {
  day: number
  /** 这一天槽号 2 及以后的项数 */
  count: number
  data: CalendarData
}

/** “+N 项”：点开列出这一天的全部项目，点一项就打开它的编辑面板。 */
export function DayOverflow({ day, count, data }: DayOverflowProps) {
  const [open, setOpen] = useState(false)
  // 选了一项就要让编辑面板接手焦点；关闭时不能再把焦点还给“+N 项”，否则会把刚打开的面板顶掉
  const chosen = useRef(false)
  const colorOf = (laneId: string) => data.lanes.find((lane) => lane.id === laneId)?.color ?? 'iris'

  const choose = (item: DayItem) => {
    chosen.current = true
    setOpen(false)
    const kind = item.kind
    const id = item.kind === 'phase' ? item.phase.id : item.milestone.id
    useStore.getState().select({ kind, id })
    openEditor(kind, id)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="pointer-events-auto h-full w-full cursor-pointer rounded-[6px] px-1.5 text-left text-[12px] text-(--text-muted) hover:bg-(--bg-panel) hover:text-(--text)"
        >
          +{count} 项
        </button>
      </PopoverTrigger>
      <PopoverContent
        aria-label={`${formatDay(day)}的项目`}
        align="start"
        sideOffset={4}
        collisionPadding={16}
        className="w-60 gap-0.5 p-1.5"
        onCloseAutoFocus={(event) => {
          if (!chosen.current) return
          chosen.current = false
          event.preventDefault()
        }}
      >
        {dayItems(day, data).map((item) =>
          item.kind === 'phase' ? (
            <button
              type="button"
              key={`phase-${item.phase.id}`}
              data-lane-color={colorOf(item.phase.laneId)}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[14px] hover:bg-(--bg-panel)"
              onClick={() => choose(item)}
            >
              <span className="h-2 w-4 shrink-0 rounded-[3px] border border-(--lane-border) bg-(--lane-fill)" />
              <span className="truncate">{item.phase.name}</span>
            </button>
          ) : (
            <button
              type="button"
              key={`milestone-${item.milestone.id}`}
              data-lane-color={colorOf(item.milestone.laneId)}
              className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[14px] hover:bg-(--bg-panel)"
              onClick={() => choose(item)}
            >
              <span className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
              <span className="truncate">{item.milestone.name}</span>
            </button>
          ),
        )}
      </PopoverContent>
    </Popover>
  )
}
