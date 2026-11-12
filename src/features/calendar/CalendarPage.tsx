import { useEffect, useRef, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore, type Editing } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { TodoEditor } from '@/features/editor/TodoEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { routeHref } from '@/app/useHashRoute'
import { runViewTransition } from '@/app/viewTransition'
import { useToday } from '@/features/timeline/useToday'
import { fromDay, toDay } from '@/features/timeline/days'
import {
  entriesByDay,
  filterByLanes,
  laneKey,
  NEUTRAL,
  unscheduledTodos,
  type CalendarData,
} from './cells'
import { DayFocus } from './DayFocus'
import { LaneFilter } from './LaneFilter'
import { MonthGrid } from './MonthGrid'
import { UnscheduledList } from './UnscheduledList'
import { useCalendarDrag, type Preview } from './useCalendarDrag'
import { useCalendarKeys } from './useCalendarKeys'
import { MAX_YEAR, MIN_YEAR, monthParam, monthWeeks, parseMonthParam, shiftMonth } from './month'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const navClass =
  'inline-flex size-9 items-center justify-center rounded-full bg-(--bg-card) text-(--text) shadow-(--shadow-card) transition-shadow duration-(--dur-fast) ease-(--ease-out) hover:shadow-(--shadow-card-hover) disabled:cursor-not-allowed disabled:text-(--text-muted) disabled:opacity-50 disabled:shadow-none'

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
  const { tabDay, onDayFocus, onKeyDown, movedId } = useCalendarKeys({ month, today })
  // 放大视图开着的那一天；换到别的月、那一天不在网格里，就等于关了
  const [focusedDay, setFocusedDay] = useState<number | null>(null)
  const openDay =
    focusedDay !== null && weeks.some((week) => week.includes(focusedDay)) ? focusedDay : null
  const calendarData = withPreview(
    { lanes: data.lanes, milestones: data.milestones, todos: data.todos },
    preview,
  )
  // 板块筛选只影响“显示什么”：编辑、拖动、翻月仍然用完整的数据
  const [activeLanes, setActiveLanes] = useState<string[]>([])
  const laneKeys = new Set([...data.lanes.map((lane) => lane.id), NEUTRAL])
  const active = new Set(activeLanes.filter((key) => laneKeys.has(key)))
  const hasNeutral =
    data.todos.some((todo) => laneKey(data.lanes, todo.laneId) === NEUTRAL) ||
    data.milestones.some((item) => laneKey(data.lanes, item.laneId) === NEUTRAL)
  const byDay = entriesByDay(
    filterByLanes(calendarData, active, [editing?.id, preview?.id, movedId]),
  )
  const unscheduled = unscheduledTodos(calendarData)

  /** 那一格放大成卡片：格子和卡片共用 view-transition-name，浏览器把它从格子的位置放大到页面中央。 */
  const dayElement = (day: number) => document.querySelector<HTMLElement>(`[data-day="${day}"]`)
  const openDayFocus = (day: number) => {
    const cell = dayElement(day)
    if (cell) cell.style.viewTransitionName = 'day-surface'
    runViewTransition('day-open', () => {
      if (cell) cell.style.viewTransitionName = ''
      setFocusedDay(day)
    })
  }
  const closeDayFocus = () => {
    if (openDay === null) return
    const day = openDay
    const cell = dayElement(day)
    runViewTransition(
      'day-close',
      () => {
        if (cell) cell.style.viewTransitionName = 'day-surface'
        setFocusedDay(null)
      },
      () => {
        if (cell) cell.style.viewTransitionName = ''
        // 焦点回到打开它的“+N”
        const iso = fromDay(day)
        ;(
          document.querySelector<HTMLElement>(`[data-testid="more-${iso}"]`) ?? dayElement(day)
        )?.focus()
      },
    )
  }

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
    <div className="flex min-h-0 flex-1 flex-col bg-(--bg-canvas)">
      <div className="flex shrink-0 items-center gap-2 px-6 pt-5 pb-4">
        {/* 年份小字在前、月份大字在后；连起来读还是“2026年11月” */}
        <h1 className="mr-3 flex min-w-[9ch] items-baseline gap-1.5 text-(--text)">
          <span className="text-[14px] text-(--text-muted)">{month.year}年</span>
          <span className="font-serif text-[30px] leading-none font-bold">{month.month}月</span>
        </h1>
        {previous ? (
          <a
            href={routeHref('calendar', monthParam(previous))}
            aria-label="上个月"
            className={navClass}
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
          </a>
        ) : (
          <button type="button" disabled aria-label="上个月" className={navClass}>
            <ChevronLeftIcon aria-hidden className="size-4" />
          </button>
        )}
        {next ? (
          <a
            href={routeHref('calendar', monthParam(next))}
            aria-label="下个月"
            className={navClass}
          >
            <ChevronRightIcon aria-hidden className="size-4" />
          </a>
        ) : (
          <button type="button" disabled aria-label="下个月" className={navClass}>
            <ChevronRightIcon aria-hidden className="size-4" />
          </button>
        )}
        <a
          href={routeHref('calendar')}
          className="ml-1 inline-flex h-9 items-center rounded-full bg-(--bg-card) px-4 text-[14px] text-(--text) shadow-(--shadow-card) transition-shadow duration-(--dur-fast) ease-(--ease-out) hover:shadow-(--shadow-card-hover)"
        >
          今天
        </a>
        <LaneFilter
          lanes={data.lanes}
          hasNeutral={hasNeutral}
          active={active}
          onToggle={(key) =>
            setActiveLanes(
              active.has(key) ? [...active].filter((k) => k !== key) : [...active, key],
            )
          }
          onClear={() => setActiveLanes([])}
        />
      </div>
      <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <div
            data-testid="weekdays"
            className="sticky top-0 z-10 grid shrink-0 grid-cols-7 gap-1.5 bg-(--bg-canvas) pb-2 text-left text-[12px] font-medium tracking-wide text-(--text-muted)"
          >
            {/* 和格子里的日期数字左对齐；周末再淡一档 */}
            {WEEKDAYS.map((name, index) => (
              <span key={name} className={`px-2.5 ${index >= 5 ? 'opacity-60' : ''}`}>
                {name}
              </span>
            ))}
          </div>
          <MonthGrid
            weeks={weeks}
            month={month}
            today={today}
            lanes={data.lanes}
            byDay={byDay}
            selection={selection}
            pinnedIds={[editing?.id, preview?.id, movedId]}
            expandedDay={openDay}
            onOpenDay={openDayFocus}
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
      {openDay !== null && (
        <DayFocus
          day={openDay}
          today={today}
          entries={byDay.get(fromDay(openDay)) ?? []}
          lanes={data.lanes}
          selection={selection}
          onClose={closeDayFocus}
        />
      )}
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
