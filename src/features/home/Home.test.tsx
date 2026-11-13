import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { LINGER_MS } from './TodoBoard'
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

  it('leaves lanes with nothing planned out of the home timeline, but not the full one', async () => {
    s().hydrate(data())
    render(<App />)
    const card = screen.getByTestId('timeline')
    expect(within(card).getByTestId('lane-busy')).toBeInTheDocument()
    expect(within(card).queryByTestId('lane-idle-a')).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('link', { name: '展开' }))
    expect(await screen.findByTestId('lane-idle-a')).toBeInTheDocument()
  })

  it('says so in the home timeline when no lane has anything planned', () => {
    s().hydrate({ ...data(), phases: [] })
    render(<App />)
    expect(screen.getByTestId('no-planned-lanes')).toBeInTheDocument()
  })

  it('has no idle row when every lane has something planned', () => {
    setup()
    expect(screen.queryByTestId('idle-lanes')).not.toBeInTheDocument()
  })
})

describe('to-do board', () => {
  it('lists overdue and today’s to-dos and ticks them off in place', async () => {
    const user = setup()
    const board = screen.getByTestId('todo-board')
    // 示例数据以 11-10 为今天，今天有待办（见 beforeEach 里的系统时间）
    expect(board).toHaveTextContent('今天')
    const first = within(board).getAllByRole('checkbox')[0]
    const id = first.closest('li')!.dataset.testid!.replace('home-todo-', '')
    await user.click(first)
    expect(s().data.todos.find((item) => item.id === id)?.done).toBe(true)
  })

  it('is hidden when there is nothing overdue and nothing today', () => {
    s().hydrate({ ...createSampleData('2026-11-10'), todos: [] })
    render(<App />)
    expect(screen.queryByTestId('todo-board')).not.toBeInTheDocument()
  })

  it('links to the today page and says how many are not shown', () => {
    const data = createSampleData('2026-11-10')
    const extra = Array.from({ length: 6 }, (_, i) => ({
      id: `x${i}`,
      title: `多出来的${i}`,
      date: '2026-11-10',
      done: false,
      laneId: null,
      createdAt: '2026-11-10T00:00:00Z',
    }))
    s().hydrate({ ...data, todos: [...data.todos, ...extra] })
    render(<App />)
    const board = screen.getByTestId('todo-board')
    expect(within(board).getAllByRole('checkbox')).toHaveLength(5)
    expect(within(board).getByRole('link', { name: /还有 \d+ 项 · 去今日/ })).toHaveAttribute(
      'href',
      '#/today',
    )
  })

  const board = (todos: { id: string; title: string; date: string; done?: boolean }[]) => {
    s().hydrate({
      ...createSampleData('2026-11-10'),
      todos: todos.map((item, i) => ({
        laneId: null,
        done: false,
        createdAt: `2026-11-01T00:00:0${i}Z`,
        ...item,
      })),
    })
    render(<App />)
    return screen.getByTestId('todo-board')
  }

  it('moves every overdue to-do to today in one undo step', async () => {
    const el = board([
      { id: 'a', title: '前天的', date: '2026-11-08' },
      { id: 'b', title: '昨天的', date: '2026-11-09' },
    ])
    const n = s().past.length
    await userEvent.setup().click(within(el).getByRole('button', { name: '全部移到今天' }))
    expect(s().data.todos.map((todo) => todo.date)).toEqual(['2026-11-10', '2026-11-10'])
    expect(s().past.length).toBe(n + 1)
    expect(within(el).queryByText(/^过期/)).not.toBeInTheDocument()
  })

  it('folds finished to-dos into a count that does not use up the five slots', async () => {
    const el = board([
      ...[1, 2, 3, 4, 5].map((i) => ({ id: `o${i}`, title: `待做${i}`, date: '2026-11-10' })),
      { id: 'd1', title: '做完了', date: '2026-11-10', done: true },
    ])
    expect(within(el).getAllByRole('checkbox')).toHaveLength(5)
    expect(within(el).queryByText('做完了')).not.toBeInTheDocument()
    const toggle = within(el).getByRole('button', { name: /已完成 1/ })
    await userEvent.setup().click(toggle)
    expect(within(el).getByText('做完了')).toBeInTheDocument()
  })

  it('leaves a ticked to-do in place for a moment before folding it away', () => {
    vi.useFakeTimers()
    try {
      const el = board([{ id: 'a', title: '交作业', date: '2026-11-10' }])
      fireEvent.click(within(el).getByRole('checkbox', { name: '完成「交作业」' }))
      expect(within(el).getByText('交作业')).toBeInTheDocument()
      expect(within(el).getByRole('checkbox', { name: '完成「交作业」' })).toHaveAttribute(
        'aria-checked',
        'true',
      )
      act(() => vi.advanceTimersByTime(LINGER_MS))
      expect(within(el).queryByRole('checkbox', { name: '完成「交作业」' })).not.toBeInTheDocument()
      expect(within(el).getByRole('button', { name: /已完成 1/ })).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('entrance motion', () => {
  afterEach(() => {
    delete document.documentElement.dataset.vt
  })

  it('plays the entrance when the home page opens normally', () => {
    setup()
    expect(screen.getByTestId('home')).toHaveAttribute('data-enter', 'true')
  })

  it('skips the entrance while the timeline collapses back into the card', () => {
    document.documentElement.dataset.vt = 'collapse'
    setup()
    expect(screen.getByTestId('home')).toHaveAttribute('data-enter', 'false')
  })

  it('marks the next milestone as soon when it is three days away or less', () => {
    setup()
    const strip = screen.getByTestId('now-strip')
    const cell = strip.querySelector('[data-soon]')
    expect(cell).not.toBeNull()
    // 示例数据里下一个节点“模拟测试”在 11 月 10 日之后不到三天
    expect(cell).toHaveAttribute('data-soon', String(cellDays(strip) <= 3))
  })
})

/** 从“N 天后 / 今天”读出天数 */
function cellDays(strip: HTMLElement): number {
  const text = strip.querySelector('[data-soon]')!.textContent ?? ''
  if (text.includes('今天')) return 0
  return Number(text.match(/(\d+)\s*天后/)![1])
}
