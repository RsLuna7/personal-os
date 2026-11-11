import type { Milestone } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from '@/features/timeline/days'
import { formatDayWithYear } from '@/features/timeline/format'
import type { EntryColor } from './cells'
import type { MoveTarget } from './useCalendarDrag'

interface MilestoneItemProps {
  milestone: Milestone
  color: EntryColor
  selected: boolean
  dragging: boolean
  onMoveStart: (event: React.PointerEvent<HTMLElement>, target: MoveTarget) => void
}

/** 一个节点：小菱形加名称，和待办的竖条明显不同。 */
export function MilestoneItem({
  milestone,
  color,
  selected,
  dragging,
  onMoveStart,
}: MilestoneItemProps) {
  return (
    <div
      data-testid={`milestone-${milestone.id}`}
      role="button"
      tabIndex={0}
      data-item="milestone"
      data-item-id={milestone.id}
      aria-label={`节点：${milestone.name}，${formatDayWithYear(toDay(milestone.date))}`}
      data-lane-color={color}
      data-selected={String(selected)}
      data-dragging={String(dragging)}
      className="milestone-dot flex min-h-5 min-w-0 cursor-grab touch-none items-center gap-1.5 rounded-[4px] text-[12px] select-none"
      onFocus={() => useStore.getState().select({ kind: 'milestone', id: milestone.id })}
      onPointerDown={(event) => onMoveStart(event, { kind: 'milestone', id: milestone.id })}
    >
      <span aria-hidden className="size-2 shrink-0 rotate-45 bg-(--lane-dot)" />
      <span className="truncate font-medium" title={milestone.name}>
        {milestone.name}
      </span>
    </div>
  )
}
