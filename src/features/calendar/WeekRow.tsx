import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useStore, type Selection } from '@/data/store'
import { openEditor, setTermsOpen } from '@/features/editor/editorStore'
import { fromDay, toDay } from '@/features/timeline/days'
import { formatDayWithYear, formatDuration, formatRangeWithYear } from '@/features/timeline/format'
import { DayOverflow } from './DayOverflow'
import {
  SLOTS,
  type BarSegment,
  type CalendarData,
  type DotItem,
  type TermSegment,
  type WeekLayout,
} from './layout'
import { monthParam, type MonthRef } from './month'
import type { Preview } from './useCalendarDrag'

/** 学期带的高度，整个网格里有学期时每个周行都留出来。 */
export const TERM_BAND_HEIGHT = 16
/** 日期数字占的高度。 */
export const DAY_NUMBER_HEIGHT = 24
/** 一个槽（一条色条或一个圆点）的高度，含上下间隔。 */
export const SLOT_HEIGHT = 22
const ITEM_HEIGHT = SLOT_HEIGHT - 2
const BAR_INSET_PX = 2

/** 一个周行至少这么高：学期带、日期数字和三个槽，再留一点底边。 */
export const WEEK_ROW_MIN_HEIGHT = TERM_BAND_HEIGHT + DAY_NUMBER_HEIGHT + SLOTS * SLOT_HEIGHT + 6

interface WeekRowProps {
  layout: WeekLayout
  weekIndex: number
  month: MonthRef
  today: number
  /** 整个网格里有没有学期；有的话每个周行都留出学期带的位置 */
  termBand: boolean
  laneColors: ReadonlyMap<string, string>
  selection: Selection | null
  data: CalendarData
  /** 正在编辑的项目这个月没画出来（被“+N 项”收起）时，面板贴在这一天的格子上 */
  anchorPlaceholder: { testId: string; day: number } | null
  preview: Preview | null
  onCreateStart: (event: ReactPointerEvent<HTMLElement>, day: number) => void
}

function span(startCol: number, endCol: number): CSSProperties {
  return {
    left: `calc(${startCol} / 7 * 100% + ${BAR_INSET_PX}px)`,
    width: `calc(${endCol - startCol + 1} / 7 * 100% - ${BAR_INSET_PX * 2}px)`,
  }
}

function openItem(kind: 'phase' | 'milestone', id: string): void {
  useStore.getState().select({ kind, id })
  openEditor(kind, id)
}

function dayLabel(day: number): string {
  const [, month, date] = fromDay(day).split('-').map(Number)
  return date === 1 ? `${month}月1日` : String(date)
}

export function WeekRow({
  layout,
  weekIndex,
  month,
  today,
  termBand,
  laneColors,
  selection,
  data,
  anchorPlaceholder,
  preview,
  onCreateStart,
}: WeekRowProps) {
  const top = (slot: number) =>
    (termBand ? TERM_BAND_HEIGHT : 0) + DAY_NUMBER_HEIGHT + slot * SLOT_HEIGHT
  const colorOf = (laneId: string) => laneColors.get(laneId) ?? 'iris'
  const monthPrefix = monthParam(month)

  return (
    <div
      className="relative flex-1 border-b border-(--border)"
      style={{ minHeight: WEEK_ROW_MIN_HEIGHT }}
    >
      <div className="absolute inset-0 grid grid-cols-7">
        {layout.days.map((day, col) => {
          const iso = fromDay(day)
          const overflow = layout.overflow.find((cell) => cell.col === col)
          return (
            <div
              key={day}
              data-testid={`day-${iso}`}
              data-today={String(day === today)}
              data-outside={String(!iso.startsWith(monthPrefix))}
              data-preview={
                preview?.kind === 'create' && day >= preview.start && day < preview.end
                  ? 'true'
                  : undefined
              }
              onPointerDown={(event) => onCreateStart(event, day)}
              className="relative border-r border-(--border) bg-(--bg-page) px-1.5 pb-1 last:border-r-0 data-[outside=true]:bg-(--bg-canvas) data-[preview=true]:bg-(--sand-5) data-[outside=true]:text-(--text-muted)"
              style={{ paddingTop: termBand ? TERM_BAND_HEIGHT + 2 : 2 }}
            >
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[13px] [[data-today=true]>&]:bg-(--text) [[data-today=true]>&]:text-(--bg-page)">
                {dayLabel(day)}
              </span>
              {overflow && (
                <div
                  className="absolute"
                  // 弹出层在 React 树里也算在日期格里面，按下的事件不能冒泡成“新建”
                  onPointerDown={(event) => event.stopPropagation()}
                  style={{
                    left: BAR_INSET_PX,
                    right: BAR_INSET_PX,
                    top: top(SLOTS - 1),
                    height: ITEM_HEIGHT,
                  }}
                >
                  <DayOverflow day={day} count={overflow.count} data={data} />
                </div>
              )}
              {anchorPlaceholder?.day === day && (
                <span
                  aria-hidden
                  data-testid={anchorPlaceholder.testId}
                  className="pointer-events-none absolute inset-x-0 top-0 h-6"
                />
              )}
            </div>
          )
        })}
      </div>

      <div className="pointer-events-none absolute inset-0">
        {layout.terms.map((segment) => (
          <TermBand key={segment.term.id} segment={segment} weekIndex={weekIndex} />
        ))}
        {layout.bars.map((bar) => (
          <PhaseBar
            key={`${bar.phase.id}-${bar.startCol}`}
            bar={bar}
            top={top(bar.slot)}
            today={today}
            color={colorOf(bar.phase.laneId)}
            selected={selection?.kind === 'phase' && selection.id === bar.phase.id}
          />
        ))}
        {layout.dots.map((dot) => (
          <MilestoneChip
            key={dot.milestone.id}
            dot={dot}
            top={top(dot.slot)}
            color={colorOf(dot.milestone.laneId)}
            selected={selection?.kind === 'milestone' && selection.id === dot.milestone.id}
          />
        ))}
      </div>
    </div>
  )
}

function TermBand({ segment, weekIndex }: { segment: TermSegment; weekIndex: number }) {
  return (
    <button
      type="button"
      data-testid={`term-${segment.term.id}-${weekIndex}`}
      className="pointer-events-auto absolute top-0 flex cursor-pointer items-center truncate border-l border-(--border) bg-(--bg-panel) px-1.5 text-left text-[11px] text-(--text-muted) hover:text-(--text)"
      style={{ ...span(segment.startCol, segment.endCol), height: TERM_BAND_HEIGHT }}
      onClick={() => setTermsOpen(true)}
    >
      {segment.labelled && (
        <span className="truncate" title={segment.term.name}>
          {segment.term.name}
        </span>
      )}
    </button>
  )
}

interface PhaseBarProps {
  bar: BarSegment
  top: number
  today: number
  color: string
  selected: boolean
}

function PhaseBar({ bar, top, today, color, selected }: PhaseBarProps) {
  const { phase } = bar
  const start = toDay(phase.start)
  const end = toDay(phase.end)
  const label = `${phase.name}，${formatRangeWithYear(start, end)}，共 ${formatDuration(end - start)}${phase.tentative ? '，待确认' : ''}`
  const shape =
    (bar.startsHere ? 'rounded-l-[6px] ' : 'rounded-l-none border-l-0 ') +
    (bar.endsHere ? 'rounded-r-[6px]' : 'rounded-r-none border-r-0')

  return (
    <div
      data-testid={bar.labelled ? `phase-${phase.id}` : undefined}
      data-segment={bar.labelled ? undefined : phase.id}
      role="button"
      tabIndex={0}
      aria-label={label}
      data-lane-color={color}
      data-past={String(end <= today)}
      data-current={String(!phase.tentative && start <= today && today < end)}
      data-tentative={String(phase.tentative)}
      data-selected={String(selected)}
      className={`phase-block pointer-events-auto absolute flex cursor-pointer items-center border px-1.5 text-[13px] select-none ${shape}`}
      style={{ ...span(bar.startCol, bar.endCol), top, height: ITEM_HEIGHT }}
      onClick={() => openItem('phase', phase.id)}
    >
      {bar.labelled && (
        <span className="truncate" title={phase.name}>
          {phase.name}
        </span>
      )}
    </div>
  )
}

interface MilestoneChipProps {
  dot: DotItem
  top: number
  color: string
  selected: boolean
}

function MilestoneChip({ dot, top, color, selected }: MilestoneChipProps) {
  const { milestone } = dot
  return (
    <div
      data-testid={`milestone-${milestone.id}`}
      role="button"
      tabIndex={0}
      aria-label={`${milestone.name}，${formatDayWithYear(toDay(milestone.date))}`}
      data-lane-color={color}
      data-selected={String(selected)}
      className="milestone-dot pointer-events-auto absolute flex cursor-pointer items-center gap-1 rounded-[6px] px-1 select-none"
      style={{ ...span(dot.col, dot.col), top, height: ITEM_HEIGHT }}
      onClick={() => openItem('milestone', milestone.id)}
    >
      <span className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
      <span className="truncate text-[12px] text-(--text)" title={milestone.name}>
        {milestone.name}
      </span>
    </div>
  )
}
