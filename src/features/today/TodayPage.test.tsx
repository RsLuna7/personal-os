import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 12, 9, 0)) // 周四
  localStorage.clear()
  window.location.hash = '#/today'
  resetEditor()
})
afterEach(() => vi.useRealTimers())

const todo = (id: string, date: string | null, done = false) => ({
  id,
  title: id,
  date,
  done,
  laneId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
})
const habit = (id: string, weekdays: number[], checks: string[] = []) => ({
  id,
  name: id,
  laneId: null,
  weekdays,
  checks,
  createdAt: '2026-10-01T00:00:00.000Z',
})

function setup(data: Partial<AppData> = {}) {
  s().hydrate({ ...createEmptyData(), ...data })
  render(<App />)
  return userEvent.setup()
}

it('shows the date, the term week and today’s progress', () => {
  setup({
    terms: [{ id: 'term', name: '秋季学期', start: '2026-09-07', end: '2027-01-18' }],
    todos: [
      todo('交作业', '2026-11-12', true),
      todo('买牛奶', '2026-11-12'),
      todo('过期的', '2026-11-10'),
    ],
    habits: [
      habit('背单词', [1, 2, 3, 4, 5, 6, 7], ['2026-11-12']),
      habit('跑步', [4]),
      habit('读书', [1, 2, 3, 4, 5, 6, 7]),
      habit('健身', [1]),
    ],
  })
  const header = screen.getByTestId('today-header')
  expect(within(header).getByText('11月12日 周四')).toBeInTheDocument()
  expect(within(header).getByText('第10周')).toBeInTheDocument()
  expect(within(header).getByText('待办 1/2 · 打卡 1/3')).toBeInTheDocument()
})

it('leaves out the week outside a term', () => {
  setup()
  expect(within(screen.getByTestId('today-header')).queryByText(/^第\d+周$/)).toBeNull()
})

it('lays out today, habits and the inbox in that order', () => {
  setup()
  const page = screen.getByTestId('today-page')
  const order = Array.from(page.querySelectorAll('[data-testid$="-column"]')).map((el) =>
    el.getAttribute('data-testid'),
  )
  expect(order).toEqual(['today-column', 'habit-column', 'inbox-column'])
})

it('opens the todo editor from a title', async () => {
  const user = setup({ todos: [todo('买牛奶', '2026-11-12')] })
  await user.click(screen.getByRole('button', { name: '买牛奶' }))
  expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
})

it('opens the habit editor from a habit name', async () => {
  const user = setup({ habits: [habit('背单词', [1, 2, 3, 4, 5, 6, 7])] })
  await user.click(screen.getByRole('button', { name: '背单词' }))
  expect(await screen.findByRole('dialog', { name: '编辑习惯' })).toBeInTheDocument()
})

it('undoes with Ctrl+Z on the today page', async () => {
  const user = setup({ todos: [todo('买牛奶', '2026-11-12')] })
  await user.click(screen.getByRole('button', { name: '删除「买牛奶」' }))
  expect(s().data.todos).toEqual([])
  await user.keyboard('{Control>}z{/Control}')
  expect(s().data.todos.map((item) => item.id)).toEqual(['买牛奶'])
})

it('keeps the todo editor open when its todo leaves the page', async () => {
  const user = setup({ todos: [todo('买牛奶', '2026-11-12')] })
  await user.click(screen.getByRole('button', { name: '买牛奶' }))
  expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  act(() => s().updateTodo('买牛奶', { date: '2026-12-31' }))
  expect(screen.getByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
})

it('keeps the habit editor open when the habit stops being due today', async () => {
  const user = setup({ habits: [habit('背单词', [1, 2, 3, 4, 5, 6, 7])] })
  await user.click(screen.getByRole('button', { name: '背单词' }))
  const dialog = await screen.findByRole('dialog', { name: '编辑习惯' })
  // 今天周四：关掉“每天”时留下今天，习惯还在今天要打的列表里
  await user.click(within(dialog).getByRole('switch', { name: '每天' }))
  expect(s().data.habits[0].weekdays).toEqual([4])
  await user.click(within(dialog).getByRole('button', { name: '周一' }))
  await user.click(within(dialog).getByRole('button', { name: '周四' }))
  expect(s().data.habits[0].weekdays).toEqual([1])
  expect(screen.getByRole('dialog', { name: '编辑习惯' })).toBeInTheDocument()
})
