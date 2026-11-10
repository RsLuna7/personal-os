import { useMemo } from 'react'
import { PlusIcon } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore } from '@/data/store'
import { EmptyState } from './EmptyState'
import { LaneRow } from './LaneRow'
import { Ruler } from './Ruler'
import { dayToX, MONTH_TICK_MIN_PX_PER_DAY } from './scale'
import { monthTicks } from './ticks'
import { useToday } from './useToday'
import { LABEL_COLUMN_WIDTH, useViewport } from './useViewport'

export function Timeline() {
  const data = useStore((state) => state.data)
  const addLane = useStore((state) => state.addLane)
  const { scale, width, animating, containerRef } = useViewport()
  const today = useToday()

  const lanes = useMemo(() => [...data.lanes].sort((a, b) => a.order - b.order), [data.lanes])
  const gridTicks = useMemo(() => {
    const ticks = monthTicks(scale, width)
    return scale.pxPerDay >= MONTH_TICK_MIN_PX_PER_DAY
      ? ticks
      : ticks.filter((tick) => tick.month === 0)
  }, [scale, width])

  return (
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        data-testid="timeline"
        data-animate={String(animating)}
        className="timeline relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        {lanes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative min-h-full">
            <Ruler scale={scale} width={width} terms={data.terms} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
              style={{ left: LABEL_COLUMN_WIDTH }}
            >
              {gridTicks.map((tick) => (
                <div
                  key={`${tick.year}-${tick.month}`}
                  data-anim
                  className="absolute inset-y-0 left-0 w-px bg-(--bg-panel)"
                  style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                />
              ))}
            </div>
            {lanes.map((lane) => (
              <LaneRow
                key={lane.id}
                lane={lane}
                phases={data.phases.filter((phase) => phase.laneId === lane.id)}
                milestones={data.milestones.filter((milestone) => milestone.laneId === lane.id)}
                scale={scale}
                today={today}
              />
            ))}
            <div className="relative flex h-14 items-center px-2">
              <button
                type="button"
                className="flex items-center gap-1 rounded-[6px] px-2 py-1 text-[14px] text-(--text-muted) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-panel) hover:text-(--text)"
                onClick={() => addLane()}
              >
                <PlusIcon className="size-4" aria-hidden />
                添加板块
              </button>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 z-30 overflow-hidden"
              style={{ left: LABEL_COLUMN_WIDTH }}
            >
              <div
                data-testid="today-line"
                data-anim
                className="absolute inset-y-0 left-0 w-0.5 bg-(--today)"
                style={{ transform: `translateX(${dayToX(scale, today)}px)` }}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
