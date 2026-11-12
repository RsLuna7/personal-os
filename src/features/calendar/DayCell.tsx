import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import type { Lane } from '@/data/schema'
import type { Selection } from '@/data/store'
import { fromDay } from '@/features/timeline/days'
import { formatDayWithYear } from '@/features/timeline/format'
import { cellTint, colorOfLane, type DayEntry } from './cells'
import { MilestoneItem } from './MilestoneItem'
import { TodoItem } from './TodoItem'
import { addTodoOnDay, type MoveTarget, type Preview } from './useCalendarDrag'

interface DayCellProps {
  day: number
  today: number
  /** 第几行（从 0 起），进入动画按行错开 */
  row: number
  /** 不是当前月的日期，去掉卡片只留淡数字 */
  outside: boolean
  /** 这一天的全部条目，已排好序 */
  entries: DayEntry[]
  lanes: Lane[]
  selection: Selection | null
  preview: Preview | null
  onMoveStart: (event: ReactPointerEvent<HTMLElement>, target: MoveTarget) => void
  /** 当前能 Tab 进去的那一天（roving tabindex） */
  tabDay: number
  onDayFocus: (day: number) => void
}

function dayLabel(day: number): string {
  const [, month, date] = fromDay(day).split('-').map(Number)
  return date === 1 ? `${month}月1日` : String(date)
}

function isWeekend(day: number): boolean {
  const weekday = new Date(`${fromDay(day)}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

/** 双击的是空白处才新建；条目、按钮、弹出层（它在 React 树里属于格子）里的双击不算。 */
function onBlankDoubleClick(event: MouseEvent<HTMLElement>, day: number): void {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest('[data-item], button, input, a, [role="dialog"]')) return
  addTodoOnDay(day)
}

/**
 * 条目列表装不下时在格子里滚动。这里量出上面、下面是否还有没露出来的条目，
 * 样式据此把那一侧的边缘淡出，提示可以滚。
 */
function useScrollHints() {
  const listRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const [hints, setHints] = useState({ above: false, below: false })

  const measure = () => {
    const list = listRef.current
    if (!list) return
    const above = list.scrollTop > 1
    const below = list.scrollTop + list.clientHeight < list.scrollHeight - 1
    setHints((current) =>
      current.above === above && current.below === below ? current : { above, below },
    )
  }

  useEffect(() => {
    const list = listRef.current
    const content = contentRef.current
    if (!list || !content || typeof ResizeObserver === 'undefined') return
    // 格子变高变矮、条目增减都会改变能不能滚；观察器在开始观察时也会先报一次
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  return { listRef, contentRef, hints, onScroll: measure }
}

/**
 * 一天的卡片：日期数字在左上，条目沉在底部；条目多了就在格子里上下滚动。
 * 底色是第一条未完成待办的板块浅色；没有待办或都做完了是中性底。
 * 今天是橙色实心日期徽标；过去的日子和周末淡一档；悬停时右上角出现“＋”。
 */
export function DayCell({
  day,
  today,
  row,
  outside,
  entries,
  lanes,
  selection,
  preview,
  onMoveStart,
  tabDay,
  onDayFocus,
}: DayCellProps) {
  const iso = fromDay(day)
  const tint = cellTint(entries, lanes)
  const { listRef, contentRef, hints, onScroll } = useScrollHints()

  return (
    <div
      data-testid={`day-${iso}`}
      data-day={day}
      data-today={String(day === today)}
      data-past={String(day < today)}
      data-weekend={String(isWeekend(day))}
      data-outside={String(outside)}
      data-drop={String(preview?.day === day)}
      data-tint={tint ?? 'none'}
      data-lane-color={tint ?? undefined}
      tabIndex={day === tabDay ? 0 : -1}
      aria-label={formatDayWithYear(day)}
      onFocus={() => onDayFocus(day)}
      onDoubleClick={(event) => onBlankDoubleClick(event, day)}
      style={{ '--row': row } as React.CSSProperties}
      className="day-cell relative flex min-h-0 flex-col p-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--text)"
    >
      <span className="day-number self-start">{dayLabel(day)}</span>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`在${formatDayWithYear(day)}添加待办`}
        className="day-add cursor-pointer"
        onClick={() => addTodoOnDay(day)}
      >
        <PlusIcon aria-hidden className="size-3.5" />
      </button>
      <div
        ref={listRef}
        data-testid={`entries-${iso}`}
        data-more-above={String(hints.above)}
        data-more-below={String(hints.below)}
        onScroll={onScroll}
        // 绝对定位在日期数字下面：条目再多也不会把这一行撑高，只在这块区域里滚动。
        // 左右各留一点，条目的焦点框不会被滚动区域裁掉
        className="day-list absolute inset-x-1 top-9 bottom-1.5 flex flex-col overflow-y-auto px-0.5"
      >
        <div ref={contentRef} className="mt-auto flex flex-col gap-0.5 pt-1">
          {entries.map((entry) =>
            entry.kind === 'todo' ? (
              <TodoItem
                key={`todo-${entry.todo.id}`}
                todo={entry.todo}
                color={colorOfLane(lanes, entry.todo.laneId)}
                dragging={preview?.kind === 'todo' && preview.id === entry.todo.id}
                onMoveStart={onMoveStart}
              />
            ) : (
              <MilestoneItem
                key={`milestone-${entry.milestone.id}`}
                milestone={entry.milestone}
                color={colorOfLane(lanes, entry.milestone.laneId)}
                selected={selection?.kind === 'milestone' && selection.id === entry.milestone.id}
                dragging={preview?.kind === 'milestone' && preview.id === entry.milestone.id}
                onMoveStart={onMoveStart}
              />
            ),
          )}
        </div>
      </div>
    </div>
  )
}
