import type { Term } from '@/data/schema'
import { toDay } from './days'
import { dayToX, MONTH_TICK_MIN_PX_PER_DAY, type Scale } from './scale'
import { monthTicks } from './ticks'
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
  /** 年初滚出左边时，最左侧仍然显示当前年份 */
  const leadingYear = new Date(Math.floor(scale.originDay) * DAY_MS).getUTCFullYear()
  const yearClass =
    'absolute top-0 left-0 z-10 flex h-6 items-center bg-(--bg-subtle) px-2 font-medium text-(--text)'

  return (
    <div
      data-testid="ruler"
      className="sticky top-0 z-20 flex border-b border-(--border) bg-(--bg-subtle) text-[12px] text-(--text-muted)"
    >
      <div className="shrink-0 border-r border-(--border)" style={{ width: LABEL_COLUMN_WIDTH }} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="relative h-6">
          <span className={yearClass}>{leadingYear}</span>
          {years.map((tick) => (
            <span
              key={tick.year}
              data-testid={`year-tick-${tick.year}`}
              data-anim
              className={`${yearClass} border-l border-(--border)`}
              style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
            >
              {tick.year}
            </span>
          ))}
        </div>
        {showMonths && (
          <div className="relative h-6">
            {months.map((tick) => (
              <span
                key={`${tick.year}-${tick.month}`}
                data-testid={`month-tick-${tick.year}-${String(tick.month + 1).padStart(2, '0')}`}
                data-anim
                className="absolute top-0 left-0 flex h-6 items-center border-l border-(--border) px-2"
                style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
              >
                {tick.month + 1}月
              </span>
            ))}
          </div>
        )}
        {terms.length > 0 && (
          <div className="relative h-6 border-t border-(--border)">
            {terms.map((term) => {
              const x = dayToX(scale, toDay(term.start))
              const termWidth = (toDay(term.end) - toDay(term.start)) * scale.pxPerDay
              return (
                <div
                  key={term.id}
                  data-testid={`term-${term.id}`}
                  data-anim
                  className="absolute top-0 left-0 flex h-6 items-center border-l border-(--border) bg-(--bg-panel) px-2"
                  style={{ transform: `translateX(${x}px)`, width: `${termWidth}px` }}
                >
                  <span
                    className="truncate"
                    title={term.name}
                    style={{ marginLeft: Math.max(0, Math.min(-x, termWidth - 72)) }}
                  >
                    {term.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
