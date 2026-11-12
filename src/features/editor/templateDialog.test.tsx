import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { TEMPLATES } from '@/data/templates'
import { resetViewport } from '@/features/timeline/useViewport'
import { resetEditor } from './editorStore'

const s = () => useStore.getState()

function setup() {
  s().hydrate({
    ...createEmptyData(),
    lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
  })
  render(<App />)
  return userEvent.setup()
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^更多/ }))
  await user.click(await screen.findByRole('menuitem', { name: '从模板添加' }))
  return screen.findByRole('dialog', { name: '从模板添加' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = ''
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

it('opens from the menu with the first template selected and today as the start date', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  expect(within(dialog).getByRole('radio', { name: /学期/ })).toBeChecked()
  expect(within(dialog).getByRole('radio', { name: /备考/ })).not.toBeChecked()
  expect(within(dialog).getByLabelText('开始日期')).toHaveValue('2026-11-10')
})

it('previews what will be added, with real dates', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  const preview = within(dialog).getByTestId('template-preview')
  expect(within(preview).getByText('课程')).toBeInTheDocument()
  expect(within(preview).getByText('开学适应 · 11-10 至 11-23')).toBeInTheDocument()
  expect(within(preview).getByText('期末考试（节点） · 03-09')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('radio', { name: /备考/ }))
  expect(within(preview).getByText('基础阶段 · 11-10 至 02-01')).toBeInTheDocument()
  fireEvent.change(within(dialog).getByLabelText('开始日期'), { target: { value: '2027-01-04' } })
  expect(within(preview).getByText('基础阶段 · 01-04 至 03-28')).toBeInTheDocument()
})

it('adds the chosen template after the existing data, with a toast', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('radio', { name: /备考/ }))
  await user.click(within(dialog).getByRole('button', { name: '添加' }))

  const exam = TEMPLATES.find((template) => template.id === 'exam-prep')!
  expect(screen.queryByRole('dialog', { name: '从模板添加' })).not.toBeInTheDocument()
  expect(s().data.lanes.map((lane) => lane.name)).toEqual(['考研', '基础', '强化', '冲刺'])
  expect(s().data.phases).toHaveLength(exam.phases.length)
  expect(s().data.milestones).toHaveLength(exam.milestones.length)
  expect(s().data.phases[0].start).toBe('2026-11-10')
  expect(await screen.findByText('已从模板「备考」添加 3 个板块')).toBeInTheDocument()
})

it('undoes the whole template in one step', async () => {
  const user = setup()
  const before = s().data
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('button', { name: '添加' }))
  expect(s().data.lanes).toHaveLength(4)
  await user.click(await screen.findByRole('button', { name: '撤销' }))
  expect(s().data).toEqual(before)
})

it('does not allow adding without a valid start date', async () => {
  const user = setup()
  const dialog = await openDialog(user)
  fireEvent.change(within(dialog).getByLabelText('开始日期'), { target: { value: '' } })
  expect(within(dialog).getByRole('button', { name: '添加' })).toBeDisabled()
  expect(within(dialog).getByText('填好开始日期后显示预览。')).toBeInTheDocument()
  expect(s().data.lanes).toHaveLength(1)
})

it('cancel leaves the data alone', async () => {
  const user = setup()
  const before = s().data
  const dialog = await openDialog(user)
  await user.click(within(dialog).getByRole('button', { name: '取消' }))
  act(() => undefined)
  expect(screen.queryByRole('dialog', { name: '从模板添加' })).not.toBeInTheDocument()
  expect(s().data).toBe(before)
})
