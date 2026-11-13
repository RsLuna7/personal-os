import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData, type Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { LINGER_MS } from '@/features/home/useLinger'
import { toDay } from '@/features/timeline/days'
import { TodayColumn } from './TodayColumn'

const s = () => useStore.getState()
const today = toDay('2026-11-12')

function Harness() {
  const data = useStore((state) => state.data)
  return <TodayColumn todos={data.todos} lanes={data.lanes} today={today} />
}

function setup(todos: Partial<Todo>[]) {
  s().hydrate({
    ...createEmptyData(),
    todos: todos.map((todo, index) => ({
      id: `t${index}`,
      title: `待办${index}`,
      date: '2026-11-12',
      done: false,
      laneId: null,
      createdAt: `2026-11-01T00:00:0${index}.000Z`,
      ...todo,
    })),
  })
  render(<Harness />)
  return { user: userEvent.setup(), column: screen.getByTestId('today-column') }
}

const todo = (id: string) => s().data.todos.find((item) => item.id === id)

beforeEach(() => resetEditor())

it('shows overdue and today groups without a limit', () => {
  const { column } = setup([
    { id: 'old', date: '2026-11-10' },
    ...Array.from({ length: 7 }, (_, i) => ({ id: `d${i}` })),
  ])
  expect(within(column).getByText('过期 1')).toBeInTheDocument()
  expect(within(column).getByText('今天 7')).toBeInTheDocument()
  expect(within(column).getAllByRole('checkbox')).toHaveLength(8)
})

it('moves every overdue todo to today', async () => {
  const { user, column } = setup([{ id: 'old', date: '2026-11-10' }])
  await user.click(within(column).getByRole('button', { name: '全部移到今天' }))
  expect(todo('old')?.date).toBe('2026-11-12')
})

it('adds todos for today and keeps the input open', async () => {
  const { user, column } = setup([])
  await user.click(within(column).getByRole('button', { name: '+ 添加今天的待办' }))
  const input = within(column).getByRole('textbox', { name: '新待办' })
  await user.type(input, '买牛奶{Enter}')
  expect(s().data.todos).toEqual([
    expect.objectContaining({ title: '买牛奶', date: '2026-11-12', done: false }),
  ])
  expect(input).toHaveValue('')
  expect(input).toHaveFocus()
  await user.type(input, '   {Enter}')
  expect(s().data.todos).toHaveLength(1)
  await user.keyboard('{Escape}')
  expect(within(column).queryByRole('textbox', { name: '新待办' })).not.toBeInTheDocument()
})

it('defers a todo to tomorrow', async () => {
  const { user, column } = setup([{ id: 'a', title: '交作业' }])
  await user.click(within(column).getByRole('button', { name: '推到明天「交作业」' }))
  expect(todo('a')?.date).toBe('2026-11-13')
})

it('sends a todo back to the inbox', async () => {
  const { user, column } = setup([{ id: 'a', title: '交作业' }])
  await user.click(within(column).getByRole('button', { name: '移回收件箱「交作业」' }))
  expect(todo('a')?.date).toBeNull()
})

it('deletes a todo and undo brings it back', async () => {
  const { user, column } = setup([{ id: 'a', title: '交作业' }])
  await user.click(within(column).getByRole('button', { name: '删除「交作业」' }))
  expect(todo('a')).toBeUndefined()
  act(() => s().undo())
  expect(todo('a')).toBeDefined()
})

it('opens the todo editor from the title', async () => {
  const { user, column } = setup([{ id: 'a', title: '交作业' }])
  await user.click(within(column).getByRole('button', { name: '交作业' }))
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'todo', id: 'a' })
})

it('leaves a ticked todo in place for a moment before folding it away', () => {
  vi.useFakeTimers()
  try {
    const { column } = setup([{ id: 'a', title: '交作业' }])
    fireEvent.click(within(column).getByRole('checkbox', { name: '完成「交作业」' }))
    expect(within(column).getByRole('checkbox', { name: '完成「交作业」' })).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(LINGER_MS))
    expect(
      within(column).queryByRole('checkbox', { name: '完成「交作业」' }),
    ).not.toBeInTheDocument()
    expect(within(column).getByRole('button', { name: /已完成 1/ })).toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('says so when there is nothing for today', () => {
  const { column } = setup([])
  expect(within(column).getByText('今天没有待办')).toBeInTheDocument()
})

it('offers no move actions on done todos', async () => {
  const { user, column } = setup([{ id: 'a', title: '交作业', done: true }])
  await user.click(within(column).getByRole('button', { name: /已完成 1/ }))
  expect(within(column).getByText('交作业')).toBeInTheDocument()
  expect(
    within(column).queryByRole('button', { name: '移回收件箱「交作业」' }),
  ).not.toBeInTheDocument()
  expect(
    within(column).queryByRole('button', { name: '推到明天「交作业」' }),
  ).not.toBeInTheDocument()
  expect(within(column).getByRole('button', { name: '删除「交作业」' })).toBeInTheDocument()
})
