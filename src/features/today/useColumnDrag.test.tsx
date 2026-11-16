import { fireEvent, render, screen } from '@testing-library/react'
import { createEmptyData, type Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { toDay } from '@/features/timeline/days'
import { InboxColumn } from './InboxColumn'
import { TodayColumn } from './TodayColumn'
import { insertAtPoint, useColumnDrag, zoneAtPoint } from './useColumnDrag'

const s = () => useStore.getState()
const today = toDay('2026-11-12')

// 收件箱在左（x 0–300），今天在右（x 320–700）
const INBOX = { left: 0, top: 0, width: 300, height: 600 }
const TODAY = { left: 320, top: 0, width: 380, height: 600 }

describe('zoneAtPoint', () => {
  const zones = [
    { zone: 'inbox' as const, rect: INBOX },
    { zone: 'today' as const, rect: TODAY },
  ]
  it('finds the column under the pointer', () => {
    expect(zoneAtPoint(zones, 100, 100)).toBe('inbox')
    expect(zoneAtPoint(zones, 400, 100)).toBe('today')
  })
  it('returns null between and outside the columns', () => {
    expect(zoneAtPoint(zones, 310, 100)).toBeNull()
    expect(zoneAtPoint(zones, 100, 700)).toBeNull()
  })
})

function Harness() {
  const data = useStore((state) => state.data)
  const drag = useColumnDrag({ today, isEnabled: () => true })
  return (
    <>
      <InboxColumn
        todos={data.todos}
        lanes={data.lanes}
        today={today}
        dropActive={drag.over === 'inbox'}
        draggingId={drag.dragging?.todo.id ?? null}
        insert={drag.insert}
        onRowPointerDown={(event, todo) => drag.onRowPointerDown(event, todo, 'inbox')}
      />
      <TodayColumn
        todos={data.todos}
        lanes={data.lanes}
        today={today}
        dropActive={drag.over === 'today'}
        draggingId={drag.dragging?.todo.id ?? null}
        insert={drag.insert}
        onRowPointerDown={(event, todo) => drag.onRowPointerDown(event, todo, 'today')}
      />
    </>
  )
}

function setup(todos: Partial<Todo>[]) {
  s().hydrate({
    ...createEmptyData(),
    todos: todos.map((todo, index) => ({
      id: `t${index}`,
      title: `待办${index}`,
      date: null,
      done: false,
      laneId: null,
      createdAt: `2026-11-01T00:00:0${index}.000Z`,
      ...todo,
    })),
  })
  render(<Harness />)
  const rect = (r: typeof INBOX) => ({
    ...r,
    x: r.left,
    y: r.top,
    right: r.left + r.width,
    bottom: r.top + r.height,
    toJSON: () => r,
  })
  vi.spyOn(screen.getByTestId('inbox-column'), 'getBoundingClientRect').mockReturnValue(rect(INBOX))
  vi.spyOn(screen.getByTestId('today-column'), 'getBoundingClientRect').mockReturnValue(rect(TODAY))
}

function drag(id: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.pointerDown(screen.getByTestId(`todo-${id}`), {
    clientX: from.x,
    clientY: from.y,
    button: 0,
    pointerId: 1,
  })
  fireEvent.pointerMove(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
  fireEvent.pointerUp(window, { clientX: to.x, clientY: to.y, pointerId: 1 })
}

const todo = (id: string) => s().data.todos.find((item) => item.id === id)

beforeEach(() => resetEditor())
// 拖完会挂一个 0ms 后自动拿掉的“吞点击”监听；每个测试结束等它拿掉，免得影响下一个测试
afterEach(() => new Promise((resolve) => setTimeout(resolve, 0)))

it('drops an inbox todo onto today', () => {
  setup([{ id: 'a', date: '2026-11-14' }])
  drag('a', { x: 100, y: 50 }, { x: 400, y: 50 })
  expect(todo('a')?.date).toBe('2026-11-12')
})

it('drops a today todo back into the inbox as unscheduled', () => {
  setup([{ id: 'a', date: '2026-11-12' }])
  drag('a', { x: 400, y: 50 }, { x: 100, y: 50 })
  expect(todo('a')?.date).toBeNull()
})

it('drops an overdue todo back into the inbox', () => {
  setup([{ id: 'a', date: '2026-11-09' }])
  drag('a', { x: 400, y: 50 }, { x: 100, y: 50 })
  expect(todo('a')?.date).toBeNull()
})

it('does nothing when dropped on its own column or outside', () => {
  setup([{ id: 'a', date: '2026-11-14' }])
  drag('a', { x: 100, y: 50 }, { x: 150, y: 80 })
  drag('a', { x: 100, y: 50 }, { x: 310, y: 50 })
  expect(todo('a')?.date).toBe('2026-11-14')
  expect(s().past).toHaveLength(0)
})

it('treats a move under the threshold as a press, not a drag', () => {
  setup([{ id: 'a', date: '2026-11-14' }])
  drag('a', { x: 100, y: 50 }, { x: 102, y: 50 })
  expect(todo('a')?.date).toBe('2026-11-14')
  fireEvent.click(screen.getByRole('button', { name: '待办0' }))
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'todo', id: 'a' })
})

it('highlights the column under a dragged todo', () => {
  setup([{ id: 'a', date: '2026-11-14' }])
  fireEvent.pointerDown(screen.getByTestId('todo-a'), {
    clientX: 100,
    clientY: 50,
    button: 0,
    pointerId: 1,
  })
  fireEvent.pointerMove(window, { clientX: 400, clientY: 50, pointerId: 1 })
  expect(
    screen.getByTestId('today-column').querySelector('[data-drop-active="true"]'),
  ).not.toBeNull()
  expect(screen.getByTestId('todo-a')).toHaveAttribute('data-dragging', 'true')
  fireEvent.pointerUp(window, { clientX: 400, clientY: 50, pointerId: 1 })
})

it('ignores presses when dragging is disabled', () => {
  s().hydrate({
    ...createEmptyData(),
    todos: [
      {
        id: 'a',
        title: '预约',
        date: null,
        done: false,
        laneId: null,
        createdAt: '2026-11-01T00:00:00.000Z',
      },
    ],
  })
  function Off() {
    const data = useStore((state) => state.data)
    const d = useColumnDrag({ today, isEnabled: () => false })
    return (
      <InboxColumn
        todos={data.todos}
        lanes={data.lanes}
        today={today}
        onRowPointerDown={(event, item) => d.onRowPointerDown(event, item, 'inbox')}
        draggingId={d.dragging?.todo.id ?? null}
      />
    )
  }
  render(<Off />)
  fireEvent.pointerDown(screen.getByTestId('todo-a'), { clientX: 0, clientY: 0, button: 0 })
  fireEvent.pointerMove(window, { clientX: 400, clientY: 0 })
  expect(screen.getByTestId('todo-a')).toHaveAttribute('data-dragging', 'false')
  fireEvent.pointerUp(window, { clientX: 400, clientY: 0 })
})

it('lets the next press click normally after a drag that produced no click', () => {
  setup([
    { id: 'a', date: '2026-11-14' },
    { id: 'b', date: '2026-11-14' },
  ])
  drag('a', { x: 100, y: 50 }, { x: 400, y: 50 })
  // 没有等清理计时器：松手后浏览器没补点击，下一次按下就是新的手势
  const title = screen.getByRole('button', { name: '待办1' })
  fireEvent.pointerDown(title, { clientX: 100, clientY: 50, button: 0, pointerId: 2 })
  fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 2 })
  fireEvent.click(title)
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'todo', id: 'b' })
})

it('does not drag a done todo', () => {
  setup([{ id: 'a', date: '2026-11-12', done: true }])
  fireEvent.click(screen.getByRole('button', { name: /已完成 1/ }))
  drag('a', { x: 400, y: 50 }, { x: 100, y: 50 })
  expect(todo('a')?.date).toBe('2026-11-12')
})

describe('insertAtPoint', () => {
  const rect = (top: number) => ({ left: 0, top, width: 300, height: 36 })
  const rows = [
    { id: 'a', group: 'g', rect: rect(0) },
    { id: 'b', group: 'g', rect: rect(40) },
    { id: 'c', group: 'g', rect: rect(80) },
    { id: 'x', group: 'other', rect: rect(120) },
  ]
  it('inserts before the first row whose upper half holds the pointer', () => {
    expect(insertAtPoint(rows, 'g', 'c', 5)).toEqual({ id: 'a', position: 'before' })
    expect(insertAtPoint(rows, 'g', 'c', 50)).toEqual({ id: 'b', position: 'before' })
  })
  it('inserts after the last row when the pointer is below all of them', () => {
    expect(insertAtPoint(rows, 'g', 'a', 200)).toEqual({ id: 'c', position: 'after' })
  })
  it('ignores the dragged row and other groups', () => {
    expect(insertAtPoint(rows, 'g', 'c', 200)).toEqual({ id: 'b', position: 'after' })
    expect(insertAtPoint([rows[0]], 'g', 'a', 10)).toBeNull()
  })
})

describe('reordering inside a column', () => {
  function placeRows(ids: string[]) {
    ids.forEach((id, index) => {
      const top = index * 40
      vi.spyOn(screen.getByTestId(`todo-${id}`), 'getBoundingClientRect').mockReturnValue({
        left: 340,
        top,
        width: 340,
        height: 36,
        x: 340,
        y: top,
        right: 680,
        bottom: top + 36,
        toJSON: () => ({}),
      })
    })
  }
  const order = () => s().data.todos.map((item) => item.id)

  it('moves a today todo above another by dragging the row itself', () => {
    setup([
      { id: 'a', date: '2026-11-12' },
      { id: 'b', date: '2026-11-12' },
      { id: 'c', date: '2026-11-12' },
    ])
    placeRows(['a', 'b', 'c'])
    drag('c', { x: 400, y: 100 }, { x: 400, y: 5 })
    expect(order()).toEqual(['c', 'a', 'b'])
    expect(todo('c')?.date).toBe('2026-11-12')
  })

  it('moves a todo to the end of its group when dropped below it', () => {
    setup([
      { id: 'a', date: '2026-11-12' },
      { id: 'b', date: '2026-11-12' },
      { id: 'c', date: '2026-11-12' },
    ])
    placeRows(['a', 'b', 'c'])
    drag('a', { x: 400, y: 10 }, { x: 400, y: 300 })
    expect(order()).toEqual(['b', 'c', 'a'])
  })

  it('shows an insertion line while dragging', () => {
    setup([
      { id: 'a', date: '2026-11-12' },
      { id: 'b', date: '2026-11-12' },
    ])
    placeRows(['a', 'b'])
    fireEvent.pointerDown(screen.getByTestId('todo-b'), {
      clientX: 400,
      clientY: 50,
      button: 0,
      pointerId: 1,
    })
    fireEvent.pointerMove(window, { clientX: 400, clientY: 5, pointerId: 1 })
    expect(screen.getByTestId('todo-a')).toHaveAttribute('data-insert', 'before')
    fireEvent.pointerUp(window, { clientX: 400, clientY: 5, pointerId: 1 })
    expect(screen.getByTestId('todo-a')).not.toHaveAttribute('data-insert')
  })

  it('does not reorder across inbox day groups', () => {
    setup([
      { id: 'a', date: '2026-11-13' },
      { id: 'b', date: '2026-11-14' },
    ])
    vi.spyOn(screen.getByTestId('todo-a'), 'getBoundingClientRect').mockReturnValue({
      left: 20,
      top: 0,
      width: 260,
      height: 36,
      x: 20,
      y: 0,
      right: 280,
      bottom: 36,
      toJSON: () => ({}),
    })
    drag('b', { x: 100, y: 100 }, { x: 100, y: 5 })
    expect(order()).toEqual(['a', 'b'])
    expect(todo('b')?.date).toBe('2026-11-14')
  })

  it('keeps overdue rows out of manual ordering', () => {
    setup([
      { id: 'a', date: '2026-11-09' },
      { id: 'b', date: '2026-11-10' },
    ])
    placeRows(['a', 'b'])
    drag('b', { x: 400, y: 50 }, { x: 400, y: 5 })
    expect(order()).toEqual(['a', 'b'])
  })
})
