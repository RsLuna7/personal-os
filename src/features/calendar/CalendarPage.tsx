import { useEffect, useRef } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore, type Editing } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { TodoEditor } from '@/features/editor/TodoEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { routeHref } from '@/app/useHashRoute'
import { useToday } from '@/features/timeline/useToday'
import { fromDay, toDay } from '@/features/timeline/days'
import { entriesByDay, unscheduledTodos, type CalendarData } from './cells'
import { MonthGrid } from './MonthGrid'
import { UnscheduledList } from './UnscheduledList'
import { useCalendarDrag, type Preview } from './useCalendarDrag'
import { useCalendarKeys } from './useCalendarKeys'
import {
  MAX_YEAR,
  MIN_YEAR,
  monthParam,
  monthTitle,
  monthWeeks,
  parseMonthParam,
  shiftMonth,
} from './month'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const navClass =
  'inline-flex size-8 items-center justify-center rounded-[8px] text-[18px] text-(--text) hover:bg-(--bg-panel) disabled:cursor-not-allowed disabled:text-(--text-muted) disabled:opacity-50 disabled:hover:bg-transparent'

type EditingItem = Pick<Editing, 'kind' | 'id'>

/** 正在编辑的待办或节点现在的日期；没有日期（未安排）或找不到时是 null。 */
function editedDate(editing: EditingItem | null, data: CalendarData): string | null {
  if (editing?.kind === 'todo')
    return data.todos.find((item) => item.id === editing.id)?.date ?? null
  if (editing?.kind === 'milestone') {
    return data.milestones.find((item) => item.id === editing.id)?.date ?? null
  }
  return null
}

/**
 * 正在编辑的条目有日期，但在这个月的网格之外（比如在面板里把日期改到了别的月）：
 * 返回它该去的那一天；其他情况返回 null。
 */
function offscreenEditedDay(
  editing: EditingItem | null,
  data: CalendarData,
  weeks: number[][],
): number | null {
  const date = editedDate(editing, data)
  if (date === null) return null
  const day = toDay(date)
  return weeks.some((week) => week.includes(day)) ? null : day
}

/** 拖动中把被拖的那一项换成预览的日期，预览和最终结果用同一套排版。 */
function withPreview(data: CalendarData, preview: Preview | null): CalendarData {
  if (preview?.kind === 'todo') {
    return {
      ...data,
      todos: data.todos.map((todo) =>
        todo.id === preview.id ? { ...todo, date: fromDay(preview.day) } : todo,
      ),
    }
  }
  if (preview?.kind === 'milestone') {
    return {
      ...data,
      milestones: data.milestones.map((milestone) =>
        milestone.id === preview.id ? { ...milestone, date: fromDay(preview.day) } : milestone,
      ),
    }
  }
  return data
}

interface CalendarPageProps {
  /** 网址里的月份（2026-11）；缺省或不合法时用今天所在的月 */
  param: string | null
}

/** 日历：一个月一屏，每天一张卡片，放当天的待办和节点；右侧是还没有日期的待办。 */
export function CalendarPage({ param }: CalendarPageProps) {
  const data = useStore((state) => state.data)
  const selection = useStore((state) => state.selection)
  const editing = useEditorStore((state) => state.editing)
  const today = useToday()
  useUndoKeys()

  const month = parseMonthParam(param, today)
  // 数据量很小，不手动缓存；React Compiler 会按输入缓存
  const weeks = monthWeeks(month)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const { preview, beginMove } = useCalendarDrag({ gridRef, weeks })
  const { tabDay, onDayFocus, onKeyDown } = useCalendarKeys({ month, today })
  const calendarData = withPreview(
    { lanes: data.lanes, milestones: data.milestones, todos: data.todos },
    preview,
  )
  const byDay = entriesByDay(calendarData)
  const unscheduled = unscheduledTodos(calendarData)

  // 编辑面板跟着条目走：条目换到别的月，就翻到那个月；那个月翻不到就关掉面板
  const offscreenDay = offscreenEditedDay(editing, calendarData, weeks)
  useEffect(() => {
    if (offscreenDay === null) return
    const [year, monthNumber] = fromDay(offscreenDay).split('-').map(Number)
    const target = { year: year!, month: monthNumber! }
    if (target.year < MIN_YEAR || target.year > MAX_YEAR) closeEditor()
    else window.location.replace(routeHref('calendar', monthParam(target)))
  }, [offscreenDay])

  // 一天的条目多了会在格子里滚动：开始编辑的那一条（比如刚新建的）要滚进视野，面板才有地方贴
  const editingId = editing?.id ?? null
  useEffect(() => {
    if (editingId === null) return
    const item = document.querySelector<HTMLElement>(`[data-item-id="${editingId}"]`)
    item?.scrollIntoView?.({ block: 'nearest' })
  }, [editingId])

  // 面板关掉后焦点会掉到页面上，方向键、Delete、Esc 就没人接了：把焦点还给刚编辑的条目。
  // 点到别处关掉的（焦点已经在别的东西上）不去抢。
  const previousEditing = useRef(editing)
  useEffect(() => {
    const was = previousEditing.current
    previousEditing.current = editing
    if (!was || editing) return
    const active = document.activeElement
    if (active && active !== document.body) return
    const item = document.querySelector<HTMLElement>(`[data-item-id="${was.id}"]`)
    const fallback = document.querySelector<HTMLElement>('[data-day][tabindex="0"]')
    ;(item ?? fallback)?.focus()
  }, [editing])

  // 离开日历页时面板要一起关，否则它会留在状态里，回到别的页面又冒出来
  useEffect(() => closeEditor, [])

  const previous = shiftMonth(month, -1)
  const next = shiftMonth(month, 1)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-(--bg-page)">
      <div className="flex shrink-0 items-center gap-2 px-6 pt-4 pb-3">
        {previous ? (
          <a
            href={routeHref('calendar', monthParam(previous))}
            aria-label="上个月"
            className={navClass}
          >
            ‹
          </a>
        ) : (
          <button type="button" disabled aria-label="上个月" className={navClass}>
            ‹
          </button>
        )}
        <h1 className="min-w-[8ch] text-center text-[18px] font-medium text-(--text)">
          {monthTitle(month)}
        </h1>
        {next ? (
          <a
            href={routeHref('calendar', monthParam(next))}
            aria-label="下个月"
            className={navClass}
          >
            ›
          </a>
        ) : (
          <button type="button" disabled aria-label="下个月" className={navClass}>
            ›
          </button>
        )}
        <a
          href={routeHref('calendar')}
          className="ml-2 inline-flex h-8 items-center rounded-[8px] border border-(--border) px-3 text-[14px] text-(--text) hover:bg-(--bg-panel)"
        >
          今天
        </a>
      </div>
      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div
            data-testid="weekdays"
            className="sticky top-0 z-10 grid shrink-0 grid-cols-7 gap-1.5 bg-(--bg-page) pb-1.5 text-center text-[13px] text-(--text-muted)"
          >
            {WEEKDAYS.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <MonthGrid
            weeks={weeks}
            month={month}
            today={today}
            lanes={data.lanes}
            byDay={byDay}
            selection={selection}
            gridRef={gridRef}
            preview={preview}
            onMoveStart={beginMove}
            tabDay={tabDay}
            onDayFocus={onDayFocus}
            onKeyDown={onKeyDown}
          />
        </div>
        <UnscheduledList
          todos={unscheduled}
          lanes={data.lanes}
          preview={preview}
          onMoveStart={beginMove}
          onKeyDown={onKeyDown}
        />
      </div>
      {editing?.kind === 'todo' && (
        <TodoEditor
          todoId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
      {editing?.kind === 'milestone' && (
        <MilestoneEditor
          milestoneId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
