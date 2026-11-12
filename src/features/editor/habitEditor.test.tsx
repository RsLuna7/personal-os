import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { HabitEditor } from './HabitEditor'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 9, 9, 0)) // 周一
})
afterEach(() => vi.useRealTimers())

function setup(weekdays = [1, 2, 3, 4, 5, 6, 7]) {
  s().hydrate({
    ...createEmptyData(),
    lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
    habits: [
      {
        id: 'h1',
        name: '背单词',
        laneId: null,
        weekdays,
        checks: [],
        createdAt: '2026-10-01T00:00:00.000Z',
      },
    ],
  })
  const onClose = vi.fn()
  render(
    <>
      <div data-testid="habit-h1">背单词</div>
      <HabitEditor habitId="h1" anchor={null} onClose={onClose} />
    </>,
  )
  return { user: userEvent.setup(), onClose }
}

const habit = () => s().data.habits[0]

it('renames the habit', async () => {
  const { user } = setup()
  const name = screen.getByLabelText('名称')
  await user.clear(name)
  await user.type(name, '背 GRE 单词{Enter}')
  expect(habit().name).toBe('背 GRE 单词')
})

it('switches from every day to chosen weekdays', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('switch', { name: '每天' }))
  // 关掉“每天”后先只剩今天（周一）
  expect(habit().weekdays).toEqual([1])
  await user.click(screen.getByRole('button', { name: '周三' }))
  expect(habit().weekdays).toEqual([1, 3])
})

it('turns every day back on', async () => {
  const { user } = setup([1, 3])
  await user.click(screen.getByRole('switch', { name: '每天' }))
  expect(habit().weekdays).toEqual([1, 2, 3, 4, 5, 6, 7])
})

it('keeps at least one weekday', async () => {
  const { user } = setup([3])
  const wednesday = screen.getByRole('button', { name: '周三' })
  expect(wednesday).toHaveAttribute('aria-pressed', 'true')
  await user.click(wednesday)
  expect(habit().weekdays).toEqual([3])
})

it('links the habit to a lane', async () => {
  const { user } = setup()
  await user.selectOptions(screen.getByLabelText('板块'), 'l1')
  expect(habit().laneId).toBe('l1')
})

it('deletes the habit and closes', async () => {
  const { user, onClose } = setup()
  await user.click(screen.getByRole('button', { name: '删除' }))
  expect(s().data.habits).toEqual([])
  expect(onClose).toHaveBeenCalled()
})
