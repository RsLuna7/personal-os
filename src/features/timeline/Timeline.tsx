import { useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStore } from '@/data/store'
import { addLaneAndRename } from '@/features/editor/AddMenu'
import { closeEditor, setTermsOpen, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { TermsDialog } from '@/features/editor/TermsDialog'
import { EmptyState } from './EmptyState'
import { LaneRow } from './LaneRow'
import { Ruler } from './Ruler'
import { dayToX, MONTH_TICK_MIN_PX_PER_DAY } from './scale'
import { monthTicks } from './ticks'
import { useToday } from './useToday'
import { LABEL_COLUMN_WIDTH, useViewport } from './useViewport'

const WHEEL_ZOOM_FACTOR = 1.1

export function Timeline() {
  const data = useStore((state) => state.data)
  const editing = useEditorStore((state) => state.editing)
  const termsOpen = useEditorStore((state) => state.termsOpen)
  const { scale, width, animating, containerRef, zoomAt, panBy } = useViewport()
  const today = useToday()

  const lanes = useMemo(() => [...data.lanes].sort((a, b) => a.order - b.order), [data.lanes])
  const gridTicks = useMemo(() => {
    const ticks = monthTicks(scale, width)
    return scale.pxPerDay >= MONTH_TICK_MIN_PX_PER_DAY
      ? ticks
      : ticks.filter((tick) => tick.month === 0)
  }, [scale, width])

  // Ctrl+滚轮缩放、横向滚轮平移；竖向滚轮留给浏览器滚动泳道
  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const anchorX = event.clientX - element.getBoundingClientRect().left - LABEL_COLUMN_WIDTH
        zoomAt(event.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR, Math.max(0, anchorX))
        return
      }
      const dx = event.deltaX !== 0 ? event.deltaX : event.shiftKey ? event.deltaY : 0
      if (dx === 0) return
      event.preventDefault()
      panBy(-dx)
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [containerRef, zoomAt, panBy])

  // 按住空白处拖动来平移
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if ((event.target as HTMLElement).closest('[role="button"], button, a, input')) return
    let lastX = event.clientX
    const onMove = (moveEvent: PointerEvent) => {
      panBy(moveEvent.clientX - lastX)
      lastX = moveEvent.clientX
    }
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

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
          <div className="relative min-h-full" onPointerDown={beginPan}>
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
                onClick={addLaneAndRename}
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
        <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      </div>
    </TooltipProvider>
  )
}
