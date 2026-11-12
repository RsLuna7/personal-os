import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { Lane } from '@/data/schema'
import type { Selection } from '@/data/store'
import { fromDay } from '@/features/timeline/days'
import type { DayEntry } from './cells'
import { DayCell } from './DayCell'
import { CELL_GAP_PX } from './drag'
import { monthParam, type MonthRef } from './month'
import type { MoveTarget, Preview } from './useCalendarDrag'

/** 一周一行至少这么高：日期数字加三条条目；再多就在格子里滚动。 */
const WEEK_ROW_MIN_HEIGHT = 112

interface MonthGridProps {
  weeks: number[][]
  month: MonthRef
  today: number
  lanes: Lane[]
  byDay: Map<string, DayEntry[]>
  selection: Selection | null
  gridRef: RefObject<HTMLDivElement | null>
  preview: Preview | null
  onMoveStart: (event: ReactPointerEvent<HTMLElement>, target: MoveTarget) => void
  tabDay: number
  onDayFocus: (day: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/** 月网格：每天一个独立的圆角卡片，格子之间留小间隙。 */
export function MonthGrid({
  weeks,
  month,
  today,
  lanes,
  byDay,
  selection,
  gridRef,
  preview,
  onMoveStart,
  tabDay,
  onDayFocus,
  onKeyDown,
}: MonthGridProps) {
  const monthPrefix = monthParam(month)
  return (
    <div
      ref={gridRef}
      onKeyDown={onKeyDown}
      data-testid="month-grid"
      className="grid flex-1 grid-cols-7 select-none"
      // 行高相等、没有内边距：指针位置换算成日期时只靠这个元素的外框和 CELL_GAP_PX
      style={{
        gap: CELL_GAP_PX,
        gridTemplateRows: `repeat(${weeks.length}, minmax(${WEEK_ROW_MIN_HEIGHT}px, 1fr))`,
      }}
    >
      {weeks.flat().map((day, index) => {
        const iso = fromDay(day)
        return (
          <DayCell
            key={day}
            day={day}
            today={today}
            row={Math.floor(index / 7)}
            outside={!iso.startsWith(monthPrefix)}
            entries={byDay.get(iso) ?? []}
            lanes={lanes}
            selection={selection}
            preview={preview}
            onMoveStart={onMoveStart}
            tabDay={tabDay}
            onDayFocus={onDayFocus}
          />
        )
      })}
    </div>
  )
}
