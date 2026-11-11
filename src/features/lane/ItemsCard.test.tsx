import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData, type Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { openEditor, resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'

const s = () => useStore.getState()

const lane = (id: string, order: number): Lane => ({
  id,
  name: id,
  color: 'iris',
  order,
  note: '',
  links: [],
})

const data: AppData = {
  ...createEmptyData(),
  lanes: [lane('lA', 0), lane('lB', 1), lane('lC', 2)],
  phases: [
    {
      id: 'pa',
      laneId: 'lA',
      name: 'A的阶段',
      start: '2026-11-02',
      end: '2026-12-07',
      tentative: false,
      note: '',
    },
    {
      id: 'pe',
      laneId: 'lB',
      name: '旧阶段',
      start: '2026-09-01',
      end: '2026-10-01',
      tentative: false,
      note: '',
    },
    {
      id: 'pt',
      laneId: 'lB',
      name: '待定阶段',
      start: '2026-12-14',
      end: '2026-12-28',
      tentative: true,
      note: '',
    },
    {
      id: 'pc',
      laneId: 'lB',
      name: '当前阶段',
      start: '2026-11-02',
      end: '2026-12-07',
      tentative: false,
      note: '',
    },
  ],
  milestones: [
    { id: 'me', laneId: 'lB', name: '旧节点', date: '2026-11-01', note: '' },
    { id: 'mc', laneId: 'lB', name: '初试', date: '2026-12-19', note: '' },
    { id: 'ma', laneId: 'lA', name: 'A的节点', date: '2026-11-20', note: '' },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup(laneId = 'lB') {
  window.location.hash = `#/modules/${laneId}`
  s().hydrate(data)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const card = () => within(screen.getByRole('region', { name: '阶段与节点' }))
const rowTexts = () =>
  card()
    .queryAllByRole('listitem')
    .map((item) => item.textContent ?? '')

it('lists the lane items in time order with their status text', () => {
  setup()
  const rows = rowTexts()
  expect(rows).toHaveLength(3)
  expect(rows[0]).toContain('当前阶段')
  expect(rows[0]).toContain('11月2日 – 12月6日')
  expect(rows[0]).toContain('进行中')
  expect(rows[1]).toContain('待定阶段')
  expect(rows[1]).toContain('待确认')
  expect(rows[2]).toContain('初试')
  expect(rows[2]).toContain('12月19日')
  expect(rows[2]).toContain('还有 39 天')
})

it('leaves out the items of other lanes', () => {
  setup()
  expect(card().queryByText('A的阶段')).not.toBeInTheDocument()
  expect(card().queryByText('A的节点')).not.toBeInTheDocument()
})

it('folds ended items and expands them on request', async () => {
  const user = setup()
  const toggle = card().getByRole('button', { name: '已结束 2 项' })
  expect(toggle).toHaveAttribute('aria-expanded', 'false')
  expect(card().queryByText('旧阶段')).not.toBeInTheDocument()
  expect(card().queryByText('旧节点')).not.toBeInTheDocument()

  await user.click(toggle)
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(card().getByText('旧阶段')).toBeInTheDocument()
  expect(card().getByText('旧节点')).toBeInTheDocument()
  expect(rowTexts()[0]).toContain('旧阶段')
})

it('expands the ended group by itself when an ended item is selected', () => {
  setup()
  act(() => s().select({ kind: 'phase', id: 'pe' }))
  expect(card().getByText('旧阶段')).toBeInTheDocument()
})

it('keeps an ended item visible while it is being edited', () => {
  setup()
  act(() => openEditor('milestone', 'me'))
  expect(card().getByText('旧节点')).toBeInTheDocument()
})

it('opens the editor from a row and shows a rename in the list', async () => {
  const user = setup()
  await user.click(card().getByRole('button', { name: /当前阶段/ }))
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'phase', id: 'pc' })
  expect(s().selection).toEqual({ kind: 'phase', id: 'pc' })

  const name = await screen.findByLabelText('名称')
  await user.clear(name)
  await user.type(name, '改后的名字{Enter}')
  expect(s().data.phases.find((p) => p.id === 'pc')!.name).toBe('改后的名字')
  expect(card().getByText('改后的名字')).toBeInTheDocument()
})

it('adds a phase to the lane being viewed, not the first one', async () => {
  const user = setup()
  await user.click(card().getByRole('button', { name: '添加阶段' }))
  const added = s().data.phases.filter((p) => !data.phases.some((old) => old.id === p.id))
  expect(added).toHaveLength(1)
  expect(added[0]!.laneId).toBe('lB')
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'phase', id: added[0]!.id })
  // 面板要真的显示出来：它靠列表里的行定位
  expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
})

it('adds a milestone to the lane being viewed, dated today', async () => {
  const user = setup()
  await user.click(card().getByRole('button', { name: '添加节点' }))
  const added = s().data.milestones.filter((m) => !data.milestones.some((old) => old.id === m.id))
  expect(added).toHaveLength(1)
  expect(added[0]!.laneId).toBe('lB')
  expect(added[0]!.date).toBe('2026-11-10')
  expect(useEditorStore.getState().editing).toMatchObject({ kind: 'milestone', id: added[0]!.id })
  expect(rowTexts().some((text) => text.includes('就是今天'))).toBe(true)
})

it('shows an empty state without a fold button for a lane with nothing', () => {
  setup('lC')
  expect(card().getByText('这个板块还没有阶段和节点')).toBeInTheDocument()
  expect(card().queryByRole('button', { name: /已结束/ })).not.toBeInTheDocument()
})

it('keeps the same row element when an edit moves it between the ended and current groups', async () => {
  const user = setup()
  await user.click(card().getByRole('button', { name: '已结束 2 项' }))
  const before = card().getByTestId('milestone-mc')
  act(() => s().updateMilestone('mc', { date: '2026-11-05' }))
  const after = card().getByTestId('milestone-mc')
  // 编辑面板贴着这个元素，换了元素面板就找不到位置
  expect(after).toBe(before)
  expect(after.isConnected).toBe(true)
})

it('closes the editor when the edited item is moved to another lane', () => {
  setup()
  act(() => openEditor('milestone', 'mc'))
  expect(useEditorStore.getState().editing).not.toBeNull()
  act(() => s().updateMilestone('mc', { laneId: 'lA' }))
  expect(useEditorStore.getState().editing).toBeNull()
})

it('lets the fold be collapsed again after an ended row was clicked', async () => {
  const user = setup()
  act(() => s().select({ kind: 'phase', id: 'pe' }))
  expect(card().getByText('旧阶段')).toBeInTheDocument()
  await user.click(card().getByRole('button', { name: '已结束 2 项' }))
  expect(card().queryByText('旧阶段')).not.toBeInTheDocument()
  expect(s().selection).toBeNull()
})
