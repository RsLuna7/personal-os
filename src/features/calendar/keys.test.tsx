import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { calendarData as data, makeTodo } from '@/test/calendarFixtures'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup(hash = '#/calendar', initial: AppData = data) {
  window.location.hash = hash
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const cell = (iso: string) => screen.getByTestId(`day-${iso}`)
const focus = (element: HTMLElement) => act(() => element.focus())
const todo = (id: string) => s().data.todos.find((item) => item.id === id)!
const milestone = () => s().data.milestones[0]!

describe('day cells', () => {
  it('has a single tab stop on today, and arrows move it', async () => {
    const user = setup()
    expect(document.querySelectorAll('[data-day][tabindex="0"]')).toHaveLength(1)
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '0')

    focus(cell('2026-11-10'))
    await user.keyboard('{ArrowRight}')
    expect(cell('2026-11-11')).toHaveFocus()
    expect(cell('2026-11-11')).toHaveAttribute('tabindex', '0')
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{ArrowDown}')
    expect(cell('2026-11-18')).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(cell('2026-11-10')).toHaveFocus()
  })

  it('starts on the first of the month when today is not in it', () => {
    setup('#/calendar/2027-02')
    expect(cell('2027-02-01')).toHaveAttribute('tabindex', '0')
  })

  it('goes to the next month when the arrow leaves this one', async () => {
    const user = setup()
    focus(cell('2026-11-30'))
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-12'))
    await waitFor(() => expect(cell('2026-12-01')).toHaveFocus())
  })

  it('keeps the day when paging months and clamps to the last day', async () => {
    const user = setup('#/calendar/2027-01')
    focus(cell('2027-01-31'))
    await user.keyboard('{PageDown}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2027-02'))
    await waitFor(() => expect(cell('2027-02-28')).toHaveFocus())
    await user.keyboard('{PageUp}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2027-01'))
    await waitFor(() => expect(cell('2027-01-28')).toHaveFocus())
  })

  it('does not move past January 1900 and does not fail', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = setup('#/calendar/1900-01')
    focus(cell('1900-01-01'))
    await user.keyboard('{ArrowLeft}{ArrowUp}{PageUp}')
    expect(window.location.hash).toBe('#/calendar/1900-01')
    expect(cell('1900-01-01')).toHaveFocus()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('jumps back to today with T', async () => {
    const user = setup('#/calendar/2027-02')
    focus(cell('2027-02-01'))
    await user.keyboard('t')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-11'))
    await waitFor(() => expect(cell('2026-11-10')).toHaveFocus())
  })

  it('creates a todo with Enter and opens the panel', async () => {
    const user = setup()
    focus(cell('2026-11-17'))
    await user.keyboard('{Enter}')
    expect(s().data.todos).toHaveLength(5)
    expect(s().data.todos.at(-1)).toMatchObject({ date: '2026-11-17', laneId: null })
    expect(s().data.milestones).toHaveLength(1)
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })
})

describe('todos', () => {
  it('moves a day with the left and right arrows, one undo step each, keeping the focus', async () => {
    const user = setup()
    const before = s().past.length
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{ArrowRight}')
    expect(todo('t1').date).toBe('2026-11-13')
    expect(s().past.length).toBe(before + 1)
    await waitFor(() => expect(screen.getByTestId('todo-t1')).toHaveFocus())
    expect(within(cell('2026-11-13')).getByTestId('todo-t1')).toBeInTheDocument()

    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(todo('t1').date).toBe('2026-11-11')
    expect(s().past.length).toBe(before + 3)
    await waitFor(() => expect(screen.getByTestId('todo-t1')).toHaveFocus())
  })

  it('moves a week with the up and down arrows', async () => {
    const user = setup()
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{ArrowDown}')
    expect(todo('t1').date).toBe('2026-11-19')
    await waitFor(() => expect(screen.getByTestId('todo-t1')).toHaveFocus())
    await user.keyboard('{ArrowUp}{ArrowUp}')
    expect(todo('t1').date).toBe('2026-11-05')
  })

  it('follows the todo into the next month and keeps the focus on it', async () => {
    const user = setup('#/calendar', {
      ...data,
      todos: [makeTodo('e', { title: '月底', date: '2026-12-06' })],
    })
    // 12 月 6 日是 11 月网格的最后一格（周日）
    focus(screen.getByTestId('todo-e'))
    await user.keyboard('{ArrowRight}')
    expect(todo('e').date).toBe('2026-12-07')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-12'))
    await waitFor(() => expect(screen.getByTestId('todo-e')).toHaveFocus())
  })

  it('keeps the focus on the todo when it lands on a crowded day', async () => {
    const user = setup('#/calendar', {
      ...data,
      todos: [
        makeTodo('a', { date: '2026-11-13', laneId: 'l1' }),
        makeTodo('b', { date: '2026-11-13', laneId: 'l1' }),
        makeTodo('c', { date: '2026-11-13', laneId: 'l1' }),
        makeTodo('z', { title: '没板块', date: '2026-11-12' }),
      ],
    })
    focus(screen.getByTestId('todo-z'))
    await user.keyboard('{ArrowRight}')
    expect(todo('z').date).toBe('2026-11-13')
    expect(cell('2026-11-13')).toContainElement(screen.getByTestId('todo-z'))
    await waitFor(() => expect(screen.getByTestId('todo-z')).toHaveFocus())
  })

  it('does not move past the supported years', async () => {
    const user = setup('#/calendar/1900-01', {
      ...data,
      todos: [makeTodo('e', { date: '1900-01-01' })],
    })
    focus(screen.getByTestId('todo-e'))
    await user.keyboard('{ArrowLeft}')
    expect(todo('e').date).toBe('1900-01-01')
  })

  it('opens the panel with Enter', async () => {
    const user = setup()
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })

  it('deletes with Delete, shows the toast, and Ctrl+Z restores', async () => {
    const user = setup()
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{Delete}')
    expect(s().data.todos.map((item) => item.id)).toEqual(['t2', 't3', 't4'])
    expect(await screen.findByText('已删除「写周报」')).toBeInTheDocument()
    await waitFor(() => expect(cell('2026-11-12')).toHaveFocus())
    await user.keyboard('{Control>}z{/Control}')
    expect(s().data.todos.map((item) => item.id)).toEqual(['t1', 't2', 't3', 't4'])
  })

  it('leaves the todo alone when Ctrl is held', async () => {
    const user = setup()
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(todo('t1').date).toBe('2026-11-12')
  })

  it('undoes and redoes exactly once with Ctrl+Z and Ctrl+Shift+Z', async () => {
    const user = setup()
    focus(screen.getByTestId('todo-t1'))
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(todo('t1').date).toBe('2026-11-14')
    await user.keyboard('{Control>}z{/Control}')
    expect(todo('t1').date).toBe('2026-11-13')
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(todo('t1').date).toBe('2026-11-14')
  })
})

describe('milestones', () => {
  it('moves a day with the left and right arrows and a week with up and down', async () => {
    const user = setup()
    focus(screen.getByTestId('milestone-m1'))
    await user.keyboard('{ArrowRight}')
    expect(milestone().date).toBe('2026-11-21')
    await waitFor(() => expect(screen.getByTestId('milestone-m1')).toHaveFocus())
    await user.keyboard('{ArrowUp}')
    expect(milestone().date).toBe('2026-11-14')
  })

  it('opens the editor with Enter and clears the selection with Escape', async () => {
    const user = setup()
    focus(screen.getByTestId('milestone-m1'))
    expect(s().selection).toEqual({ kind: 'milestone', id: 'm1' })
    await user.keyboard('{Escape}')
    expect(s().selection).toBeNull()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
  })

  it('has no done state: Space does nothing', async () => {
    const user = setup()
    focus(screen.getByTestId('milestone-m1'))
    const before = s().data
    await user.keyboard(' ')
    expect(s().data).toBe(before)
  })

  it('deletes with Delete', async () => {
    const user = setup()
    focus(screen.getByTestId('milestone-m1'))
    await user.keyboard('{Delete}')
    expect(s().data.milestones).toEqual([])
    expect(await screen.findByText('已删除「面试」')).toBeInTheDocument()
  })
})

describe('the unscheduled list', () => {
  const item = () => within(screen.getByTestId('unscheduled')).getByTestId('todo-t4')

  it('opens the panel with Enter and ticks with Space', async () => {
    const user = setup()
    focus(item())
    await user.keyboard(' ')
    expect(todo('t4').done).toBe(true)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })

  it('has no date to move, so the arrows leave it alone', async () => {
    const user = setup()
    focus(item())
    const before = s().data
    await user.keyboard('{ArrowRight}{ArrowDown}')
    expect(s().data).toBe(before)
  })

  it('deletes with Delete and gives the focus to the calendar', async () => {
    const user = setup()
    focus(item())
    await user.keyboard('{Delete}')
    expect(s().data.todos.map((entry) => entry.id)).toEqual(['t1', 't2', 't3'])
    await waitFor(() => expect(document.querySelector('[data-day][tabindex="0"]')).toHaveFocus())
  })
})

describe('keys that belong to something else', () => {
  it('ignores Delete and arrows inside the panel fields', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const title = await screen.findByDisplayValue('写周报')
    focus(title)
    const before = s().data
    await user.keyboard('{Delete}{ArrowRight}')
    expect(s().data).toBe(before)
  })
})

describe('after the panel closes', () => {
  it('puts the focus back on the item so its shortcuts keep working', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    await screen.findByRole('dialog', { name: '编辑待办' })

    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument(),
    )
    await waitFor(() => expect(screen.getByTestId('todo-t1')).toHaveFocus())

    await user.keyboard('{ArrowRight}')
    expect(todo('t1').date).toBe('2026-11-13')
    await user.keyboard('{Delete}')
    expect(s().data.todos.map((entry) => entry.id)).toEqual(['t2', 't3', 't4'])
  })
})
