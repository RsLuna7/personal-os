import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'

const s = () => useStore.getState()

const data: AppData = {
  ...createEmptyData(),
  // 数组顺序故意和 order 相反
  lanes: [
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
  ],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '强化',
      start: '2026-11-02',
      end: '2026-12-07',
      tentative: false,
      done: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', done: false, note: '' }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/modules'
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup(hash = '#/modules', initial: AppData = data) {
  window.location.hash = hash
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const title = () => screen.getByRole('heading', { level: 1 })
const sidebar = () => screen.getByRole('navigation', { name: '板块列表' })
const row = (name: string) => within(sidebar()).getByRole('link', { name: new RegExp(name) })

it('selects the first lane by order when there is no parameter', () => {
  setup()
  expect(title()).toHaveTextContent('考研')
  expect(row('考研')).toHaveAttribute('aria-current', 'page')
  expect(row('实习')).not.toHaveAttribute('aria-current')
})

it('shows the lane the parameter points at', () => {
  setup('#/modules/l2')
  expect(title()).toHaveTextContent('实习')
  expect(row('实习')).toHaveAttribute('aria-current', 'page')
})

it('falls back to the first lane for an unknown parameter without errors', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  setup('#/modules/nope')
  expect(title()).toHaveTextContent('考研')
  expect(error).not.toHaveBeenCalled()
  error.mockRestore()
})

it('shows the empty state when there are no lanes', () => {
  setup('#/modules', createEmptyData())
  expect(screen.getByText('开始规划你的时间线')).toBeInTheDocument()
})

it('lists each lane with its current phase, and mutes lanes with nothing planned', () => {
  setup()
  expect(row('考研')).toHaveTextContent('强化')
  expect(row('考研')).toHaveAttribute('data-idle', 'false')
  expect(row('实习')).toHaveTextContent('暂无安排')
  expect(row('实习')).toHaveAttribute('data-idle', 'true')
})

it('shows what comes next for a lane with nothing in progress', () => {
  setup('#/modules', {
    ...data,
    phases: [
      ...data.phases,
      {
        id: 'p2',
        laneId: 'l2',
        name: '春招',
        start: '2027-02-22',
        end: '2027-04-05',
        tentative: false,
        done: false,
        note: '',
      },
    ],
  })
  expect(row('实习')).toHaveTextContent('下一阶段：春招 · 2月22日')
  expect(row('实习')).toHaveAttribute('data-idle', 'false')
})

it('summarises the selected lane in three cells under the title', () => {
  setup()
  const header = title().closest('header')!
  const current = within(header).getByTestId('lane-stat-current')
  expect(current).toHaveTextContent('当前阶段')
  expect(current).toHaveTextContent('强化')
  expect(within(current).getByRole('progressbar', { name: '强化进度' })).toHaveAttribute(
    'aria-valuenow',
    '23',
  )
  expect(current).toHaveTextContent('第 9 天 / 共 35 天 · 还剩 27 天')
  const milestone = within(header).getByTestId('lane-stat-milestone')
  expect(milestone).toHaveTextContent(/39\s*天后/)
  expect(milestone).toHaveTextContent('初试 · 12月19日')
  expect(milestone).toHaveAttribute('data-soon', 'false')
  // 没有下一阶段时这一格不显示
  expect(within(header).queryByTestId('lane-stat-next')).not.toBeInTheDocument()
})

it('highlights a milestone that is three days away or less', () => {
  setup('#/modules', {
    ...data,
    milestones: [
      { id: 'm2', laneId: 'l1', name: '现场确认', date: '2026-11-13', done: false, note: '' },
    ],
  })
  const milestone = within(title().closest('header')!).getByTestId('lane-stat-milestone')
  expect(milestone).toHaveTextContent(/3\s*天后/)
  expect(milestone).toHaveAttribute('data-soon', 'true')
})

it('says so when a lane has nothing in progress', () => {
  setup('#/modules/l2')
  expect(within(title().closest('header')!).getByTestId('lane-stat-current')).toHaveTextContent(
    '暂无进行中阶段',
  )
})

it('puts phases and milestones right under the header', () => {
  setup()
  const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
  expect(headings).toEqual(['阶段与节点', '备注', '资料链接'])
})

it('changes the address when another lane is picked', async () => {
  const user = setup()
  await user.click(row('实习'))
  await waitFor(() => expect(window.location.hash).toBe('#/modules/l2'))
  expect(title()).toHaveTextContent('实习')
})

it('goes back to the first lane when the selected one is deleted, and survives undo', async () => {
  const user = setup('#/modules/l2')
  await user.click(within(title()).getByRole('button', { name: '实习' }))
  await user.click(await screen.findByRole('menuitem', { name: '删除板块' }))
  expect(title()).toHaveTextContent('考研')

  await user.keyboard('{Control>}z{/Control}')
  expect(
    s()
      .data.lanes.map((lane) => lane.id)
      .sort(),
  ).toEqual(['l1', 'l2'])
  expect(title()).toHaveTextContent('实习')
})

it('moves focus between lane rows with the arrow keys', async () => {
  const user = setup()
  row('考研').focus()
  await user.keyboard('{ArrowDown}')
  expect(row('实习')).toHaveFocus()
  await user.keyboard('{ArrowUp}')
  expect(row('考研')).toHaveFocus()
  await user.keyboard('{ArrowUp}')
  expect(row('考研')).toHaveFocus()
})

it('adds a lane, selects it and starts renaming it', async () => {
  const user = setup()
  await user.click(screen.getByRole('button', { name: '添加板块' }))
  const created = s().data.lanes.find((lane) => !['l1', 'l2'].includes(lane.id))!
  await waitFor(() => expect(window.location.hash).toBe(`#/modules/${created.id}`))
  expect(within(title()).getByRole('textbox', { name: '板块名称' })).toBeInTheDocument()
})

it('undoes a change made on this page with ctrl+z', async () => {
  const user = setup()
  act(() => s().updateLane('l1', { name: '改名了' }))
  expect(title()).toHaveTextContent('改名了')
  await user.keyboard('{Control>}z{/Control}')
  expect(title()).toHaveTextContent('考研')
})

it('does not move the selected timeline item with the arrow keys on this page', async () => {
  const user = setup()
  act(() => s().select({ kind: 'phase', id: 'p1' }))
  await user.keyboard('{ArrowRight}')
  expect(s().data.phases[0]!.start).toBe('2026-11-02')
})

it('slides one highlight behind the selected lane in the sidebar', async () => {
  const user = setup()
  const pill = () => sidebar().querySelector('[data-testid="lane-side-pill"]')
  expect(pill()).toHaveAttribute('data-lane-color', 'iris')
  expect(pill()).toHaveAttribute('aria-hidden', 'true')
  await user.click(row('实习'))
  await waitFor(() => expect(pill()).toHaveAttribute('data-lane-color', 'teal'))
  expect(sidebar().querySelectorAll('[data-testid="lane-side-pill"]')).toHaveLength(1)
})
