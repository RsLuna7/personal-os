import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import type { AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { calendarData as data, makeTodo } from '@/test/calendarFixtures'
import { filterByLanes } from './cells'

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
  useStore.getState().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const chip = (name: string) =>
  within(screen.getByTestId('lane-filter')).getByRole('button', { name })

describe('lane legend and filter', () => {
  it('lists each lane in order, plus 未分类 only when something has no lane', () => {
    setup()
    const names = within(screen.getByTestId('lane-filter'))
      .getAllByRole('button')
      .map((button) => button.textContent)
    // 夹具里“买菜”不挂板块
    expect(names).toEqual(['考研', '实习', '未分类'])
  })

  it('has no 未分类 chip when every item has a lane', () => {
    setup({ ...data, todos: data.todos.filter((todo) => todo.id !== 't2') })
    expect(within(screen.getByTestId('lane-filter')).queryByText('未分类')).toBeNull()
  })

  it('shows everything and nothing pressed to begin with', () => {
    setup()
    for (const name of ['考研', '实习', '未分类'])
      expect(chip(name)).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: '显示全部' })).toBeNull()
    expect(screen.getByTestId('todo-t1')).toBeInTheDocument()
  })

  it('shows only the picked lane, in cells and for milestones, and goes back on a second click', async () => {
    const user = setup()
    await user.click(chip('实习'))
    expect(chip('实习')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByTestId('todo-t1')).toBeNull() // 考研
    expect(screen.queryByTestId('todo-t2')).toBeNull() // 未分类
    expect(screen.getByTestId('todo-t3')).toBeInTheDocument()
    expect(screen.getByTestId('milestone-m1')).toBeInTheDocument()
    await user.click(chip('实习'))
    expect(screen.getByTestId('todo-t1')).toBeInTheDocument()
  })

  it('allows several lanes and clears them with 显示全部', async () => {
    const user = setup()
    await user.click(chip('考研'))
    await user.click(chip('未分类'))
    expect(screen.getByTestId('todo-t1')).toBeInTheDocument()
    expect(screen.getByTestId('todo-t2')).toBeInTheDocument()
    expect(screen.queryByTestId('todo-t3')).toBeNull()
    await user.click(screen.getByRole('button', { name: '显示全部' }))
    expect(screen.getByTestId('todo-t3')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '显示全部' })).toBeNull()
  })

  it('leaves the unscheduled list alone', async () => {
    const user = setup()
    await user.click(chip('实习'))
    // 读论文挂在考研上，但“未安排”不筛，免得添加后立刻消失
    expect(within(screen.getByTestId('unscheduled')).getByTestId('todo-t4')).toBeInTheDocument()
  })

  it('counts the “+N” from what is shown', async () => {
    const todos = ['甲', '乙', '丙', '丁', '戊'].map((title, index) =>
      makeTodo(`x${index}`, { title, date: '2026-11-09', laneId: index < 4 ? 'l1' : 'l2' }),
    )
    const user = setup({ ...data, todos })
    expect(screen.getByTestId('more-2026-11-09')).toHaveTextContent('+2')
    await user.click(chip('实习'))
    expect(screen.queryByTestId('more-2026-11-09')).toBeNull()
    expect(within(screen.getByTestId('day-2026-11-09')).getAllByTestId(/^todo-/)).toHaveLength(1)
  })

  it('keeps a todo created while a filter hides its lane, so the editor can find it', async () => {
    const user = setup()
    await user.click(chip('实习'))
    screen.getByTestId('day-2026-11-14').focus()
    await user.keyboard('{Enter}')
    const mine = useStore.getState().data.todos.find((todo) => todo.title === '新待办')!
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
    expect(
      within(screen.getByTestId('day-2026-11-14')).getByTestId(`todo-${mine.id}`),
    ).toBeInTheDocument()
  })

  it('drops a filter whose lane was deleted', async () => {
    const user = setup()
    await user.click(chip('实习'))
    act(() => useStore.getState().removeLane('l2'))
    expect(screen.queryByRole('button', { name: '显示全部' })).toBeNull()
    expect(screen.getByTestId('todo-t1')).toBeInTheDocument()
  })
})

describe('filterByLanes', () => {
  it('returns the same object when nothing is picked', () => {
    const input = { lanes: data.lanes, milestones: data.milestones, todos: data.todos }
    expect(filterByLanes(input, new Set())).toBe(input)
  })

  it('keeps pinned ids whatever the filter says', () => {
    const input = { lanes: data.lanes, milestones: data.milestones, todos: data.todos }
    const result = filterByLanes(input, new Set(['l2']), ['t1', null, undefined])
    expect(result.todos.map((todo) => todo.id).sort()).toEqual(
      ['t1', 't3', 't4'].filter((id) => id !== 't4'),
    )
  })
})
