import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'

const s = () => useStore.getState()

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '四级', color: 'tomato', order: 1, note: '', links: [] },
  ],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '真题训练',
      start: '2026-11-09',
      end: '2026-11-12',
      tentative: false,
      done: true,
      note: '',
    },
    {
      id: 'p2',
      laneId: 'l2',
      name: '词汇',
      start: '2026-11-18',
      end: '2026-12-18',
      tentative: false,
      done: false,
      note: '',
    },
  ],
  milestones: [
    { id: 'm1', laneId: 'l1', name: '模拟考', date: '2026-11-12', done: true, note: '' },
    { id: 'm2', laneId: 'l1', name: '报名截止', date: '2026-11-03', done: false, note: '' },
  ],
  todos: [
    {
      id: 't1',
      title: '交作业',
      date: '2026-11-17',
      done: false,
      laneId: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
  ],
}

function setup(initial: AppData = data) {
  s().hydrate(initial)
  window.location.hash = '#/review'
  render(<App />)
  return userEvent.setup()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

it('is reachable from the top bar', async () => {
  window.location.hash = ''
  s().hydrate(data)
  render(<App />)
  await userEvent.setup().click(screen.getByRole('link', { name: '回顾' }))
  expect(window.location.hash).toBe('#/review')
  expect(await screen.findByTestId('review')).toBeInTheDocument()
})

it('shows the current week by default and groups its sections by lane', () => {
  setup()
  expect(screen.getByTestId('review-range')).toHaveTextContent('2026年11月9日 – 11月15日（本周）')

  const done = screen.getByTestId('review-done')
  const lane = within(done).getByTestId('review-done-l1')
  expect(within(lane).getByText('考研')).toBeInTheDocument()
  expect(within(lane).getByText('真题训练')).toBeInTheDocument()
  expect(within(lane).getByText('模拟考')).toBeInTheDocument()
  expect(within(done).getByText('共 2 项')).toBeInTheDocument()

  const overdue = screen.getByTestId('review-overdue')
  expect(within(overdue).getByText('报名截止')).toBeInTheDocument()
  expect(within(overdue).getByText(/截至今天/)).toBeInTheDocument()
})

it('lists what is due next week, with lane-less todos under 未归入板块', () => {
  setup()
  const upcoming = screen.getByTestId('review-upcoming')
  expect(within(within(upcoming).getByTestId('review-upcoming-l2')).getByText('词汇')).toBeVisible()
  expect(within(upcoming).getByText('开始')).toBeInTheDocument()
  const loose = within(upcoming).getByTestId('review-upcoming-none')
  expect(within(loose).getByText('未归入板块')).toBeInTheDocument()
  expect(within(loose).getByText('交作业')).toBeInTheDocument()
})

it('moves between weeks and returns to this week', async () => {
  const user = setup()
  await user.click(screen.getByRole('button', { name: '下一周' }))
  expect(screen.getByTestId('review-range')).toHaveTextContent('2026年11月16日 – 11月22日')
  expect(screen.getByTestId('review-range')).not.toHaveTextContent('本周')
  expect(screen.getByRole('button', { name: '本周' })).toBeEnabled()
  // 下一周完成的东西为空
  expect(
    within(screen.getByTestId('review-done')).getByText('这一周还没有标记完成的事项。'),
  ).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '上一周' }))
  await user.click(screen.getByRole('button', { name: '上一周' }))
  expect(screen.getByTestId('review-range')).toHaveTextContent('2026年11月2日 – 11月8日')
  // 逾期不随周变化
  expect(within(screen.getByTestId('review-overdue')).getByText('报名截止')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '本周' }))
  expect(screen.getByTestId('review-range')).toHaveTextContent('（本周）')
  expect(screen.getByRole('button', { name: '本周' })).toBeDisabled()
})

it('shows Chinese empty states', () => {
  setup(createEmptyData())
  expect(screen.getByText('这一周还没有标记完成的事项。')).toBeInTheDocument()
  expect(screen.getByText('没有逾期未完成的事项。')).toBeInTheDocument()
  expect(screen.getByText('下一周没有到期的事项。')).toBeInTheDocument()
})

it('does not write to the data', async () => {
  const user = setup()
  const before = s().data
  await user.click(screen.getByRole('button', { name: '下一周' }))
  await user.click(screen.getByRole('button', { name: '本周' }))
  expect(s().data).toBe(before)
  expect(s().past).toHaveLength(0)
})
