import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { calendarData as data, makeTodo } from '@/test/calendarFixtures'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/calendar'
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup(initial: AppData = data) {
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const cell = (iso: string) => screen.getByTestId(`day-${iso}`)
const unscheduled = () => screen.getByTestId('unscheduled')
const todo = (id: string) => s().data.todos.find((item) => item.id === id)!
const idsIn = (iso: string) =>
  within(cell(iso))
    .queryAllByTestId(/^todo-/)
    .map((item) => item.getAttribute('data-item-id'))

describe('creating a todo by double-clicking a day', () => {
  it('adds an unfinished, lane-less todo on that day and opens the panel with the title selected', async () => {
    const user = setup()
    const before = s().data.todos.length
    await user.dblClick(cell('2026-11-17'))

    expect(s().data.todos).toHaveLength(before + 1)
    const created = s().data.todos.at(-1)!
    expect(created).toMatchObject({
      title: '新待办',
      date: '2026-11-17',
      done: false,
      laneId: null,
    })
    expect(within(cell('2026-11-17')).getByTestId(`todo-${created.id}`)).toBeInTheDocument()

    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    const title = within(dialog).getByLabelText('标题') as HTMLInputElement
    await waitFor(() => expect(title).toHaveFocus())
    expect([title.selectionStart, title.selectionEnd]).toEqual([0, 3])
  })

  it('lets you type the title straight away', async () => {
    const user = setup()
    await user.dblClick(cell('2026-11-17'))
    await screen.findByRole('dialog', { name: '编辑待办' })
    await user.keyboard('取快递{Enter}')
    expect(s().data.todos.at(-1)!.title).toBe('取快递')
  })

  it('is one undo step', async () => {
    const user = setup()
    const before = s().past.length
    await user.dblClick(cell('2026-11-17'))
    await screen.findByRole('dialog', { name: '编辑待办' })
    expect(s().past.length).toBe(before + 1)
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Control>}z{/Control}')
    expect(s().data.todos).toHaveLength(data.todos.length)
  })

  it('works on a day of the neighbouring month shown in the grid', async () => {
    const user = setup()
    await user.dblClick(cell('2026-12-02'))
    expect(s().data.todos.at(-1)).toMatchObject({ date: '2026-12-02' })
  })

  it('works without any lane', async () => {
    const user = setup(createEmptyData())
    await user.dblClick(cell('2026-11-17'))
    expect(s().data.todos).toHaveLength(1)
    expect(s().data.todos[0]).toMatchObject({ date: '2026-11-17', laneId: null })
  })

  it('adds a todo on that day from the "+" button on the cell, a single click away', async () => {
    const user = setup()
    const before = s().data.todos.length
    await user.click(
      within(cell('2026-11-17')).getByRole('button', { name: '在2026年11月17日添加待办' }),
    )

    expect(s().data.todos).toHaveLength(before + 1)
    expect(s().data.todos.at(-1)).toMatchObject({
      title: '新待办',
      date: '2026-11-17',
      done: false,
      laneId: null,
    })
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })

  it('does nothing on a single click, on a blank cell or on the date number', async () => {
    const user = setup()
    await user.click(cell('2026-11-17'))
    await user.click(within(cell('2026-11-17')).getByText('17'))
    expect(s().data.todos).toHaveLength(data.todos.length)
    expect(s().data.milestones).toHaveLength(1)
    expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument()
  })

  it('does not create when an existing todo or milestone is double-clicked', async () => {
    const user = setup()
    await user.dblClick(screen.getByTestId('todo-t1'))
    await user.dblClick(screen.getByTestId('milestone-m1'))
    expect(s().data.todos).toHaveLength(data.todos.length)
  })

  it('does not create when the check box is double-clicked (it only toggles twice)', async () => {
    const user = setup()
    await user.dblClick(screen.getByRole('checkbox', { name: '完成「写周报」' }))
    expect(s().data.todos).toHaveLength(data.todos.length)
    expect(todo('t1').done).toBe(false)
  })

  it('creates from the blank part of a crowded day', () => {
    setup({
      ...data,
      todos: ['a', 'b', 'c', 'd'].map((id) => makeTodo(id, { date: '2026-11-09' })),
    })
    fireEvent.doubleClick(cell('2026-11-09'))
    expect(s().data.todos).toHaveLength(5)
  })

  it('creates with Enter on a focused day', async () => {
    const user = setup()
    act(() => cell('2026-11-17').focus())
    await user.keyboard('{Enter}')
    expect(s().data.todos.at(-1)).toMatchObject({ date: '2026-11-17', title: '新待办' })
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })
})

describe('ticking a todo off', () => {
  it('toggles it with the check box, in one undo step, without opening the panel', async () => {
    const user = setup()
    const before = s().past.length
    await user.click(screen.getByRole('checkbox', { name: '完成「写周报」' }))
    expect(todo('t1').done).toBe(true)
    expect(s().past.length).toBe(before + 1)
    expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument()

    await user.keyboard('{Control>}z{/Control}')
    expect(todo('t1').done).toBe(false)
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(todo('t1').done).toBe(true)
  })

  it('marks the item as done, keeps it in the cell and moves it behind the unfinished ones', async () => {
    const user = setup()
    expect(idsIn('2026-11-12')).toEqual(['t1', 't2'])
    await user.click(screen.getByRole('checkbox', { name: '完成「写周报」' }))
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-done', 'true')
    expect(screen.getByRole('checkbox', { name: '完成「写周报」' })).toBeChecked()
    expect(idsIn('2026-11-12')).toEqual(['t2', 't1'])
  })

  it('unticks a finished todo', async () => {
    const user = setup()
    await user.click(screen.getByRole('checkbox', { name: '完成「交作业」' }))
    expect(todo('t3').done).toBe(false)
  })

  it('exposes the check box as a real, labelled control that is not a drag handle', () => {
    setup()
    const box = screen.getByRole('checkbox', { name: '完成「写周报」' })
    expect(box.tagName).toBe('BUTTON')
    expect(box).toHaveAttribute('aria-checked', 'false')
    expect(box.closest('[data-item]')).toBeNull()
  })

  it('toggles from the keyboard with Space on the item, once', async () => {
    const user = setup()
    act(() => screen.getByTestId('todo-t1').focus())
    await user.keyboard(' ')
    expect(todo('t1').done).toBe(true)
  })

  it('toggles exactly once when the check box itself has the focus and Space is pressed', async () => {
    const user = setup()
    act(() => screen.getByRole('checkbox', { name: '完成「写周报」' }).focus())
    await user.keyboard(' ')
    expect(todo('t1').done).toBe(true)
  })

  it('toggles todos in the unscheduled list too', async () => {
    const user = setup()
    await user.click(within(unscheduled()).getByRole('checkbox', { name: '完成「读论文」' }))
    expect(todo('t4').done).toBe(true)
    expect(within(unscheduled()).getByTestId('todo-t4')).toHaveAttribute('data-done', 'true')
  })
})

describe('the unscheduled list', () => {
  it('shows only todos without a date, unfinished first', () => {
    setup({
      ...data,
      todos: [
        ...data.todos,
        makeTodo('t5', { title: '已做', done: true }),
        makeTodo('t6', { title: '没做', createdAt: '2026-11-02T08:00:00.000Z' }),
      ],
    })
    const items = within(unscheduled()).getAllByTestId(/^todo-/)
    expect(items.map((item) => item.getAttribute('data-item-id'))).toEqual(['t4', 't6', 't5'])
    expect(within(unscheduled()).getByRole('heading', { name: /未安排/ })).toHaveTextContent('3')
  })

  it('says so when there is nothing left', () => {
    setup({ ...data, todos: data.todos.filter((item) => item.date !== null) })
    expect(within(unscheduled()).queryAllByTestId(/^todo-/)).toHaveLength(0)
    expect(within(unscheduled()).getByText(/没有未安排的待办/)).toBeInTheDocument()
  })

  it('adds an undated, lane-less todo from the input with Enter, and clears the input', async () => {
    const user = setup()
    const input = within(unscheduled()).getByRole('textbox', { name: '新建未安排的待办' })
    await user.type(input, '  订机票  {Enter}')
    expect(s().data.todos.at(-1)).toMatchObject({
      title: '订机票',
      date: null,
      laneId: null,
      done: false,
    })
    expect(input).toHaveValue('')
    expect(within(unscheduled()).getByText('订机票')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument()
  })

  it('ignores an empty input', async () => {
    const user = setup()
    const input = within(unscheduled()).getByRole('textbox', { name: '新建未安排的待办' })
    await user.type(input, '   {Enter}')
    expect(s().data.todos).toHaveLength(data.todos.length)
  })

  it('does not treat typing in the input as calendar shortcuts', async () => {
    const user = setup()
    const input = within(unscheduled()).getByRole('textbox', { name: '新建未安排的待办' })
    await user.type(input, 'tt ')
    expect(input).toHaveValue('tt ')
    expect(window.location.hash).toBe('#/calendar')
  })

  it('opens the panel for an item when it is clicked', async () => {
    const user = setup()
    await user.click(within(unscheduled()).getByTestId('todo-t4'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    expect(within(dialog).getByLabelText('标题')).toHaveValue('读论文')
  })

  it('gives its items the same labels as the ones on the grid', () => {
    setup()
    expect(within(unscheduled()).getByTestId('todo-t4')).toHaveAttribute(
      'aria-label',
      '待办：读论文，未安排，未完成',
    )
  })

  it('gets the todo back when its date is cleared and shows it on the day when one is set', () => {
    setup()
    act(() => s().updateTodo('t1', { date: null }))
    expect(within(unscheduled()).getByTestId('todo-t1')).toBeInTheDocument()
    act(() => s().updateTodo('t4', { date: '2026-11-19' }))
    expect(within(cell('2026-11-19')).getByTestId('todo-t4')).toBeInTheDocument()
    expect(within(unscheduled()).queryByTestId('todo-t4')).not.toBeInTheDocument()
  })
})

describe('lanes and todos', () => {
  it('turns the todos of a deleted lane grey instead of deleting them', () => {
    setup()
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-lane-color', 'iris')
    act(() => s().removeLane('l1'))
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-lane-color', 'neutral')
    expect(todo('t1').laneId).toBeNull()
    expect(within(unscheduled()).getByTestId('todo-t4')).toHaveAttribute(
      'data-lane-color',
      'neutral',
    )
  })

  it('colours the todo again when the deletion is undone', () => {
    setup()
    act(() => s().removeLane('l1'))
    act(() => s().undo())
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-lane-color', 'iris')
  })
})
