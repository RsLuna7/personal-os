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
import { dayAtPoint, exceedsThreshold, type GridRect } from './drag'

/** 拖动时正在预览的东西：被拖的那一项暂时落在 day 这一天。 */
export interface Preview {
  kind: 'todo' | 'milestone'
  id: string
  day: number
}

/** 按下的是哪个条目。 */
export interface MoveTarget {
  kind: 'todo' | 'milestone'
  id: string
}

/** 在某一天新建一条待办（不挂板块）并打开编辑面板，标题已选中。 */
export function addTodoOnDay(day: number): void {
  const store = useStore.getState()
  const id = store.addTodo({ date: fromDay(day) })
  openEditor('todo', id, true)
}

/** 一次按下到松手的整个过程。 */
interface Gesture {
  event: ReactPointerEvent<HTMLElement>
  /** 按下时指针所在的日期；为 null 表示按在网格外面（比如“未安排”列表） */
  anchorDay: number | null
  /** 按在网格外面时是否也能拖进网格；否则只能当单击用 */
  fromOutside?: boolean
  /** 指针移到 hover 这一天时画什么 */
  preview(hover: number): Preview
  /** 移动不到阈值就松手 */
  click(): void
  /** 拖动后在网格内松手 */
  drop(hover: number): void
  /** 拖动中这一项还在不在；不在了就取消 */
  exists(state: ReturnType<typeof useStore.getState>): boolean
}

interface Options {
  /** 月网格的元素，用来把指针位置换算成日期 */
  gridRef: RefObject<HTMLElement | null>
  weeks: number[][]
}

/** 日历上的拖动：待办和节点改期，也可以把未安排的待办拖进某一天。预览只是界面状态，松手才写入一次。 */
export function useCalendarDrag({ gridRef, weeks }: Options): {
  preview: Preview | null
  beginMove(event: ReactPointerEvent<HTMLElement>, target: MoveTarget): void
} {
  const [preview, setPreview] = useState<Preview | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  // 页面换掉（比如切到别的路由）时，正在进行的拖动要一起结束
  useEffect(() => () => stopRef.current?.(), [])

  const dayUnder = useCallback(
    (x: number, y: number): number | null => {
      const rect: GridRect | undefined = gridRef.current?.getBoundingClientRect()
      return rect ? dayAtPoint(rect, weeks, x, y) : null
    },
    [gridRef, weeks],
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

      const unsubscribe = useStore.subscribe((state) => {
        if (!gesture.exists(state)) stop()
      })
      const stop = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        window.removeEventListener('keydown', onKey)
        unsubscribe()
        stopRef.current = null
        setPreview(null)
      }
      const onMove = (move: PointerEvent) => {
        if (anchorDay === null && !gesture.fromOutside) return
        if (!dragging && !exceedsThreshold(move.clientX - startX, move.clientY - startY)) return
        dragging = true
        const under = dayUnder(move.clientX, move.clientY)
        if (under !== null) hover = under
        if (anchorDay === null) {
          // 从网格外拖进来：指针在网格外时条目回到原处，不显示预览
          setPreview(under === null ? null : gesture.preview(under))
          return
        }
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

  const beginMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>, target: MoveTarget) => {
      const store = useStore.getState()
      const rect = gridRef.current?.getBoundingClientRect()
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

      const todo = store.data.todos.find((item) => item.id === target.id)
      if (!todo) return
      const original = todo.date === null ? null : toDay(todo.date)
      // 已有日期的待办按“拖了几天”挪；未安排的待办落在指针下的那一天
      const result = (hover: number) =>
        original === null ? hover : original + hover - (pressDay ?? hover)
      run({
        event,
        anchorDay: pressDay,
        fromOutside: original === null,
        preview: (hover) => ({ kind: 'todo', id: target.id, day: result(hover) }),
        click: () => openEditor('todo', target.id),
        drop: (hover) => {
          const day = result(hover)
          if (day !== original) useStore.getState().updateTodo(target.id, { date: fromDay(day) })
        },
        exists: (state) => state.data.todos.some((item) => item.id === target.id),
      })
    },
    [gridRef, run, weeks],
  )

  return { preview, beginMove }
}
