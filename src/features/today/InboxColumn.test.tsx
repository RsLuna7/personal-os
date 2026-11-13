import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData, type Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { LINGER_MS } from '@/features/home/useLinger'
import { toDay } from '@/features/timeline/days'
import { InboxColumn } from './InboxColumn'

const s = () => useStore.getState()
const today = toDay('2026-11-12')

function Harness() {
  const data = useStore((state) => state.data)
  return <InboxColumn todos={data.todos} lanes={data.lanes} today={today} />
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
  return { user: userEvent.setup(), column: screen.getByTestId('inbox-column') }
}

beforeEach(() => resetEditor())

it('groups unscheduled todos and the coming days', () => {
  const { column } = setup([
    { id: 'a', title: '预约体检' },
    { id: 'b', title: '交作业', date: '2026-11-13' },
  ])
  expect(within(column).getByText('未安排')).toBeInTheDocument()
  expect(within(column).getByText('明天')).toBeInTheDocument()
  expect(within(column).getByText('预约体检')).toBeInTheDocument()
  expect(within(column).getByText('交作业')).toBeInTheDocument()
})

it('moves a todo to today', async () => {
  const { user, column } = setup([{ id: 'a', title: '预约体检' }])
  await user.click(within(column).getByRole('button', { name: '移到今天「预约体检」' }))
  expect(s().data.todos[0].date).toBe('2026-11-12')
  expect(within(column).queryByText('预约体检')).not.toBeInTheDocument()
})

it('lets a ticked todo linger before it disappears', () => {
  vi.useFakeTimers()
  try {
    const { column } = setup([{ id: 'a', title: '预约体检' }])
    fireEvent.click(within(column).getByRole('checkbox', { name: '完成「预约体检」' }))
    expect(within(column).getByText('预约体检')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(LINGER_MS))
    expect(within(column).queryByText('预约体检')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

it('says so when the inbox is empty', () => {
  const { column } = setup([])
  expect(within(column).getByText('收件箱是空的')).toBeInTheDocument()
})
