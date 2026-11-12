import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createSampleData } from '@/data/sample'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { laneHref } from '@/features/lane/select'
import { resetViewport } from '@/features/timeline/useViewport'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = ''
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup() {
  s().hydrate(createSampleData('2026-11-10'))
  render(<App />)
  return userEvent.setup()
}

it('shows today, the active count and the next milestone', () => {
  setup()
  const strip = screen.getByTestId('now-strip')
  expect(strip).toHaveTextContent('11月10日 周二')
  // 示例数据里两个板块有进行中的阶段（实习还没开始）
  expect(within(strip).getByText('2')).toBeInTheDocument()
  expect(strip).toHaveTextContent('模拟测试')
  expect(strip).toHaveTextContent('示例考试 A')
})

it('shows one overview card per lane with the current phase and progress', () => {
  setup()
  const exam = screen.getByTestId('overview-sample-lane-exam')
  expect(within(exam).getByText('强化阶段')).toBeInTheDocument()
  expect(within(exam).getByRole('progressbar', { name: '强化阶段进度' })).toBeInTheDocument()
  expect(within(exam).getByText(/下一阶段/)).toHaveTextContent('下一阶段')
  expect(exam).toHaveTextContent('冲刺阶段')

  const intern = screen.getByTestId('overview-sample-lane-intern')
  expect(within(intern).getByText('暂无进行中阶段')).toBeInTheDocument()
  expect(intern).toHaveTextContent('实习（时间待定）')
  expect(within(intern).queryByRole('progressbar')).not.toBeInTheDocument()
})

it('embeds a read-only timeline in the card', () => {
  setup()
  expect(screen.getByTestId('timeline')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '添加板块' })).not.toBeInTheDocument()
  expect(screen.queryByTestId('phase-sample-phase-1-handle-end')).not.toBeInTheDocument()
  // 色块不再是可聚焦的按钮
  expect(screen.queryByRole('button', { name: /^基础阶段/ })).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: /^基础阶段/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '添加' })).not.toBeInTheDocument()
})

it('does not open an editor or change data when a block is clicked in the card', async () => {
  const user = setup()
  const before = s().data
  await user.click(screen.getByRole('img', { name: /^强化阶段/ }))
  await user.click(screen.getByRole('img', { name: /^模拟测试/ }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(s().data).toBe(before)
  expect(s().selection).toBeNull()
})

it('expands to the full editable timeline and back', async () => {
  const user = setup()
  await user.click(screen.getByRole('link', { name: '展开' }))
  expect(window.location.hash).toBe('#/timeline')
  // 展开后是完整的编辑视图，“全局”仍然高亮
  expect(await screen.findByRole('button', { name: '添加板块' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '全局' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByTestId('now-strip')).not.toBeInTheDocument()

  await user.click(screen.getByRole('link', { name: '全局' }))
  expect(await screen.findByTestId('now-strip')).toBeInTheDocument()
})

it('plays the expand and collapse transitions between home and the full timeline', async () => {
  const kinds: (string | undefined)[] = []
  document.startViewTransition = ((callback?: () => void) => {
    kinds.push(document.documentElement.dataset.vt)
    callback?.()
    return { ready: Promise.resolve(), finished: Promise.resolve() } as unknown as ViewTransition
  }) as Document['startViewTransition']
  try {
    const user = setup()
    await user.click(screen.getByRole('link', { name: '展开' }))
    expect(await screen.findByRole('button', { name: '添加板块' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: '全局' }))
    expect(await screen.findByTestId('now-strip')).toBeInTheDocument()
    expect(kinds).toEqual(['expand', 'collapse'])
  } finally {
    delete (document as Partial<Document>).startViewTransition
    delete document.documentElement.dataset.vt
    delete document.documentElement.dataset.timelineEnter
  }
})

it('shows the empty state instead of the dashboard when there are no lanes', () => {
  s().hydrate(createEmptyData())
  render(<App />)
  expect(screen.getByText('开始规划你的时间线')).toBeInTheDocument()
  expect(screen.queryByTestId('now-strip')).not.toBeInTheDocument()
})

it('hides the next milestone when there is no upcoming one', () => {
  const data = createSampleData('2026-11-10')
  s().hydrate({ ...data, milestones: [] })
  render(<App />)
  const strip = screen.getByTestId('now-strip')
  expect(strip).not.toHaveTextContent('下一个节点')
  expect(strip).not.toHaveTextContent('暂无即将到来的节点')
})

it('hides the active count when no phase is in progress', () => {
  const data = createSampleData('2026-11-10')
  s().hydrate({ ...data, phases: [] })
  render(<App />)
  const strip = screen.getByTestId('now-strip')
  expect(strip).not.toHaveTextContent('个阶段进行中')
  expect(strip).not.toHaveTextContent('没有进行中的阶段')
})

it('turns each overview card into a link to its lane page', async () => {
  const user = setup()
  const card = screen.getByTestId('overview-sample-lane-course')
  expect(card.tagName).toBe('A')
  expect(card).toHaveAttribute('href', laneHref('sample-lane-course'))

  await user.click(card)
  expect(window.location.hash).toBe('#/modules/sample-lane-course')
  expect(await screen.findByRole('heading', { level: 1, name: '示例课程' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '板块' })).toHaveAttribute('aria-current', 'page')
})

describe('lanes with nothing planned and parallel phases', () => {
  const lane = (id: string, name: string, order: number) => ({
    id,
    name,
    color: 'iris' as const,
    order,
    note: '',
    links: [],
  })
  const phase = (id: string, laneId: string, start: string, end: string) => ({
    id,
    laneId,
    name: id,
    start,
    end,
    tentative: false,
    done: false,
    note: '',
  })
  const data = () => ({
    ...createEmptyData(),
    lanes: [lane('busy', '备考', 0), lane('idle-a', '健身', 1), lane('idle-b', '日语', 2)],
    phases: [
      phase('复习', 'busy', '2026-11-02', '2026-11-30'),
      phase('刷题', 'busy', '2026-11-09', '2026-11-23'),
    ],
  })

  it('collapses lanes with nothing planned into a row of links', () => {
    s().hydrate(data())
    render(<App />)
    expect(screen.getByTestId('overview-busy')).toBeInTheDocument()
    expect(screen.queryByTestId('overview-idle-a')).not.toBeInTheDocument()
    const row = screen.getByTestId('idle-lanes')
    expect(row).toHaveTextContent('还没有安排')
    expect(within(row).getByRole('link', { name: '健身' })).toHaveAttribute(
      'href',
      laneHref('idle-a'),
    )
    expect(within(row).getByRole('link', { name: '日语' })).toBeInTheDocument()
  })

  it('shows phases running in parallel and counts them all', () => {
    s().hydrate(data())
    render(<App />)
    expect(screen.getByTestId('overview-busy')).toHaveTextContent('还有「刷题」同时进行')
    expect(within(screen.getByTestId('now-strip')).getByText('2')).toBeInTheDocument()
  })

  it('has no idle row when every lane has something planned', () => {
    setup()
    expect(screen.queryByTestId('idle-lanes')).not.toBeInTheDocument()
  })
})
