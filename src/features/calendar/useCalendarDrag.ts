import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { fromDay } from '@/features/timeline/days'
import { createRange, dayAtPoint, exceedsThreshold } from './drag'
import { pickLaneId, setLastLaneId } from './lastLane'

/** 拖动时正在预览的东西。 */
export type Preview =
  | { kind: 'create'; start: number; end: number }
  | { kind: 'phase'; id: string; start: number; end: number }
  | { kind: 'milestone'; id: string; day: number }

/** 在某一天新建一个节点并打开编辑面板；没有板块时什么都不做。 */
export function addMilestoneOnDay(day: number): void {
  const store = useStore.getState()
  const laneId = pickLaneId(store.data.lanes)
  if (laneId === null) return
  const id = store.addMilestone({ laneId, date: fromDay(day) })
  setLastLaneId(laneId)
  store.select({ kind: 'milestone', id })
  openEditor('milestone', id, true)
}

function addPhaseOnRange(start: number, end: number): void {
  const store = useStore.getState()
  const laneId = pickLaneId(store.data.lanes)
  if (laneId === null) return
  const id = store.addPhase({ laneId, start: fromDay(start), end: fromDay(end) })
  setLastLaneId(laneId)
  store.select({ kind: 'phase', id })
  openEditor('phase', id, true)
}

interface Options {
  /** 月网格的元素，用来把指针位置换算成日期 */
  gridRef: RefObject<HTMLElement | null>
  weeks: number[][]
}

/** 日历上的拖动：拖选新建（本任务），移动和改长短（Task 10）。 */
export function useCalendarDrag({ gridRef, weeks }: Options): {
  preview: Preview | null
  beginCreate(event: ReactPointerEvent<HTMLElement>, day: number): void
} {
  const [preview, setPreview] = useState<Preview | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  // 页面换掉（比如切到别的路由）时，正在进行的拖动要一起结束
  useEffect(() => () => stopRef.current?.(), [])

  const beginCreate = useCallback(
    (event: ReactPointerEvent<HTMLElement>, anchorDay: number) => {
      if (event.button !== 0) return
      stopRef.current?.()
      const startX = event.clientX
      const startY = event.clientY
      let dragging = false
      let current = anchorDay

      const dayUnder = (x: number, y: number): number | null => {
        const rect = gridRef.current?.getBoundingClientRect()
        return rect ? dayAtPoint(rect, weeks, x, y) : null
      }
      const stop = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
        stopRef.current = null
        setPreview(null)
      }
      const onMove = (move: PointerEvent) => {
        if (!dragging && !exceedsThreshold(move.clientX - startX, move.clientY - startY)) return
        dragging = true
        const under = dayUnder(move.clientX, move.clientY)
        if (under !== null) current = under
        setPreview({ kind: 'create', ...createRange(anchorDay, current) })
      }
      const onUp = (up: PointerEvent) => {
        stop()
        if (!dragging) {
          addMilestoneOnDay(anchorDay)
          return
        }
        const under = dayUnder(up.clientX, up.clientY)
        if (under === null) return
        const { start, end } = createRange(anchorDay, under)
        addPhaseOnRange(start, end)
      }
      const onCancel = () => stop()
      const onKey = (key: KeyboardEvent) => {
        if (key.key === 'Escape') stop()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
      window.addEventListener('keydown', onKey)
      stopRef.current = stop
    },
    [gridRef, weeks],
  )

  return { preview, beginCreate }
}
