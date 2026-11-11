import type { Lane } from '@/data/schema'
import type { Selection } from '@/data/store'
import type { WeekLayout } from './layout'
import type { MonthRef } from './month'
import { WeekRow } from './WeekRow'

interface MonthGridProps {
  layouts: WeekLayout[]
  month: MonthRef
  today: number
  lanes: Lane[]
  hasTerms: boolean
  selection: Selection | null
}

/** 月网格：每个周行 7 格，项目叠在格子上面。 */
export function MonthGrid({ layouts, month, today, lanes, hasTerms, selection }: MonthGridProps) {
  const laneColors = new Map(lanes.map((lane) => [lane.id, lane.color]))
  return (
    <div
      data-testid="month-grid"
      className="flex min-h-full flex-col border-t border-l border-(--border)"
    >
      {layouts.map((layout, index) => (
        <WeekRow
          key={layout.days[0]}
          layout={layout}
          weekIndex={index}
          month={month}
          today={today}
          termBand={hasTerms}
          laneColors={laneColors}
          selection={selection}
        />
      ))}
    </div>
  )
}
