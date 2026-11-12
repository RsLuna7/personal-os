import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { UI_KEY } from '@/data/persistence'
import { createEmptyData, type AppData, type Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from './days'
import { dayToX, type Scale } from './scale'
import { refit, resetViewport, useViewportStore } from './useViewport'

const SCALE: Scale = { originDay: toDay('2026-11-02'), pxPerDay: 2 }

const lane: Lane = { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }
const phase = {
  id: 'p1',
  laneId: 'l1',
  name: '基础',
  start: '2026-11-09',
  end: '2026-12-07',
  tentative: false,
  done: false,
  note: '',
}
const withData = (patch: Partial<AppData>): AppData => ({
  ...createEmptyData(),
  lanes: [lane],
  ...patch,
})

function setup(data: AppData = createEmptyData(), scale: Scale = SCALE) {
  useStore.getState().hydrate(data)
  render(<App />)
  act(() => useViewportStore.setState({ scale, width: 1000 }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/timeline'
  resetViewport()
})
afterEach(() => vi.useRealTimers())

it('shows the empty state with two actions when there is no data', () => {
  setup()
  expect(screen.getByText('开始规划你的时间线')).toBeInTheDocument()
  expect(screen.getByText('添加板块和阶段，一眼看清现在处在哪里。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '从空白开始' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '载入示例' })).toBeInTheDocument()
})

it('loads the sample from the empty state', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: '载入示例' }))
  expect(useStore.getState().data.lanes.length).toBeGreaterThanOrEqual(3)
  expect(screen.queryByText('开始规划你的时间线')).not.toBeInTheDocument()
})

it('starts with one empty lane from the empty state', async () => {
  setup()
  await userEvent.click(screen.getByRole('button', { name: '从空白开始' }))
  expect(useStore.getState().data.lanes).toHaveLength(1)
  expect(screen.getByText('新板块')).toBeInTheDocument()
})

it('renders lanes in order with their names', () => {
  setup(
    withData({
      lanes: [
        { id: 'l2', name: '四级', color: 'teal', order: 1, note: '', links: [] },
        { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
      ],
    }),
  )
  const lanes = screen.getAllByTestId(/^lane-l\d$/)
  expect(lanes.map((el) => el.dataset.testid)).toEqual(['lane-l1', 'lane-l2'])
  expect(within(lanes[0]).getByText('考研')).toBeInTheDocument()
  expect(lanes[1]).toHaveAttribute('data-lane-color', 'teal')
})

it('adds a lane from the last row', async () => {
  setup(withData({}))
  await userEvent.click(screen.getByRole('button', { name: '添加板块' }))
  expect(useStore.getState().data.lanes).toHaveLength(2)
})

it('positions a phase from its dates', () => {
  setup(withData({ phases: [phase] }))
  const el = screen.getByTestId('phase-p1')
  expect(el.style.transform).toBe('translateX(14px)')
  expect(el.style.width).toBe('56px')
  expect(el).toHaveAttribute('role', 'button')
  expect(el).toHaveAttribute('tabindex', '0')
})

it('marks finished phases as past and others not', () => {
  setup(
    withData({
      phases: [
        { ...phase, id: 'done', start: '2026-10-05', end: '2026-11-10' },
        { ...phase, id: 'now', start: '2026-10-05', end: '2026-11-11' },
      ],
    }),
  )
  expect(screen.getByTestId('phase-done')).toHaveAttribute('data-past', 'true')
  expect(screen.getByTestId('phase-now')).toHaveAttribute('data-past', 'false')
})

it('marks tentative phases', () => {
  setup(
    withData({
      phases: [
        phase,
        { ...phase, id: 'p2', start: '2027-01-04', end: '2027-02-01', tentative: true },
      ],
    }),
  )
  expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-tentative', 'false')
  expect(screen.getByTestId('phase-p2')).toHaveAttribute('data-tentative', 'true')
})

it('stacks overlapping phases and grows the lane', () => {
  setup(
    withData({ phases: [phase, { ...phase, id: 'p2', start: '2026-11-23', end: '2026-12-21' }] }),
  )
  expect(screen.getByTestId('phase-p1').style.top).toBe('12px')
  expect(screen.getByTestId('phase-p2').style.top).toBe('52px')
  expect(screen.getByTestId('lane-l1').style.height).toBe('96px')
})

it('gives a lane with milestones a strip above its phases', () => {
  setup(
    withData({
      phases: [phase],
      milestones: [
        { id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', done: false, note: '' },
      ],
    }),
  )
  expect(screen.getByTestId('lane-l1').style.height).toBe('76px')
  expect(screen.getByTestId('phase-p1').style.top).toBe('32px')
  const dot = screen.getByTestId('milestone-m1')
  expect(dot.style.transform).toBe(`translateX(${dayToX(SCALE, toDay('2026-12-19'))}px)`)
  expect(dot).toHaveAttribute('role', 'button')
  expect(within(dot).getByText('初试')).toBeInTheDocument()
})

it('keeps a lane without milestones at 56px', () => {
  setup(withData({ phases: [phase] }))
  expect(screen.getByTestId('lane-l1').style.height).toBe('56px')
})

it('draws the today line at today', () => {
  setup(withData({}))
  expect(screen.getByTestId('today-line').style.transform).toBe(
    `translateX(${dayToX(SCALE, toDay('2026-11-10'))}px)`,
  )
})

it('hides the label of a phase narrower than 24px but keeps it in the tooltip', async () => {
  setup(withData({ phases: [{ ...phase, end: '2026-11-16' }] }), { ...SCALE, pxPerDay: 1 })
  const el = screen.getByTestId('phase-p1')
  expect(el.style.width).toBe('7px')
  expect(within(el).queryByText('基础')).not.toBeInTheDocument()
  await userEvent.hover(el)
  expect(await screen.findByRole('tooltip')).toHaveTextContent('基础')
})

it('shows dates and length in the phase tooltip', async () => {
  setup(withData({ phases: [phase] }))
  await userEvent.hover(screen.getByTestId('phase-p1'))
  const tip = await screen.findByRole('tooltip')
  expect(tip).toHaveTextContent('11月9日')
  expect(tip).toHaveTextContent('12月6日')
  expect(tip).toHaveTextContent('2026')
  expect(tip).toHaveTextContent('共 4 周')
})

it('truncates long names with an ellipsis', () => {
  const name = '一个非常非常非常非常非常非常长的阶段名称'
  // 足够宽的阶段才会显示被截断的名称
  setup(withData({ phases: [{ ...phase, name, end: '2027-06-07' }] }))
  const label = within(screen.getByTestId('phase-p1')).getByText(name)
  expect(label).toHaveClass('truncate')
  expect(label).toHaveAttribute('title', name)
})

it('hides the name of a block too narrow to read, but keeps it for assistive tech', () => {
  const name = '期末复习'
  // 3 周 × 2 像素 = 42 像素，放不下四个字，也不值得只显示“期…”
  setup(withData({ phases: [{ ...phase, name, end: '2026-11-30' }] }))
  const block = screen.getByTestId('phase-p1')
  expect(within(block).queryByText(name)).not.toBeInTheDocument()
  expect(block).toHaveAttribute('aria-label', expect.stringContaining(name))
})

it('shows a short name when it fits entirely', () => {
  setup(withData({ phases: [phase] }))
  expect(within(screen.getByTestId('phase-p1')).getByText('基础')).toBeInTheDocument()
})

it('shows term segments when terms exist and none otherwise', () => {
  setup(withData({}))
  expect(screen.queryByTestId(/^term-/)).not.toBeInTheDocument()
  act(() =>
    useStore
      .getState()
      .setTerms([{ id: 't1', name: '大三上', start: '2026-09-07', end: '2027-01-18' }]),
  )
  expect(screen.getByTestId('term-t1')).toHaveTextContent('大三上')
})

it('shows month ticks only at 1.5 px per day or more', () => {
  setup(withData({}))
  expect(screen.getByTestId('month-tick-2026-12')).toHaveTextContent('12月')
  expect(screen.getByTestId('year-tick-2027')).toHaveTextContent('2027')
  act(() => useViewportStore.setState({ scale: { ...SCALE, pxPerDay: 1.4 } }))
  expect(screen.queryByTestId(/^month-tick-/)).not.toBeInTheDocument()
  expect(screen.getByTestId('year-tick-2027')).toBeInTheDocument()
})

it.each([
  ['2026-12-19', '还有 39 天'],
  ['2026-11-01', '已过 9 天'],
  ['2026-11-10', '就是今天'],
])('shows countdown text for a milestone on %s on hover', async (date, text) => {
  setup(
    withData({
      milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date, done: false, note: '' }],
    }),
  )
  await userEvent.hover(screen.getByTestId('milestone-m1'))
  expect(await screen.findByRole('tooltip')).toHaveTextContent(text)
})

it('switches zoom presets and remembers the choice', async () => {
  setup(withData({ phases: [phase] }))
  expect(screen.getByRole('button', { name: '一年' })).toHaveAttribute('aria-pressed', 'true')
  await userEvent.click(screen.getByRole('button', { name: '近三个月' }))
  expect(screen.getByRole('button', { name: '近三个月' })).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse(localStorage.getItem(UI_KEY)!).zoomPreset).toBe('quarter')
  expect(useViewportStore.getState().scale.pxPerDay).toBe(1000 / 92)
  // 和“回到今天”一样，今天在左起四分之一处
  expect(screen.getByTestId('today-line').style.transform).toBe('translateX(250px)')
})

it('puts today a quarter of the way across on 回到今天', async () => {
  setup(withData({}))
  await userEvent.click(screen.getByRole('button', { name: '回到今天' }))
  expect(screen.getByTestId('today-line').style.transform).toBe('translateX(250px)')
})

it('hides the zoom controls on other views', async () => {
  setup(withData({}))
  await userEvent.click(screen.getByRole('link', { name: '日历' }))
  expect(screen.queryByRole('button', { name: '回到今天' })).not.toBeInTheDocument()
})

it('moves the today line after midnight', () => {
  vi.useRealTimers()
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 10, 23, 59, 30))
  setup(withData({}))
  const x = (date: string) => `translateX(${dayToX(SCALE, toDay(date))}px)`
  expect(screen.getByTestId('today-line').style.transform).toBe(x('2026-11-10'))
  act(() => {
    vi.advanceTimersByTime(60_000)
  })
  expect(screen.getByTestId('today-line').style.transform).toBe(x('2026-11-11'))
})

describe('weeks', () => {
  const term = { id: 't1', name: '秋季学期', start: '2026-09-07', end: '2027-01-18' }

  it('labels weeks by term week inside a term and by date outside', () => {
    setup(withData({ phases: [phase], terms: [term] }), {
      originDay: toDay('2027-01-04'),
      pxPerDay: 10,
    })
    expect(screen.getByTestId(`week-tick-${toDay('2027-01-11')}`)).toHaveTextContent('第19周')
    expect(screen.getByTestId(`week-tick-${toDay('2027-01-18')}`)).toHaveTextContent('18')
  })

  it('hides week labels when a week is too narrow, but keeps week lines down to about 17px', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2026-11-02'), pxPerDay: 3 })
    expect(screen.queryByTestId(/^week-tick-/)).not.toBeInTheDocument()
    expect(screen.getAllByTestId('week-line').length).toBeGreaterThan(0)
  })

  it('drops week lines when zoomed out to a whole year or more', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2026-11-02'), pxPerDay: 2 })
    expect(screen.queryByTestId('week-line')).not.toBeInTheDocument()
  })
})

describe('names of short phases', () => {
  const short = { ...phase, id: 'p2', name: '模拟测试', start: '2026-11-09', end: '2026-11-16' }

  it('writes the name beside a block too narrow to hold it', () => {
    setup(withData({ phases: [short] }), { originDay: toDay('2026-11-02'), pxPerDay: 3 })
    expect(screen.getByTestId('phase-p2-outside-label')).toHaveTextContent('模拟测试')
  })

  it('leaves the name out when the next phase in the row is too close', () => {
    const next = { ...phase, id: 'p3', name: '下一段', start: '2026-11-16', end: '2026-12-14' }
    setup(withData({ phases: [short, next] }), { originDay: toDay('2026-11-02'), pxPerDay: 3 })
    expect(screen.queryByTestId('phase-p2-outside-label')).not.toBeInTheDocument()
  })

  it('keeps the name inside when the block is wide enough', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2026-11-02'), pxPerDay: 3 })
    expect(screen.queryByTestId('phase-p1-outside-label')).not.toBeInTheDocument()
  })
})

it('refits a year preset to a new width so it still shows a year', () => {
  setup(withData({ phases: [phase] }))
  act(() => useViewportStore.setState({ preset: 'year', fitWidth: 1000 }))
  act(() => refit(600))
  expect(useViewportStore.getState().scale.pxPerDay).toBeCloseTo(600 / 365)
  expect(useViewportStore.getState().fitWidth).toBe(600)
})

it('leaves a custom zoom alone when the width changes', () => {
  setup(withData({ phases: [phase] }))
  act(() => useViewportStore.setState({ preset: 'custom' }))
  const before = useViewportStore.getState().scale
  act(() => refit(600))
  expect(useViewportStore.getState().scale).toBe(before)
})

it('refits a preset when the timeline mounts at a different width', () => {
  // 主页卡片和完整时间线宽度不同：挂载时量到的新宽度要按档位重新适配，仍然是一年
  useStore.getState().hydrate(withData({ phases: [phase] }))
  useViewportStore.setState({
    ready: true,
    preset: 'year',
    fitWidth: 1000,
    width: 1000,
    scale: { originDay: toDay('2026-11-10') - 250 / (1000 / 365), pxPerDay: 1000 / 365 },
  })
  const spy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.dataset.testid === 'timeline' ? 712 : 0
  })
  try {
    render(<App />)
    const { scale, width } = useViewportStore.getState()
    expect(width).toBe(600)
    expect(scale.pxPerDay).toBeCloseTo(600 / 365)
    // 今天仍在左起四分之一处
    expect(dayToX(scale, toDay('2026-11-10'))).toBeCloseTo(150)
  } finally {
    spy.mockRestore()
  }
})

describe('left edge of the ruler', () => {
  it('shows one year label when the new year has just scrolled off the left', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2027-01-04'), pxPerDay: 9 })
    expect(screen.getByTestId('leading-year')).toHaveTextContent('2027')
    expect(screen.queryByTestId('year-tick-2027')).not.toBeInTheDocument()
    expect(screen.getByTestId('leading-month')).toHaveTextContent('1月')
    expect(screen.queryByTestId('month-tick-2027-01')).not.toBeInTheDocument()
  })

  it('lets a new year sitting at the left edge take the place of the leading label', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2026-12-30'), pxPerDay: 9 })
    expect(screen.queryByTestId('leading-year')).not.toBeInTheDocument()
    expect(screen.getByTestId('year-tick-2027')).toBeInTheDocument()
  })

  it('keeps a leading week label at the left edge', () => {
    setup(withData({ phases: [phase] }), { originDay: toDay('2026-11-03'), pxPerDay: 10 })
    expect(screen.getByTestId('leading-week')).toHaveTextContent('2')
    expect(screen.queryByTestId(`week-tick-${toDay('2026-11-02')}`)).not.toBeInTheDocument()
  })
})
