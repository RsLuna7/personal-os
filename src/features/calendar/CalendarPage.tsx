import { useEffect, useMemo, useRef } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { routeHref } from '@/app/useHashRoute'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { fromDay, toDay } from '@/features/timeline/days'
import { layoutMonth, type CalendarData, type WeekLayout } from './layout'
import { setLastLaneId } from './lastLane'
import { MonthGrid } from './MonthGrid'
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

/**
 * 正在编辑的项目如果这个月没有画出来（被“+N 项”收起了），编辑面板就没有东西可贴；
 * 这时在它所在的第一天放一个看不见的锚点。
 */
function hiddenAnchor(
  editing: { kind: 'phase' | 'milestone'; id: string } | null,
  data: CalendarData,
  layouts: WeekLayout[],
): { testId: string; day: number } | null {
  if (!editing) return null
  const firstDay = layouts[0]?.days[0]
  const lastDay = layouts[layouts.length - 1]?.days[6]
  if (firstDay === undefined || lastDay === undefined) return null

  if (editing.kind === 'phase') {
    const phase = data.phases.find((item) => item.id === editing.id)
    if (!phase) return null
    if (layouts.some((week) => week.bars.some((bar) => bar.phase.id === phase.id))) return null
    const day = Math.max(toDay(phase.start), firstDay)
    if (day >= toDay(phase.end) || day > lastDay) return null
    return { testId: `phase-${phase.id}`, day }
  }
  const milestone = data.milestones.find((item) => item.id === editing.id)
  if (!milestone) return null
  if (layouts.some((week) => week.dots.some((dot) => dot.milestone.id === milestone.id)))
    return null
  const day = toDay(milestone.date)
  return day >= firstDay && day <= lastDay ? { testId: `milestone-${milestone.id}`, day } : null
}

/**
 * 正在编辑的项目存在，但这个月既没画出来、也没有收起的位置可贴（比如在面板里把日期
 * 改到了别的月）：返回它该去的那一天；其他情况返回 null。
 */
function offscreenEditedDay(
  editing: { kind: 'phase' | 'milestone'; id: string } | null,
  data: CalendarData,
  layouts: WeekLayout[],
  anchorPlaceholder: unknown,
): number | null {
  if (!editing || anchorPlaceholder) return null
  if (editing.kind === 'phase') {
    const phase = data.phases.find((item) => item.id === editing.id)
    if (!phase || layouts.some((week) => week.bars.some((bar) => bar.phase.id === phase.id)))
      return null
    return toDay(phase.start)
  }
  const milestone = data.milestones.find((item) => item.id === editing.id)
  if (
    !milestone ||
    layouts.some((week) => week.dots.some((dot) => dot.milestone.id === milestone.id))
  )
    return null
  return toDay(milestone.date)
}

/** 拖动中把被拖的那一项换成预览的日期，预览和最终结果用同一套排版。 */
function withPreview(data: CalendarData, preview: Preview | null): CalendarData {
  if (preview?.kind === 'phase') {
    return {
      ...data,
      phases: data.phases.map((phase) =>
        phase.id === preview.id
          ? { ...phase, start: fromDay(preview.start), end: fromDay(preview.end) }
          : phase,
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

/** 日历：一个月一屏，看阶段、节点和学期。 */
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
  const { preview, beginCreate, beginMove } = useCalendarDrag({ gridRef, weeks })
  const { tabDay, onDayFocus, onKeyDown } = useCalendarKeys({ month, today })
  const calendarData = withPreview(
    {
      lanes: data.lanes,
      phases: data.phases,
      milestones: data.milestones,
      terms: data.terms,
    },
    preview,
  )
  const layouts = layoutMonth(weeks, calendarData)
  const anchorPlaceholder = hiddenAnchor(editing, calendarData, layouts)

  // 最近编辑的阶段或节点在哪个板块，新建时就默认放那里
  const editedLaneId = useMemo(() => {
    if (!editing) return null
    const list = editing.kind === 'phase' ? data.phases : data.milestones
    return list.find((item) => item.id === editing.id)?.laneId ?? null
  }, [editing, data.phases, data.milestones])
  useEffect(() => {
    if (editedLaneId !== null) setLastLaneId(editedLaneId)
  }, [editedLaneId])

  // 编辑面板跟着项目走：项目换到别的月，就翻到那个月；那个月翻不到就关掉面板
  const offscreenDay = offscreenEditedDay(editing, calendarData, layouts, anchorPlaceholder)
  useEffect(() => {
    if (offscreenDay === null) return
    const [year, monthNumber] = fromDay(offscreenDay).split('-').map(Number)
    const target = { year: year!, month: monthNumber! }
    if (target.year < MIN_YEAR || target.year > MAX_YEAR) closeEditor()
    else window.location.replace(routeHref('calendar', monthParam(target)))
  }, [offscreenDay])

  // 面板关掉后焦点会掉到页面上，方向键、Delete、Esc 就没人接了：把焦点还给刚编辑的项目。
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

  if (data.lanes.length === 0) return <EmptyState />

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
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div
          data-testid="weekdays"
          className="grid grid-cols-7 border-l border-(--border) bg-(--bg-page) text-center text-[13px] text-(--text-muted)"
        >
          {WEEKDAYS.map((name) => (
            <span key={name} className="border-r border-(--border) py-1.5 last:border-r-0">
              {name}
            </span>
          ))}
        </div>
        <MonthGrid
          layouts={layouts}
          month={month}
          today={today}
          lanes={data.lanes}
          hasTerms={data.terms.length > 0}
          selection={selection}
          data={calendarData}
          anchorPlaceholder={anchorPlaceholder}
          gridRef={gridRef}
          preview={preview}
          onCreateStart={beginCreate}
          onMoveStart={beginMove}
          tabDay={tabDay}
          onDayFocus={onDayFocus}
          onKeyDown={onKeyDown}
        />
      </div>
      {editing?.kind === 'phase' && (
        <PhaseEditor
          phaseId={editing.id}
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
