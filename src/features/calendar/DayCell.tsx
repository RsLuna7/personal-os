import type { MouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import type { Lane } from '@/data/schema'
import type { Selection } from '@/data/store'
import { fromDay } from '@/features/timeline/days'
import { formatDayWithYear } from '@/features/timeline/format'
import { colorOfLane, visibleEntries, type DayEntry } from './cells'
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
  /** 这一天的全部条目，已排好序；格子里只显示前几条，其余收进“+N” */
  entries: DayEntry[]
  /** 永远要显示的条目（正在编辑、正在拖动的），不管排第几 */
  pinnedIds: readonly (string | null | undefined)[]
  /** 这一天正以放大视图打开：格子里不再画条目（放大视图里画同样的一份） */
  expanded: boolean
  onOpenDay: (day: number) => void
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
 * 一天的卡片：日期数字在左上，条目紧跟在它下面，最多直接显示三条；多出来的在右上角写“+N”，点开看全部。
 * 今天是橙色实心日期徽标；过去的日子和周末淡一档；悬停时右上角出现“＋”。
 */
export function DayCell({
  day,
  today,
  row,
  outside,
  entries,
  pinnedIds,
  expanded,
  onOpenDay,
  lanes,
  selection,
  preview,
  onMoveStart,
  tabDay,
  onDayFocus,
}: DayCellProps) {
  const iso = fromDay(day)
  const { shown, hidden } = visibleEntries(entries, pinnedIds)

  return (
    <div
      data-testid={`day-${iso}`}
      data-day={day}
      data-today={String(day === today)}
      data-past={String(day < today)}
      data-weekend={String(isWeekend(day))}
      data-outside={String(outside)}
      data-drop={String(preview?.day === day)}
      data-expanded={String(expanded)}
      tabIndex={day === tabDay ? 0 : -1}
      aria-label={formatDayWithYear(day)}
      onFocus={() => onDayFocus(day)}
      onDoubleClick={(event) => onBlankDoubleClick(event, day)}
      style={{ '--row': row } as React.CSSProperties}
      className="day-cell relative flex min-h-0 flex-col p-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--text)"
    >
      <span className="day-number self-start">{dayLabel(day)}</span>
      {hidden > 0 && (
        <button
          type="button"
          data-testid={`more-${iso}`}
          aria-label={`查看${formatDayWithYear(day)}的全部 ${entries.length} 项`}
          aria-haspopup="dialog"
          className="day-more cursor-pointer"
          onClick={() => onOpenDay(day)}
        >
          +{hidden}
        </button>
      )}
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
        data-testid={`entries-${iso}`}
        // 绝对定位在日期数字下面，不撑高这一行；一格最多三条，装得下，不需要滚动
        className="day-list absolute inset-x-1 top-9 bottom-1.5 flex flex-col overflow-hidden px-0.5"
      >
        <div className="flex flex-col gap-0.5 pt-1">
          {(expanded ? [] : shown).map((entry) =>
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
