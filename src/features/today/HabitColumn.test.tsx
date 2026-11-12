import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData, type Habit } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { toDay } from '@/features/timeline/days'
import { HabitColumn } from './HabitColumn'

const s = () => useStore.getState()
const today = toDay('2026-11-12') // 周四

function Harness() {
  const data = useStore((state) => state.data)
  return <HabitColumn habits={data.habits} lanes={data.lanes} today={today} />
}

function setup(habits: Partial<Habit>[]) {
  s().hydrate({
    ...createEmptyData(),
    habits: habits.map((habit, index) => ({
      id: `h${index}`,
      name: `习惯${index}`,
      laneId: null,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      checks: [],
      createdAt: `2026-10-01T00:00:0${index}.000Z`,
      ...habit,
    })),
  })
  render(<Harness />)
  return { user: userEvent.setup(), column: screen.getByTestId('habit-column') }
}

const habit = (id: string) => s().data.habits.find((item) => item.id === id)!

beforeEach(() => resetEditor())

it('lists habits due today and folds the rest away', async () => {
  const { user, column } = setup([
    { id: 'words', name: '背单词' },
    { id: 'gym', name: '健身', weekdays: [1, 3, 5] },
  ])
  expect(within(column).getByTestId('habit-words')).toBeInTheDocument()
  expect(within(column).queryByTestId('habit-gym')).not.toBeInTheDocument()
  await user.click(within(column).getByRole('button', { name: /今天不用打 1/ }))
  const gym = within(column).getByTestId('habit-gym')
  expect(within(gym).queryByRole('checkbox')).not.toBeInTheDocument()
})

it('checks in for today and the streak grows', async () => {
  const { user, column } = setup([
    { id: 'words', name: '背单词', checks: ['2026-11-10', '2026-11-11'] },
  ])
  const row = within(column).getByTestId('habit-words')
  expect(within(row).getByText('2 天')).toBeInTheDocument()
  await user.click(within(row).getByRole('checkbox', { name: '打卡「背单词」' }))
  expect(habit('words').checks).toContain('2026-11-12')
  expect(within(row).getByText('3 天')).toBeInTheDocument()
})

it('backfills and clears a day within the last week', async () => {
  const { user, column } = setup([{ id: 'words', name: '背单词' }])
  const row = within(column).getByTestId('habit-words')
  const cell = within(row).getByRole('button', { name: '11月6日 未打卡' })
  await user.click(cell)
  expect(habit('words').checks).toEqual(['2026-11-06'])
  const done = within(row).getByRole('button', { name: '11月6日 已打卡' })
  expect(done).toHaveAttribute('data-mark', 'done')
  await user.click(done)
  expect(habit('words').checks).toEqual([])
})

it('shows only the last seven days', () => {
  const { column } = setup([{ id: 'words', name: '背单词' }])
  const row = within(column).getByTestId('habit-words')
  expect(within(row).getAllByRole('button', { name: /^\d+月\d+日 / })).toHaveLength(7)
})

it('labels off days and hides a zero streak', () => {
  const { column } = setup([{ id: 'gym', name: '健身', weekdays: [4] }])
  const row = within(column).getByTestId('habit-gym')
  expect(within(row).getByRole('button', { name: '11月11日 不用打' })).toHaveAttribute(
    'data-mark',
    'off',
  )
  expect(within(row).queryByText(/ 天$/)).not.toBeInTheDocument()
})

it('creates a habit and opens its editor', async () => {
  const { user, column } = setup([])
  expect(within(column).getByText('还没有习惯')).toBeInTheDocument()
  await user.click(within(column).getByRole('button', { name: '+ 新习惯' }))
  expect(s().data.habits).toHaveLength(1)
  expect(useEditorStore.getState().editing).toEqual({
    kind: 'habit',
    id: s().data.habits[0].id,
    selectName: true,
  })
})

it('opens the editor from the habit name', async () => {
  const { user, column } = setup([{ id: 'words', name: '背单词' }])
  await user.click(within(column).getByRole('button', { name: '背单词' }))
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'habit', id: 'words' })
})
