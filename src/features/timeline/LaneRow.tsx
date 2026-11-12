import { useMemo, type CSSProperties, type MouseEvent } from 'react'
import type { Lane, Milestone, Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { LaneMenu } from '@/features/editor/LaneMenu'
import { fromDay, toDay } from './days'
import { assignRows, laneHeight, MILESTONE_BAND_HEIGHT, rowCount, rowTop } from './layout'
import { MilestoneDot } from './MilestoneDot'
import { PhaseBlock } from './PhaseBlock'
import { dayToX, xToDay, type Scale } from './scale'
import { mondayOf, WEEK } from './snap'
import { useExiting } from './useExiting'
import { LABEL_COLUMN_WIDTH } from './useViewport'

export const NEW_PHASE_WEEKS = 4

interface LaneRowProps {
  /** 第几条泳道（从 0 开始）：展开动画里色块按这个依次出现 */
  index?: number
  lane: Lane
  phases: Phase[]
  milestones: Milestone[]
  scale: Scale
  today: number
  /** 只看不改：板块名不能改、空白处双击不会新建阶段 */
  readOnly?: boolean
}

export function LaneRow({
  index = 0,
  lane,
  phases,
  milestones,
  scale,
  today,
  readOnly = false,
}: LaneRowProps) {
  // Deleted items stay in the layout for the length of the fade, so nothing jumps mid-transition.
  const exitingPhases = useExiting(phases)
  const exitingMilestones = useExiting(milestones)
  const rows = useMemo(() => assignRows([...phases, ...exitingPhases]), [phases, exitingPhases])
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.date.localeCompare(b.date)),
    [milestones],
  )
  // 每个阶段在同一行里下一个阶段的左端：名称写在色块外面时不能压到它
  const nextStartX = useMemo(() => {
    const byRow = new Map<number, Phase[]>()
    for (const phase of phases) {
      const row = rows.get(phase.id) ?? 0
      byRow.set(row, [...(byRow.get(row) ?? []), phase])
    }
    const result = new Map<string, number>()
    for (const list of byRow.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
      list.forEach((phase, index) => {
        const next = list[index + 1]
        if (next) result.set(phase.id, dayToX(scale, toDay(next.start)))
      })
    }
    return result
  }, [phases, rows, scale])
  const band = milestones.length + exitingMilestones.length > 0 ? MILESTONE_BAND_HEIGHT : 0
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
    openEditor('phase', id, true)
  }

  return (
    <div
      data-testid={`lane-${lane.id}`}
      data-lane-color={lane.color}
      className="lane-row relative flex"
      style={{ height: `${height}px`, '--lane-i': index } as CSSProperties}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-r border-(--border) px-3"
        style={{ width: LABEL_COLUMN_WIDTH }}
      >
        <span className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
        {readOnly ? (
          <span
            title={lane.name}
            className="min-w-0 truncate text-[14px] font-medium text-(--text)"
          >
            {lane.name}
          </span>
        ) : (
          <LaneMenu laneId={lane.id} />
        )}
      </div>
      <div
        data-testid={`lane-${lane.id}-canvas`}
        className="relative min-w-0 flex-1 overflow-hidden"
        onDoubleClick={readOnly ? undefined : createPhaseAt}
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
              readOnly={readOnly}
            />
          )
        })}
        {exitingMilestones.map((milestone) => (
          <MilestoneDot
            key={milestone.id}
            milestone={milestone}
            scale={scale}
            today={today}
            nextX={null}
            exiting
          />
        ))}
        {exitingPhases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            scale={scale}
            top={band + rowTop(rows.get(phase.id) ?? 0)}
            today={today}
            exiting
            readOnly={readOnly}
          />
        ))}
        {phases.map((phase) => (
          <PhaseBlock
            key={phase.id}
            phase={phase}
            scale={scale}
            top={band + rowTop(rows.get(phase.id) ?? 0)}
            today={today}
            nextX={nextStartX.get(phase.id) ?? null}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  )
}
