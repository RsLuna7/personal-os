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
import { fromDay, toDay } from '@/features/timeline/days'
import {
  createRange,
  dayAtPoint,
  exceedsThreshold,
  resizeRange,
  shiftRange,
  type GridRect,
} from './drag'
import { pickLaneId, setLastLaneId } from './lastLane'

/** 拖动时正在预览的东西。 */
export type Preview =
  | { kind: 'create'; start: number; end: number }
  | { kind: 'phase'; id: string; start: number; end: number }
  | { kind: 'milestone'; id: string; day: number }

/** 按下的是哪个项目的哪个部分。 */
export type MoveTarget =
  { kind: 'phase'; id: string; mode: 'move' | 'start' | 'end' } | { kind: 'milestone'; id: string }

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

/** 一次按下到松手的整个过程。 */
interface Gesture {
  event: ReactPointerEvent<HTMLElement>
  /** 按下时指针所在的日期；为 null 时只能当单击用 */
  anchorDay: number | null
  /** 指针移到 hover 这一天时画什么 */
  preview(hover: number): Preview
  /** 移动不到阈值就松手 */
  click(): void
  /** 拖动后在网格内松手 */
  drop(hover: number): void
  /** 拖动中这一项还在不在；不在了就取消 */
  exists?(state: ReturnType<typeof useStore.getState>): boolean
}

interface Options {
  /** 月网格的元素，用来把指针位置换算成日期 */
  gridRef: RefObject<HTMLElement | null>
  weeks: number[][]
}

/** 日历上的拖动：拖选新建，移动和改长短。预览只是界面状态，松手才写入一次。 */
export function useCalendarDrag({ gridRef, weeks }: Options): {
  preview: Preview | null
  beginCreate(event: ReactPointerEvent<HTMLElement>, day: number): void
  beginMove(event: ReactPointerEvent<HTMLElement>, target: MoveTarget): void
} {
  const [preview, setPreview] = useState<Preview | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  // 页面换掉（比如切到别的路由）时，正在进行的拖动要一起结束
  useEffect(() => () => stopRef.current?.(), [])

  const gridRect = useCallback((): GridRect | null => {
    return gridRef.current?.getBoundingClientRect() ?? null
  }, [gridRef])

  const dayUnder = useCallback(
    (x: number, y: number): number | null => {
      const rect = gridRect()
      return rect ? dayAtPoint(rect, weeks, x, y) : null
    },
    [gridRect, weeks],
  )

  const run = useCallback(
    (gesture: Gesture) => {
      const { event, anchorDay } = gesture
      if (event.button !== 0) return
      stopRef.current?.()
      const startX = event.clientX
      const startY = event.clientY
      let dragging = false
      let hover = anchorDay

      const unsubscribe = gesture.exists
        ? useStore.subscribe((state) => {
            if (!gesture.exists!(state)) stop()
          })
        : null
      const stop = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
        unsubscribe?.()
        stopRef.current = null
        setPreview(null)
      }
      const onMove = (move: PointerEvent) => {
        if (anchorDay === null) return
        if (!dragging && !exceedsThreshold(move.clientX - startX, move.clientY - startY)) return
        dragging = true
        const under = dayUnder(move.clientX, move.clientY)
        if (under !== null) hover = under
        setPreview(gesture.preview(hover ?? anchorDay))
      }
      const onUp = (up: PointerEvent) => {
        stop()
        if (!dragging) {
          gesture.click()
          return
        }
        const under = dayUnder(up.clientX, up.clientY)
        if (under !== null) gesture.drop(under)
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
    [dayUnder],
  )

  const beginCreate = useCallback(
    (event: ReactPointerEvent<HTMLElement>, anchorDay: number) => {
      // 编辑面板或“+N 项”列表开着时，这一下按压只用来把它们关掉（它们自己会在
      // 点到外面时关闭），不能同时当成“新建”；React 的处理先于它们的关闭。
      if (document.querySelector('[role="dialog"]')) return
      run({
        event,
        anchorDay,
        preview: (hover) => ({ kind: 'create', ...createRange(anchorDay, hover) }),
        click: () => addMilestoneOnDay(anchorDay),
        drop: (hover) => {
          const { start, end } = createRange(anchorDay, hover)
          addPhaseOnRange(start, end)
        },
      })
    },
    [run],
  )

  const beginMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>, target: MoveTarget) => {
      const store = useStore.getState()
      const rect = gridRect()
      const pressDay = rect ? dayAtPoint(rect, weeks, event.clientX, event.clientY) : null

      if (target.kind === 'milestone') {
        const milestone = store.data.milestones.find((item) => item.id === target.id)
        if (!milestone) return
        const original = toDay(milestone.date)
        const result = (hover: number) => original + hover - (pressDay ?? hover)
        run({
          event,
          anchorDay: pressDay,
          preview: (hover) => ({ kind: 'milestone', id: target.id, day: result(hover) }),
          click: () => {
            useStore.getState().select({ kind: 'milestone', id: target.id })
            openEditor('milestone', target.id)
          },
          drop: (hover) => {
            const day = result(hover)
            if (day !== original) {
              useStore.getState().updateMilestone(target.id, { date: fromDay(day) })
            }
          },
          exists: (state) => state.data.milestones.some((item) => item.id === target.id),
        })
        return
      }

      const phase = store.data.phases.find((item) => item.id === target.id)
      if (!phase) return
      const start = toDay(phase.start)
      const end = toDay(phase.end)
      const result = (hover: number) =>
        target.mode === 'move'
          ? shiftRange(start, end, hover - (pressDay ?? hover))
          : resizeRange(start, end, target.mode, hover)
      run({
        event,
        anchorDay: pressDay,
        preview: (hover) => ({ kind: 'phase', id: target.id, ...result(hover) }),
        click: () => {
          useStore.getState().select({ kind: 'phase', id: target.id })
          openEditor('phase', target.id)
        },
        drop: (hover) => {
          const next = result(hover)
          if (next.start === start && next.end === end) return
          useStore
            .getState()
            .updatePhase(target.id, { start: fromDay(next.start), end: fromDay(next.end) })
        },
        exists: (state) => state.data.phases.some((item) => item.id === target.id),
      })
    },
    [gridRect, run, weeks],
  )

  return { preview, beginCreate, beginMove }
}
