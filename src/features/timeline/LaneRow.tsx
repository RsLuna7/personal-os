import { useMemo, type MouseEvent } from 'react'
import type { Lane, Milestone, Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { fromDay, toDay } from './days'
import { assignRows, laneHeight, MILESTONE_BAND_HEIGHT, rowCount, rowTop } from './layout'
import { MilestoneDot } from './MilestoneDot'
import { PhaseBlock } from './PhaseBlock'
import { dayToX, xToDay, type Scale } from './scale'
import { mondayOf, WEEK } from './snap'
import { LABEL_COLUMN_WIDTH } from './useViewport'

export const NEW_PHASE_WEEKS = 4

interface LaneRowProps {
  lane: Lane
  phases: Phase[]
  milestones: Milestone[]
  scale: Scale
  today: number
  onPhaseCreated?: (phaseId: string) => void
}

export function LaneRow({ lane, phases, milestones, scale, today, onPhaseCreated }: LaneRowProps) {
  const rows = useMemo(() => assignRows(phases), [phases])
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones],
  )
  const band = milestones.length > 0 ? MILESTONE_BAND_HEIGHT : 0
  const height = laneHeight(rowCount(rows)) + band

  const createPhaseAt = (event: MouseEvent<HTMLDivElement>) => {
    const x = event.clientX - event.currentTarget.getBoundingClientRect().left
    const start = mondayOf(xToDay(scale, x))
    const store = useStore.getState()
    const id = store.addPhase({
      laneId: lane.id,
      start: fromDay(start),
      end: fromDay(start + NEW_PHASE_WEEKS * WEEK),
    })
    store.select({ kind: 'phase', id })
    onPhaseCreated?.(id)
  }

  return (
    <div
      data-testid={`lane-${lane.id}`}
      data-lane-color={lane.color}
      className="relative flex border-b border-(--border)"
      style={{ height: `${height}px` }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-r border-(--border) bg-(--bg-page) px-3"
        style={{ width: LABEL_COLUMN_WIDTH }}
      >
        <span className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
        <span className="truncate text-[14px] font-medium text-(--text)" title={lane.name}>
          {lane.name}
        </span>
      </div>
      <div
        data-testid={`lane-${lane.id}-canvas`}
        className="relative min-w-0 flex-1 overflow-hidden"
        onDoubleClick={createPhaseAt}
      >
        {sortedMilestones.map((milestone, index) => {
          const next = sortedMilestones[index + 1]
          return (
            <MilestoneDot
              key={milestone.id}
              milestone={milestone}
              scale={scale}
              today={today}
              nextX={next ? dayToX(scale, toDay(next.date)) : null}
            />
          )
        })}
        {phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            scale={scale}
            top={band + rowTop(rows.get(phase.id) ?? 0)}
            today={today}
          />
        ))}
      </div>
    </div>
  )
}
