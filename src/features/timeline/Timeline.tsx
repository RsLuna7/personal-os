import { useEffect, useMemo, type PointerEvent as ReactPointerEvent } from 'react'
import { PlusIcon } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { Milestone, Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { addLaneAndRename } from '@/features/editor/AddMenu'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { EmptyState } from './EmptyState'
import { LaneRow } from './LaneRow'
import { Ruler } from './Ruler'
import { dayToX, MONTH_TICK_MIN_PX_PER_DAY, WEEK_LINE_MIN_PX_PER_DAY } from './scale'
import { monthTicks, weekTicks } from './ticks'
import { useTimelineKeys } from './useTimelineKeys'
import { useToday } from './useToday'
import { LABEL_COLUMN_WIDTH, useViewport } from './useViewport'

const WHEEL_ZOOM_FACTOR = 1.1
const NO_PHASES: Phase[] = []
const NO_MILESTONES: Milestone[] = []

function groupByLane<T extends { laneId: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(item.laneId)
    if (group) group.push(item)
    else groups.set(item.laneId, [item])
  }
  return groups
}

interface TimelineProps {
  /** 只看不改：用在主页的卡片里，不能编辑、拖动，也没有键盘快捷键 */
  readOnly?: boolean
  /** 滚动容器的额外样式，卡片用它限制高度 */
  className?: string
  /** 只画这些板块的泳道；不传就全部画。主页卡片用它藏起后面什么都没安排的板块 */
  laneIds?: ReadonlySet<string>
}

export function Timeline({ readOnly = false, className = '', laneIds }: TimelineProps) {
  const data = useStore((state) => state.data)
  const editing = useEditorStore((state) => state.editing)
  const { scale, width, animating, containerRef, zoomAt, panBy, goToToday } = useViewport()
  useTimelineKeys({ goToToday }, !readOnly)
  const today = useToday()

  const allLanes = useMemo(() => [...data.lanes].sort((a, b) => a.order - b.order), [data.lanes])
  const lanes = useMemo(
    () => (laneIds ? allLanes.filter((lane) => laneIds.has(lane.id)) : allLanes),
    [allLanes, laneIds],
  )
  // Stable per-lane arrays: a lane only sees a new list when its own items change.
  const phasesByLane = useMemo(() => groupByLane(data.phases), [data.phases])
  const milestonesByLane = useMemo(() => groupByLane(data.milestones), [data.milestones])
  const gridTicks = useMemo(() => {
    const ticks = monthTicks(scale, width)
    return scale.pxPerDay >= MONTH_TICK_MIN_PX_PER_DAY
      ? ticks
      : ticks.filter((tick) => tick.month === 0)
  }, [scale, width])
  // 以周为单位规划：放大到一周约 17 像素以上时，每周一画一条比月线更淡的竖线
  const weekLines = useMemo(
    () => (scale.pxPerDay >= WEEK_LINE_MIN_PX_PER_DAY ? weekTicks(scale, width) : []),
    [scale, width],
  )

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
        className={`timeline relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${className}`}
      >
        {allLanes.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="relative min-h-full" onPointerDown={beginPan}>
            <Ruler scale={scale} width={width} terms={data.terms} />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-0 overflow-hidden"
              style={{ left: LABEL_COLUMN_WIDTH }}
            >
              {weekLines.map((tick) => (
                <div
                  key={`w${tick.day}`}
                  data-anim
                  data-testid="week-line"
                  className="absolute inset-y-0 left-0 w-px bg-(--bg-panel) opacity-60"
                  style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                />
              ))}
              {gridTicks.map((tick) => (
                <div
                  key={`${tick.year}-${tick.month}`}
                  data-anim
                  // 月线比周线深一档，放大后仍分得出月份边界
                  className="absolute inset-y-0 left-0 w-px bg-(--sand-5)"
                  style={{ transform: `translateX(${dayToX(scale, tick.day)}px)` }}
                />
              ))}
            </div>
            {lanes.map((lane, index) => (
              <LaneRow
                key={lane.id}
                index={index}
                lane={lane}
                phases={phasesByLane.get(lane.id) ?? NO_PHASES}
                milestones={milestonesByLane.get(lane.id) ?? NO_MILESTONES}
                scale={scale}
                today={today}
                readOnly={readOnly}
              />
            ))}
            {lanes.length === 0 && (
              // 有板块，但都被藏起来了（主页卡片里，后面都还没有安排）
              <div
                data-testid="no-planned-lanes"
                className="relative flex h-14 items-center text-[13px] text-(--text-muted)"
                style={{ paddingLeft: LABEL_COLUMN_WIDTH + 16 }}
              >
                各板块后面都还没有安排，点“展开”去添加阶段
              </div>
            )}
            {!readOnly && (
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
            )}
            <div
              aria-hidden
              // 低于标尺（z-20），今天线从标尺下面出来，不压住月份和学期文字
              className="pointer-events-none absolute inset-y-0 right-0 z-10 overflow-hidden"
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
        {!readOnly && editing?.kind === 'phase' && (
          <PhaseEditor
            phaseId={editing.id}
            anchor={null}
            selectName={editing.selectName}
            onClose={closeEditor}
          />
        )}
        {!readOnly && editing?.kind === 'milestone' && (
          <MilestoneEditor
            milestoneId={editing.id}
            anchor={null}
            selectName={editing.selectName}
            onClose={closeEditor}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
