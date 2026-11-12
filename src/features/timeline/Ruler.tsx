import type { Term } from '@/data/schema'
import { setTermsOpen } from '@/features/editor/editorStore'
import { toDay } from './days'
import { dayToX, MONTH_TICK_MIN_PX_PER_DAY, WEEK_LABEL_MIN_PX_PER_DAY, type Scale } from './scale'
import { edgeLabels, isHolidayName, monthTicks, weekLabel, weekTicks } from './ticks'
import { mondayOf } from './snap'
import { LABEL_COLUMN_WIDTH } from './useViewport'

const DAY_MS = 86_400_000

interface RulerProps {
  scale: Scale
  width: number
  terms: Term[]
}

export function Ruler({ scale, width, terms }: RulerProps) {
  const months = monthTicks(scale, width)
  const years = months.filter((tick) => tick.month === 0)
  const showMonths = scale.pxPerDay >= MONTH_TICK_MIN_PX_PER_DAY
  // 放大到一周放得下文字时多一行周刻度：学期里写“第 N 周”，学期外写周一是几号
  const showWeeks = scale.pxPerDay >= WEEK_LABEL_MIN_PX_PER_DAY
  const termSpans = terms.map((term) => ({
    start: toDay(term.start),
    end: toDay(term.end),
    holiday: isHolidayName(term.name),
  }))
  const weeks = showWeeks ? weekTicks(scale, width) : []
  const firstDay = Math.floor(scale.originDay)
  const firstDate = new Date(firstDay * DAY_MS)
  // 每一行最左边都有一个常驻标签，显示滚出左边的那一年、那个月、那一周
  const yearEdge = edgeLabels(years.map((tick) => dayToX(scale, tick.day)))
  const monthEdge = edgeLabels(months.map((tick) => dayToX(scale, tick.day)))
  const weekEdge = edgeLabels(weeks.map((tick) => dayToX(scale, tick.day)))
  const tickClass = 'absolute top-0 left-0 flex h-6 items-center border-l border-(--border) px-2'
  const leadingClass = 'absolute top-0 left-0 flex h-6 items-center px-2'

  return (
    <div
      data-testid="ruler"
      className="sticky top-0 z-20 flex border-b border-(--border) bg-(--bg-subtle) text-[12px] text-(--text-muted)"
    >
      <div className="shrink-0 border-r border-(--border)" style={{ width: LABEL_COLUMN_WIDTH }} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="relative h-6 font-medium text-(--text)">
          {yearEdge.leading && (
            <span data-testid="leading-year" className={leadingClass}>
              {firstDate.getUTCFullYear()}
            </span>
          )}
          {years.map(
            (tick, index) =>
              yearEdge.visible[index] && (
                <span
                  key={tick.year}
                  data-testid={`year-tick-${tick.year}`}
                  data-anim
                  className={tickClass}
                  style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                >
                  {tick.year}
                </span>
              ),
          )}
        </div>
        {showMonths && (
          <div className="relative h-6">
            {monthEdge.leading && (
              <span data-testid="leading-month" className={leadingClass}>
                {firstDate.getUTCMonth() + 1}月
              </span>
            )}
            {months.map(
              (tick, index) =>
                monthEdge.visible[index] && (
                  <span
                    key={`${tick.year}-${tick.month}`}
                    data-testid={`month-tick-${tick.year}-${String(tick.month + 1).padStart(2, '0')}`}
                    data-anim
                    className={tickClass}
                    style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                  >
                    {tick.month + 1}月
                  </span>
                ),
            )}
          </div>
        )}
        {showWeeks && (
          <div className="relative h-6 border-t border-(--border)">
            {weekEdge.leading && (
              <span data-testid="leading-week" className={leadingClass}>
                {weekLabel(mondayOf(firstDay), termSpans)}
              </span>
            )}
            {weeks.map(
              (tick, index) =>
                weekEdge.visible[index] && (
                  <span
                    key={tick.day}
                    data-testid={`week-tick-${tick.day}`}
                    data-anim
                    className={tickClass}
                    style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                  >
                    {weekLabel(tick.day, termSpans)}
                  </span>
                ),
            )}
          </div>
        )}
        {terms.length > 0 && (
          <div className="relative h-6 border-t border-(--border)">
            {terms.map((term) => {
              const x = dayToX(scale, toDay(term.start))
              const termWidth = (toDay(term.end) - toDay(term.start)) * scale.pxPerDay
              return (
                <button
                  type="button"
                  key={term.id}
                  onClick={() => setTermsOpen(true)}
                  data-testid={`term-${term.id}`}
                  data-anim
                  className="absolute top-0 left-0 flex h-6 cursor-pointer items-center border-l border-(--border) bg-(--bg-panel) px-2 text-left hover:text-(--text)"
                  style={{ transform: `translateX(${x}px)`, width: `${termWidth}px` }}
                >
                  <span
                    className="truncate"
                    title={term.name}
                    style={{ marginLeft: Math.max(0, Math.min(-x, termWidth - 72)) }}
                  >
                    {term.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
