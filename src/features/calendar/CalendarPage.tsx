import { useEffect, useMemo } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { routeHref } from '@/app/useHashRoute'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { layoutMonth } from './layout'
import { setLastLaneId } from './lastLane'
import { MonthGrid } from './MonthGrid'
import { monthParam, monthTitle, monthWeeks, parseMonthParam, shiftMonth } from './month'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const navClass =
  'inline-flex size-8 items-center justify-center rounded-[8px] text-[18px] text-(--text) hover:bg-(--bg-panel) disabled:cursor-not-allowed disabled:text-(--text-muted) disabled:opacity-50 disabled:hover:bg-transparent'

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
  const layouts = layoutMonth(monthWeeks(month), {
    lanes: data.lanes,
    phases: data.phases,
    milestones: data.milestones,
    terms: data.terms,
  })

  // 最近编辑的阶段或节点在哪个板块，新建时就默认放那里
  const editedLaneId = useMemo(() => {
    if (!editing) return null
    const list = editing.kind === 'phase' ? data.phases : data.milestones
    return list.find((item) => item.id === editing.id)?.laneId ?? null
  }, [editing, data.phases, data.milestones])
  useEffect(() => {
    if (editedLaneId !== null) setLastLaneId(editedLaneId)
  }, [editedLaneId])

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
