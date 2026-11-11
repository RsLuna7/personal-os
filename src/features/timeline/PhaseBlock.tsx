import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { fromDay, toDay } from './days'
import { formatDuration, formatRange, formatRangeWithYear } from './format'
import { ROW_HEIGHT } from './layout'
import { dayToX, type Scale } from './scale'
import { movePhase, resizePhase, WEEK } from './snap'
import { MIN_LABEL_WIDTH } from './useViewport'

export const DRAG_THRESHOLD_PX = 4
const HANDLE_WIDTH = 8
const SETTLE_MS = 150

type DragMode = 'move' | 'start' | 'end'

interface DragState {
  mode: DragMode
  dx: number
  /** 提示条的位置（视口坐标） */
  hintX: number
  hintY: number
}

interface PhaseBlockProps {
  phase: Phase
  scale: Scale
  top: number
  today: number
  /** Just deleted: drawn for the fade-out only, inert and hidden from assistive tech. */
  exiting?: boolean
}

function dragResult(
  mode: DragMode,
  startDay: number,
  endDay: number,
  dx: number,
  pxPerDay: number,
) {
  const delta = Math.round(dx / pxPerDay)
  if (mode === 'move') return movePhase(startDay, endDay, delta)
  return mode === 'start'
    ? resizePhase(startDay, endDay, 'start', startDay + delta)
    : resizePhase(startDay, endDay, 'end', endDay + delta)
}

export function PhaseBlock({ phase, scale, top, today, exiting = false }: PhaseBlockProps) {
  const selected = useStore(
    (state) => state.selection?.kind === 'phase' && state.selection.id === phase.id,
  )
  const blockRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [settling, setSettling] = useState(false)

  const startDay = toDay(phase.start)
  const endDay = toDay(phase.end)
  const baseX = dayToX(scale, startDay)
  const baseWidth = (endDay - startDay) * scale.pxPerDay
  const minWidth = WEEK * scale.pxPerDay

  // 拖动中色块跟着指针走（不吸附）；提示条显示松手后会落到的整周日期
  let x = baseX
  let width = baseWidth
  if (drag?.mode === 'move') {
    x = baseX + drag.dx
  } else if (drag?.mode === 'start') {
    const shift = Math.min(drag.dx, baseWidth - minWidth)
    x = baseX + shift
    width = baseWidth - shift
  } else if (drag?.mode === 'end') {
    width = Math.max(minWidth, baseWidth + drag.dx)
  }
  const preview = drag
    ? dragResult(drag.mode, startDay, endDay, drag.dx, scale.pxPerDay)
    : { start: startDay, end: endDay }

  const range = formatRangeWithYear(startDay, endDay)
  const duration = `共 ${formatDuration(endDay - startDay)}`
  /** 色块左端滚出画面时，把名称推回可见区域 */
  const labelInset = Math.max(0, Math.min(-x, width - MIN_LABEL_WIDTH * 3))

  const beginDrag = (event: ReactPointerEvent<HTMLElement>, mode: DragMode) => {
    if (exiting || event.button !== 0) return
    event.stopPropagation()
    const block = blockRef.current
    if (!block) return
    const target = event.currentTarget
    if (typeof target.setPointerCapture === 'function') {
      try {
        target.setPointerCapture(event.pointerId)
      } catch {
        // 指针已经释放时会抛错，不影响拖动
      }
    }

    const startX = event.clientX
    const hintY = block.getBoundingClientRect().top
    const { pxPerDay } = scale
    let moved = false

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
      setDrag(null)
    }
    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
      moved = true
      setDrag({ mode, dx, hintX: moveEvent.clientX, hintY })
    }
    const onUp = (upEvent: PointerEvent) => {
      cleanup()
      const store = useStore.getState()
      if (!moved) {
        store.select({ kind: 'phase', id: phase.id })
        openEditor('phase', phase.id)
        return
      }
      const result = dragResult(mode, startDay, endDay, upEvent.clientX - startX, pxPerDay)
      setSettling(true)
      setTimeout(() => setSettling(false), SETTLE_MS)
      store.updatePhase(phase.id, { start: fromDay(result.start), end: fromDay(result.end) })
    }
    const onCancel = () => cleanup()
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === 'Escape') cleanup()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
  }

  return (
    <>
      <Tooltip open={drag || exiting ? false : undefined}>
        <TooltipTrigger asChild>
          <div
            ref={blockRef}
            data-testid={exiting ? undefined : `phase-${phase.id}`}
            data-anim
            data-exiting={String(exiting)}
            aria-hidden={exiting || undefined}
            role={exiting ? undefined : 'button'}
            tabIndex={exiting ? -1 : 0}
            aria-label={`${phase.name}，${range}，${duration}${phase.tentative ? '，待确认' : ''}`}
            data-past={String(endDay <= today)}
            data-tentative={String(phase.tentative)}
            data-selected={String(selected)}
            data-dragging={String(drag !== null)}
            data-settling={String(settling)}
            className="phase-block absolute left-0 flex cursor-grab touch-none items-center rounded-[6px] border px-2 text-[14px] select-none"
            style={{
              transform: `translateX(${x}px)`,
              width: `${width}px`,
              top: `${top}px`,
              height: ROW_HEIGHT,
            }}
            onFocus={() => {
              if (!exiting) useStore.getState().select({ kind: 'phase', id: phase.id })
            }}
            onPointerDown={(event) => beginDrag(event, 'move')}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            {width >= MIN_LABEL_WIDTH && (
              <span className="truncate" title={phase.name} style={{ marginLeft: labelInset }}>
                {phase.name}
              </span>
            )}
            <span
              data-testid={`phase-${phase.id}-handle-start`}
              className="absolute inset-y-0 left-0 cursor-ew-resize"
              style={{ width: HANDLE_WIDTH }}
              onPointerDown={(event) => beginDrag(event, 'start')}
            />
            <span
              data-testid={`phase-${phase.id}-handle-end`}
              className="absolute inset-y-0 right-0 cursor-ew-resize"
              style={{ width: HANDLE_WIDTH }}
              onPointerDown={(event) => beginDrag(event, 'end')}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="font-medium">{phase.name}</div>
          <div>{range}</div>
          <div>
            {duration}
            {phase.tentative ? ' · 待确认' : ''}
          </div>
        </TooltipContent>
      </Tooltip>
      {drag &&
        createPortal(
          <div
            data-testid="drag-hint"
            className="pointer-events-none fixed z-50 -translate-x-1/2 rounded-[6px] bg-(--text) px-2 py-1 text-[12px] whitespace-nowrap text-(--bg-page)"
            style={{ left: drag.hintX, top: drag.hintY - 32 }}
          >
            {formatRange(preview.start, preview.end)} ·{' '}
            {formatDuration(preview.end - preview.start)}
          </div>,
          document.body,
        )}
    </>
  )
}
