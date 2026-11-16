import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type { Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { exceedsThreshold, type GridRect } from '@/features/calendar/drag'
import { fromDay } from '@/features/timeline/days'

export type DropZone = 'today' | 'inbox'

/** 三栏并排（lg 及以上）才能拖；窄屏上下排，靠每行的按钮。 */
export const DRAG_MEDIA_QUERY = '(min-width: 1024px)'

function wideEnough(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DRAG_MEDIA_QUERY).matches
}

/** 指针下面是哪一栏；落在栏外返回 null。 */
export function zoneAtPoint(
  zones: { zone: DropZone; rect: GridRect }[],
  x: number,
  y: number,
): DropZone | null {
  const hit = zones.find(
    ({ rect }) =>
      x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height,
  )
  return hit?.zone ?? null
}

function zonesOnPage(): { zone: DropZone; rect: GridRect }[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-drop-zone]')).map((element) => ({
    zone: element.dataset.dropZone as DropZone,
    rect: element.getBoundingClientRect(),
  }))
}

export interface InsertMark {
  /** 插入线画在这条待办的前面或后面 */
  id: string
  position: 'before' | 'after'
}

/**
 * 在同一组（data-group 相同）的待办里，找指针落在哪两行之间：落在某行上半截就插到它前面，
 * 全都在指针上方就插到最后一行后面。组里除了被拖的就没有别的行时返回 null。
 */
export function insertAtPoint(
  rows: { id: string; group: string; rect: GridRect }[],
  group: string,
  draggedId: string,
  y: number,
): InsertMark | null {
  const peers = rows.filter((row) => row.group === group && row.id !== draggedId)
  if (peers.length === 0) return null
  const next = peers.find((row) => y < row.rect.top + row.rect.height / 2)
  return next
    ? { id: next.id, position: 'before' }
    : { id: peers[peers.length - 1].id, position: 'after' }
}

function rowsOnPage(): { id: string; group: string; rect: GridRect }[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-item-id][data-group]')).map(
    (element) => ({
      id: element.dataset.itemId!,
      group: element.dataset.group!,
      rect: element.getBoundingClientRect(),
    }),
  )
}

export interface ColumnDragging {
  todo: Todo
  from: DropZone
  x: number
  y: number
}

interface Options {
  today: number
  /** 按下时检查一次能不能拖；默认看窗口是不是够宽 */
  isEnabled?: () => boolean
}

/**
 * 今日页的栏间拖拽：收件箱拖进今天 → 日期改成今天；今天拖回收件箱 → 变成未安排。
 * 在本栏里拖到同一组的另一行之间 → 手动排序（直接拖行本身，不需要把手）。
 * 移动不到 4px 就松手算点击，不改任何东西；真的拖过之后，松手时那一下点击会被吞掉，免得顺手打开编辑。
 */
export function useColumnDrag({ today, isEnabled = wideEnough }: Options): {
  dragging: ColumnDragging | null
  over: DropZone | null
  /** 在本栏同一组里拖时，松手会插到哪里 */
  insert: InsertMark | null
  onRowPointerDown: (event: ReactPointerEvent<HTMLElement>, todo: Todo, from: DropZone) => void
} {
  const [dragging, setDragging] = useState<ColumnDragging | null>(null)
  const [over, setOver] = useState<DropZone | null>(null)
  const [insert, setInsert] = useState<InsertMark | null>(null)
  const stopRef = useRef<(() => void) | null>(null)

  useEffect(() => () => stopRef.current?.(), [])

  const onRowPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>, todo: Todo, from: DropZone) => {
      if (event.button !== 0 || !isEnabled()) return
      stopRef.current?.()
      const startX = event.clientX
      const startY = event.clientY
      // 这一行属于哪一组：有分组才能在栏内手动排序（过期的按日期排，不在其中）
      const group = event.currentTarget.dataset.group ?? null
      let moved = false

      const insertFor = (x: number, y: number): InsertMark | null => {
        if (group === null || zoneAtPoint(zonesOnPage(), x, y) !== from) return null
        return insertAtPoint(rowsOnPage(), group, todo.id, y)
      }

      const stop = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', stop)
        window.removeEventListener('keydown', onKey)
        stopRef.current = null
        setDragging(null)
        setOver(null)
        setInsert(null)
      }
      const onMove = (move: PointerEvent) => {
        if (!moved && !exceedsThreshold(move.clientX - startX, move.clientY - startY)) return
        moved = true
        setDragging({ todo, from, x: move.clientX, y: move.clientY })
        const zone = zoneAtPoint(zonesOnPage(), move.clientX, move.clientY)
        setOver(zone !== null && zone !== from ? zone : null)
        setInsert(insertFor(move.clientX, move.clientY))
      }
      const onUp = (up: PointerEvent) => {
        const zone = moved ? zoneAtPoint(zonesOnPage(), up.clientX, up.clientY) : null
        const mark = moved ? insertFor(up.clientX, up.clientY) : null
        stop()
        if (!moved) return
        swallowNextClick()
        if (zone === null) return
        const store = useStore.getState()
        if (!store.data.todos.some((item) => item.id === todo.id)) return
        if (zone === from) {
          if (mark) store.reorderTodo(todo.id, mark.id, mark.position)
          return
        }
        store.updateTodo(todo.id, { date: zone === 'today' ? fromDay(today) : null })
      }
      const onKey = (key: KeyboardEvent) => {
        if (key.key === 'Escape') stop()
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', stop)
      window.addEventListener('keydown', onKey)
      stopRef.current = stop
    },
    [isEnabled, today],
  )

  return { dragging, over, insert, onRowPointerDown }
}

/**
 * 拖完松手后浏览器可能还会补一个 click，这里吞掉它（只吞紧接着的那一个）。
 * 松手的位置换了元素时浏览器不补 click：这时下一次按下就是新的手势，吞点击的监听要在那时拿掉，
 * 不能只靠计时器（后台标签页里计时器会被推迟，下一次正常点击就被吞了）。
 */
function swallowNextClick(): void {
  const release = () => {
    window.removeEventListener('click', swallow, { capture: true })
    window.removeEventListener('pointerdown', release, { capture: true })
  }
  const swallow = (click: MouseEvent) => {
    click.stopPropagation()
    click.preventDefault()
    release()
  }
  window.addEventListener('click', swallow, { capture: true })
  window.addEventListener('pointerdown', release, { capture: true })
  setTimeout(release, 0)
}
