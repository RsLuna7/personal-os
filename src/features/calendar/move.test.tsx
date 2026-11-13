import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { toDay } from '@/features/timeline/days'
import { resetViewport } from '@/features/timeline/useViewport'
import { calendarData as data } from '@/test/calendarFixtures'
import { monthWeeks } from './month'

const s = () => useStore.getState()

const WEEKS = monthWeeks({ year: 2026, month: 11 }).flat()

/** 网格被桩成 700 × 600：六周，每格约 100 × 100（格子之间的间隙很小，取格子中心不受影响）。 */
function center(iso: string, dx = 0): { clientX: number; clientY: number } {
  const index = WEEKS.indexOf(toDay(iso))
  return { clientX: (index % 7) * 100 + 50 + dx, clientY: Math.floor(index / 7) * 100 + 50 }
}

/** 网格外面（“未安排”列表所在的位置）。 */
const LIST_POINT = { clientX: 800, clientY: 50 }

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/calendar'
  resetViewport()
  resetEditor()
  s().hydrate(data)
  render(<App />)
  vi.spyOn(screen.getByTestId('month-grid'), 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 700,
    height: 600,
    right: 700,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
})
afterEach(() => vi.useRealTimers())

const todo = (id: string) => s().data.todos.find((item) => item.id === id)!
const press = (element: Element, iso: string) =>
  fireEvent.pointerDown(element, { ...center(iso), button: 0, pointerId: 1 })
const move = (iso: string, dx = 0) =>
  fireEvent.pointerMove(window, { ...center(iso, dx), pointerId: 1 })
const release = (iso: string, dx = 0) =>
  fireEvent.pointerUp(window, { ...center(iso, dx), pointerId: 1 })
const cell = (iso: string) => screen.getByTestId(`day-${iso}`)
const unscheduled = () => screen.getByTestId('unscheduled')

describe('moving a todo to another day', () => {
  it('moves by the dragged days and is one undo step', async () => {
    const before = s().past.length
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-13')
    move('2026-11-16')
    release('2026-11-16')
    expect(todo('t1').date).toBe('2026-11-16')
    expect(s().past.length).toBe(before + 1)
    expect(within(cell('2026-11-16')).getByTestId('todo-t1')).toBeInTheDocument()
    await userEvent.setup().keyboard('{Control>}z{/Control}')
    expect(todo('t1').date).toBe('2026-11-12')
  })

  it('moves to the cell it is dropped on, keeping everything else', () => {
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-19')
    release('2026-11-19')
    expect(todo('t1')).toMatchObject({
      title: '写周报',
      date: '2026-11-19',
      laneId: 'l1',
      done: false,
    })
  })

  it('can be dropped on a day of the neighbouring month shown in the grid', () => {
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-30')
    release('2026-11-30')
    expect(todo('t1').date).toBe('2026-11-30')
  })

  it('shows the new place while dragging, without writing, then clears the preview', () => {
    const before = s().data
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-17')
    expect(s().data).toBe(before)
    expect(within(cell('2026-11-17')).getByTestId('todo-t1')).toHaveAttribute(
      'data-dragging',
      'true',
    )
    expect(within(cell('2026-11-17')).getByTestId('todo-t1')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('11月17日'),
    )
    release('2026-11-17')
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-dragging', 'false')
  })

  it('does not write when it is dropped where it started', () => {
    const before = s().past.length
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    fireEvent.pointerMove(window, { ...center('2026-11-12', 20), pointerId: 1 })
    release('2026-11-12', 20)
    expect(s().past.length).toBe(before)
    expect(todo('t1').date).toBe('2026-11-12')
  })

  it('moves a finished todo too', () => {
    press(screen.getByTestId('todo-t3'), '2026-11-13')
    move('2026-11-14')
    release('2026-11-14')
    expect(todo('t3')).toMatchObject({ date: '2026-11-14', done: true })
  })
})

describe('moving a milestone', () => {
  it('moves to the dropped day in one undo step', () => {
    const before = s().past.length
    press(screen.getByTestId('milestone-m1'), '2026-11-20')
    move('2026-11-24')
    release('2026-11-24')
    expect(s().data.milestones[0]!.date).toBe('2026-11-24')
    expect(s().past.length).toBe(before + 1)
  })
})

describe('clicks and cancelling', () => {
  it('treats under 4px as a click: opens the editor, data unchanged', async () => {
    const before = s().data
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    fireEvent.pointerMove(window, { ...center('2026-11-12', 3), pointerId: 1 })
    release('2026-11-12', 3)
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
    expect(s().data).toBe(before)
  })

  it('selects and opens a milestone on click', async () => {
    press(screen.getByTestId('milestone-m1'), '2026-11-20')
    release('2026-11-20')
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'milestone', id: 'm1' })
  })

  it('cancels with Escape', () => {
    const before = s().past.length
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-17')
    fireEvent.keyDown(window, { key: 'Escape' })
    release('2026-11-17')
    expect(todo('t1').date).toBe('2026-11-12')
    expect(s().past.length).toBe(before)
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-dragging', 'false')
  })

  it('cancels when released outside the grid', () => {
    const before = s().past.length
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-17')
    fireEvent.pointerUp(window, { clientX: 760, clientY: 250, pointerId: 1 })
    expect(todo('t1').date).toBe('2026-11-12')
    expect(s().past.length).toBe(before)
  })

  it('cancels quietly when the todo disappears in the middle of a drag', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-17')
    act(() => s().removeTodo('t1'))
    release('2026-11-17')
    expect(s().data.todos.map((item) => item.id)).toEqual(['t2', 't3', 't4'])
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('leaves no listeners behind: another item still opens its editor on click', async () => {
    press(screen.getByTestId('todo-t1'), '2026-11-12')
    move('2026-11-17')
    release('2026-11-17')
    await userEvent.setup().click(screen.getByTestId('todo-t2'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    expect(within(dialog).getByLabelText('标题')).toHaveValue('买菜')
  })

  it('ignores other mouse buttons', () => {
    fireEvent.pointerDown(screen.getByTestId('todo-t1'), {
      ...center('2026-11-12'),
      button: 2,
      pointerId: 1,
    })
    move('2026-11-17')
    release('2026-11-17')
    expect(todo('t1').date).toBe('2026-11-12')
  })

  it('does not start a drag from the check box', () => {
    const before = s().past.length
    fireEvent.pointerDown(screen.getByRole('checkbox', { name: '完成「写周报」' }), {
      ...center('2026-11-12'),
      button: 0,
      pointerId: 1,
    })
    move('2026-11-17')
    release('2026-11-17')
    expect(todo('t1').date).toBe('2026-11-12')
    expect(s().past.length).toBe(before)
  })
})

describe('dragging an unscheduled todo into the grid', () => {
  const item = () => within(unscheduled()).getByTestId('todo-t4')
  const pressList = () => fireEvent.pointerDown(item(), { ...LIST_POINT, button: 0, pointerId: 1 })

  it('shows the dragged todo on a day that already has three, instead of hiding it behind “+N”', () => {
    for (const title of ['一', '二', '三'])
      act(() => void s().addTodo({ title, date: '2026-11-18' }))
    pressList()
    move('2026-11-18')
    expect(within(cell('2026-11-18')).getByTestId('todo-t4')).toHaveAttribute(
      'data-dragging',
      'true',
    )
    expect(within(cell('2026-11-18')).getAllByTestId(/^todo-/)).toHaveLength(3)
    fireEvent.pointerUp(window, { ...LIST_POINT, pointerId: 1 })
  })

  it('puts it on the day under the pointer in one undo step', async () => {
    const before = s().past.length
    pressList()
    move('2026-11-18')
    release('2026-11-18')
    expect(todo('t4').date).toBe('2026-11-18')
    expect(within(cell('2026-11-18')).getByTestId('todo-t4')).toBeInTheDocument()
    expect(within(unscheduled()).queryByTestId('todo-t4')).not.toBeInTheDocument()
    expect(s().past.length).toBe(before + 1)
    await userEvent.setup().keyboard('{Control>}z{/Control}')
    expect(todo('t4').date).toBeNull()
  })

  it('previews it in the hovered cell and sends it back to the list when the pointer leaves', () => {
    const before = s().data
    pressList()
    move('2026-11-18')
    expect(within(cell('2026-11-18')).getByTestId('todo-t4')).toHaveAttribute(
      'data-dragging',
      'true',
    )
    expect(s().data).toBe(before)

    fireEvent.pointerMove(window, { ...LIST_POINT, pointerId: 1 })
    expect(within(unscheduled()).getByTestId('todo-t4')).toBeInTheDocument()
  })

  it('does nothing when released outside the grid', () => {
    const before = s().past.length
    pressList()
    move('2026-11-18')
    fireEvent.pointerUp(window, { ...LIST_POINT, pointerId: 1 })
    expect(todo('t4').date).toBeNull()
    expect(s().past.length).toBe(before)
  })

  it('cancels with Escape', () => {
    pressList()
    move('2026-11-18')
    fireEvent.keyDown(window, { key: 'Escape' })
    release('2026-11-18')
    expect(todo('t4').date).toBeNull()
    expect(within(unscheduled()).getByTestId('todo-t4')).toBeInTheDocument()
  })

  it('opens the editor on a plain click, as before', async () => {
    pressList()
    fireEvent.pointerUp(window, { ...LIST_POINT, pointerId: 1 })
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
    expect(todo('t4').date).toBeNull()
  })
})
