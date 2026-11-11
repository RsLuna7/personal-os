import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from '@/features/timeline/days'
import { dayToX, type Scale } from '@/features/timeline/scale'
import { resetViewport, useViewportStore } from '@/features/timeline/useViewport'
import { resetEditor } from './editorStore'

const SCALE: Scale = { originDay: toDay('2026-11-02'), pxPerDay: 2 }
const s = () => useStore.getState()
const phase = (id = 'p1') => s().data.phases.find((p) => p.id === id)
const milestone = (id = 'm1') => s().data.milestones.find((m) => m.id === id)

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
      name: '基础',
      start: '2026-11-09',
      end: '2026-12-07',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', note: '' }],
  terms: [{ id: 't1', name: '大三上', start: '2026-09-07', end: '2027-01-18' }],
}

function setup(initial: AppData = data) {
  s().hydrate(initial)
  render(<App />)
  act(() => useViewportStore.setState({ scale: SCALE, width: 1000 }))
  return userEvent.setup()
}

async function openPhaseEditor(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('phase-p1'))
  return screen.findByRole('dialog', { name: '编辑阶段' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/timeline'
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

it('opens the phase editor on click with the name, inclusive end date and lane filled in', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  expect(within(dialog).getByLabelText('名称')).toHaveValue('基础')
  expect(within(dialog).getByLabelText('开始')).toHaveValue('2026-11-09')
  expect(within(dialog).getByLabelText('结束')).toHaveValue('2026-12-06')
  expect(within(dialog).getByLabelText('板块')).toHaveValue('l1')
  expect(within(dialog).getByLabelText('待确认')).not.toBeChecked()
  expect(within(dialog).getByLabelText('备注')).toHaveValue('')
})

it('saves the name on Enter and on blur', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  const name = within(dialog).getByLabelText('名称')
  await user.clear(name)
  await user.type(name, '强化{Enter}')
  expect(phase()!.name).toBe('强化')
  await user.clear(name)
  await user.type(name, '冲刺')
  await user.tab()
  expect(phase()!.name).toBe('冲刺')
})

it('saves the note on blur', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.type(within(dialog).getByLabelText('备注'), '先过一遍教材')
  await user.tab()
  expect(phase()!.note).toBe('先过一遍教材')
})

it('saves an edited end date as exclusive', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  fireEvent.change(within(dialog).getByLabelText('结束'), { target: { value: '2026-12-20' } })
  expect(phase()!.end).toBe('2026-12-21')
})

it('saves an edited start date', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  fireEvent.change(within(dialog).getByLabelText('开始'), { target: { value: '2026-11-11' } })
  expect(phase()!.start).toBe('2026-11-11')
})

it('shows an error and does not save when the end is before the start', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  fireEvent.change(within(dialog).getByLabelText('结束'), { target: { value: '2026-11-01' } })
  expect(within(dialog).getByRole('alert')).toHaveTextContent('结束日期不能早于开始日期')
  expect([phase()!.start, phase()!.end]).toEqual(['2026-11-09', '2026-12-07'])
})

it('shows an error and does not save when a date is cleared', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  const start = within(dialog).getByLabelText('开始')
  fireEvent.change(start, { target: { value: '' } })
  fireEvent.blur(start)
  expect(within(dialog).getByRole('alert')).toHaveTextContent('请填写日期')
  expect(phase()!.start).toBe('2026-11-09')
})

it('does not save a half-typed year', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  const n = s().past.length
  fireEvent.change(within(dialog).getByLabelText('开始'), { target: { value: '0002-11-09' } })
  expect(s().past.length).toBe(n)
})

it('falls back to 未命名 when the name is cleared', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.clear(within(dialog).getByLabelText('名称'))
  await user.tab()
  expect(phase()!.name).toBe('未命名')
})

it('toggles tentative', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.click(within(dialog).getByLabelText('待确认'))
  expect(phase()!.tentative).toBe(true)
  expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-tentative', 'true')
})

it('moves a phase to another lane', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.selectOptions(within(dialog).getByLabelText('板块'), 'l2')
  expect(phase()!.laneId).toBe('l2')
})

it('closes the editor on Escape, saving what was typed', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  const name = within(dialog).getByLabelText('名称')
  await user.clear(name)
  await user.type(name, '强化')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(phase()!.name).toBe('强化')
})

it('deletes without a confirm dialog and offers undo', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.click(within(dialog).getByRole('button', { name: '删除' }))
  expect(phase()).toBeUndefined()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(await screen.findByText('已删除「基础」')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(phase()).toBeDefined()
})

it('dismisses the delete toast when another change happens', async () => {
  const user = setup()
  const dialog = await openPhaseEditor(user)
  await user.click(within(dialog).getByRole('button', { name: '删除' }))
  expect(await screen.findByText('已删除「基础」')).toBeInTheDocument()
  act(() => void s().addLane())
  await waitFor(() => expect(screen.queryByText('已删除「基础」')).not.toBeInTheDocument())
})

it('edits a milestone name, date and lane', async () => {
  const user = setup()
  await user.click(screen.getByTestId('milestone-m1'))
  const dialog = await screen.findByRole('dialog', { name: '编辑节点' })
  const name = within(dialog).getByLabelText('名称')
  await user.clear(name)
  await user.type(name, '复试{Enter}')
  fireEvent.change(within(dialog).getByLabelText('日期'), { target: { value: '2027-03-20' } })
  await user.selectOptions(within(dialog).getByLabelText('板块'), 'l2')
  expect(milestone()).toMatchObject({ name: '复试', date: '2027-03-20', laneId: 'l2' })
  await user.click(within(dialog).getByRole('button', { name: '删除' }))
  expect(milestone()).toBeUndefined()
  expect(await screen.findByText('已删除「复试」')).toBeInTheDocument()
})

it('adds a phase, a milestone and a lane from the add menu', async () => {
  const user = setup()
  await user.click(screen.getByRole('button', { name: '添加' }))
  await user.click(await screen.findByRole('menuitem', { name: '阶段' }))
  const created = s().data.phases.find((p) => p.id !== 'p1')!
  expect(created).toMatchObject({ laneId: 'l1', start: '2026-11-09', end: '2026-12-07' })
  expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
  await user.keyboard('{Escape}')

  await user.click(screen.getByRole('button', { name: '添加' }))
  await user.click(await screen.findByRole('menuitem', { name: '节点' }))
  const dot = s().data.milestones.find((m) => m.id !== 'm1')!
  expect(dot).toMatchObject({ laneId: 'l1', date: '2026-11-10', name: '新节点' })
  await user.keyboard('{Escape}')

  await user.click(screen.getByRole('button', { name: '添加' }))
  await user.click(await screen.findByRole('menuitem', { name: '板块' }))
  expect(s().data.lanes).toHaveLength(3)
  expect(await screen.findByDisplayValue('新板块')).toHaveFocus()
})

it('disables 阶段 and 节点 in the add menu when there are no lanes', async () => {
  const user = setup(createEmptyData())
  await user.click(screen.getByRole('button', { name: '添加' }))
  expect(await screen.findByRole('menuitem', { name: '阶段' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  expect(screen.getByRole('menuitem', { name: '节点' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('menuitem', { name: '板块' })).not.toHaveAttribute('aria-disabled')
})

it('renames, recolours, reorders and deletes a lane from its menu', async () => {
  const user = setup()
  const lane = () => s().data.lanes.find((l) => l.id === 'l1')

  await user.click(screen.getByRole('button', { name: '考研' }))
  await user.click(await screen.findByRole('menuitem', { name: '重命名' }))
  const input = await screen.findByDisplayValue('考研')
  await user.clear(input)
  await user.type(input, '考研数学{Enter}')
  expect(lane()!.name).toBe('考研数学')

  await user.click(screen.getByRole('button', { name: '考研数学' }))
  await user.click(await screen.findByRole('menuitemradio', { name: '青绿' }))
  expect(lane()!.color).toBe('teal')

  await user.click(screen.getByRole('button', { name: '考研数学' }))
  expect(await screen.findByRole('menuitem', { name: '上移' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await user.click(screen.getByRole('menuitem', { name: '下移' }))
  expect(lane()!.order).toBe(1)

  await user.click(screen.getByRole('button', { name: '考研数学' }))
  await user.click(await screen.findByRole('menuitem', { name: '删除板块' }))
  expect(lane()).toBeUndefined()
  expect(s().data.phases).toEqual([])
  expect(await screen.findByText('已删除「考研数学」')).toBeInTheDocument()
})

it('puts a new lane from the last row into rename mode', async () => {
  const user = setup()
  await user.click(screen.getByRole('button', { name: '添加板块' }))
  const input = await screen.findByDisplayValue('新板块')
  expect(input).toHaveFocus()
  await user.keyboard('实习{Enter}')
  expect(s().data.lanes.find((l) => l.order === 2)!.name).toBe('实习')
})

it('edits terms in the dialog as a single undo step', async () => {
  const user = setup()
  const n = s().past.length
  await user.click(screen.getByTestId('term-t1'))
  const dialog = await screen.findByRole('dialog', { name: '编辑学期' })
  const name = within(dialog).getByLabelText('名称')
  expect(within(dialog).getByLabelText('结束')).toHaveValue('2027-01-17')
  await user.clear(name)
  await user.type(name, '大三上学期')
  await user.click(within(dialog).getByRole('button', { name: '添加学期' }))
  expect(within(dialog).getAllByLabelText('名称')).toHaveLength(2)
  expect(s().data.terms).toHaveLength(1)
  await user.click(within(dialog).getByRole('button', { name: '完成' }))
  expect(s().data.terms.map((t) => t.name)).toEqual(['大三上学期', '新学期'])
  expect(s().data.terms[1].start).toBe('2027-01-18')
  expect(s().past.length).toBe(n + 1)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
})

it('discards term edits on cancel', async () => {
  const user = setup()
  await user.click(screen.getByTestId('term-t1'))
  const dialog = await screen.findByRole('dialog', { name: '编辑学期' })
  await user.click(within(dialog).getByRole('button', { name: '删除学期' }))
  await user.click(within(dialog).getByRole('button', { name: '取消' }))
  expect(s().data.terms).toHaveLength(1)
})

it('rejects overlapping or reversed terms', async () => {
  const user = setup()
  await user.click(screen.getByTestId('term-t1'))
  const dialog = await screen.findByRole('dialog', { name: '编辑学期' })
  await user.click(within(dialog).getByRole('button', { name: '添加学期' }))
  const starts = within(dialog).getAllByLabelText('开始')
  fireEvent.change(starts[1], { target: { value: '2027-01-01' } })
  await user.click(within(dialog).getByRole('button', { name: '完成' }))
  expect(within(dialog).getByRole('alert')).toHaveTextContent('学期时间不能重叠')
  expect(s().data.terms).toHaveLength(1)

  fireEvent.change(starts[1], { target: { value: '2027-01-18' } })
  fireEvent.change(within(dialog).getAllByLabelText('结束')[1], {
    target: { value: '2027-01-10' },
  })
  await user.click(within(dialog).getByRole('button', { name: '完成' }))
  expect(within(dialog).getByRole('alert')).toHaveTextContent('结束日期不能早于开始日期')
  expect(s().data.terms).toHaveLength(1)
})

it('opens the editor with the name selected right after creating a phase by double-click', async () => {
  setup()
  fireEvent.doubleClick(screen.getByTestId('lane-l2-canvas'), {
    clientX: dayToX(SCALE, toDay('2027-01-13')),
  })
  const dialog = await screen.findByRole('dialog', { name: '编辑阶段' })
  const name = within(dialog).getByLabelText('名称') as HTMLInputElement
  await waitFor(() => expect(name).toHaveFocus())
  expect(name).toHaveValue('新阶段')
  expect([name.selectionStart, name.selectionEnd]).toEqual([0, 3])
})
