import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { getLastLaneId, pickLaneId, resetCalendarState, setLastLaneId } from './lastLane'

const s = () => useStore.getState()

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
  ],
  phases: [
    // 跨周：11 月 4 日到 11 月 11 日（含）
    {
      id: 'p1',
      laneId: 'l1',
      name: '强化',
      start: '2026-11-04',
      end: '2026-11-12',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l2', name: '面试', date: '2026-11-20', note: '' }],
  terms: [{ id: 't1', name: '秋季学期', start: '2026-09-01', end: '2027-01-15' }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/calendar'
  resetViewport()
  resetEditor()
  resetCalendarState()
})
afterEach(() => vi.useRealTimers())

function setup(hash = '#/calendar', initial: AppData = data) {
  window.location.hash = hash
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const grid = () => screen.getByTestId('month-grid')
const dayCells = () => within(grid()).getAllByTestId(/^day-/)
const heading = () => screen.getByRole('heading', { level: 1 })

describe('month and header', () => {
  it('shows November 2026 with a Monday-first header and six weeks', () => {
    setup()
    expect(heading()).toHaveTextContent('2026年11月')
    expect(screen.getByTestId('weekdays').textContent).toBe('一二三四五六日')
    expect(dayCells()).toHaveLength(42)
    expect(screen.getByTestId('day-2026-11-10')).toHaveAttribute('data-today', 'true')
    expect(screen.getByTestId('day-2026-11-09')).toHaveAttribute('data-today', 'false')
    expect(screen.getByTestId('day-2026-10-26')).toHaveAttribute('data-outside', 'true')
    expect(screen.getByTestId('day-2026-11-01')).toHaveAttribute('data-outside', 'false')
  })

  it('shows four weeks for February 2027', () => {
    setup('#/calendar/2027-02')
    expect(heading()).toHaveTextContent('2027年2月')
    expect(dayCells()).toHaveLength(28)
  })

  it.each(['#/calendar/2026-13', '#/calendar/x'])('falls back to this month for %s', (hash) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(hash)
    expect(heading()).toHaveTextContent('2026年11月')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('links to the neighbouring months and back to today', async () => {
    const user = setup('#/calendar/2027-02')
    expect(screen.getByRole('link', { name: '上个月' })).toHaveAttribute(
      'href',
      '#/calendar/2027-01',
    )
    expect(screen.getByRole('link', { name: '下个月' })).toHaveAttribute(
      'href',
      '#/calendar/2027-03',
    )
    expect(screen.getByRole('link', { name: '今天' })).toHaveAttribute('href', '#/calendar')
    await user.click(screen.getByRole('link', { name: '下个月' }))
    expect(window.location.hash).toBe('#/calendar/2027-03')
    expect(heading()).toHaveTextContent('2027年3月')
    await user.click(screen.getByRole('link', { name: '今天' }))
    expect(heading()).toHaveTextContent('2026年11月')
  })

  it('moves forward one month from the current month', async () => {
    const user = setup()
    await user.click(screen.getByRole('link', { name: '下个月' }))
    expect(window.location.hash).toBe('#/calendar/2026-12')
  })

  it('disables the previous arrow in January 1900', () => {
    setup('#/calendar/1900-01')
    expect(screen.getByRole('button', { name: '上个月' })).toBeDisabled()
    expect(screen.getByRole('link', { name: '下个月' })).toBeInTheDocument()
  })

  it('disables the next arrow in December 2100', () => {
    setup('#/calendar/2100-12')
    expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled()
  })

  it('highlights the calendar item in the top bar', () => {
    setup()
    expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('items on the grid', () => {
  it('draws a phase that crosses a week as one segment per week, named once', () => {
    setup()
    expect(screen.getAllByTestId('phase-p1')).toHaveLength(1)
    expect(document.querySelectorAll('[data-segment="p1"]')).toHaveLength(1)
    const named = screen.getByTestId('phase-p1')
    expect(named).toHaveTextContent('强化')
    expect(named).toHaveAttribute('data-lane-color', 'iris')
    expect(named).toHaveAttribute('aria-label', expect.stringContaining('强化'))
    expect(named).toHaveAttribute('aria-label', expect.stringContaining('11月4日'))
  })

  it('draws milestones as dots and the term as a band per week', () => {
    setup()
    const dot = screen.getByTestId('milestone-m1')
    expect(dot).toHaveAttribute('data-lane-color', 'teal')
    expect(dot).toHaveAttribute('aria-label', expect.stringContaining('面试'))
    expect(screen.getByTestId('term-t1-0')).toHaveTextContent('秋季学期')
    expect(screen.getByTestId('term-t1-5')).not.toHaveTextContent('秋季学期')
  })

  it('shows the empty state without lanes', () => {
    setup('#/calendar', createEmptyData())
    expect(screen.getByText('开始规划你的时间线')).toBeInTheDocument()
    expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument()
  })
})

describe('editing from the calendar', () => {
  it('opens and selects the phase editor when a bar is clicked', async () => {
    const user = setup()
    await user.click(screen.getByTestId('phase-p1'))
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
  })

  it('opens the milestone editor when a dot is clicked', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
  })

  it('keeps the editor open when the edited phase moves to another week', async () => {
    const user = setup()
    await user.click(screen.getByTestId('phase-p1'))
    await screen.findByRole('dialog', { name: '编辑阶段' })
    act(() => s().updatePhase('p1', { start: '2026-12-01', end: '2026-12-03' }))
    expect(screen.getByTestId('phase-p1')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
  })

  it('remembers the lane of the item last edited', async () => {
    const user = setup()
    expect(getLastLaneId()).toBeNull()
    await user.click(screen.getByTestId('phase-p1'))
    await screen.findByRole('dialog', { name: '编辑阶段' })
    expect(getLastLaneId()).toBe('l1')
    act(() => s().updatePhase('p1', { laneId: 'l2' }))
    expect(getLastLaneId()).toBe('l2')
    expect(pickLaneId(s().data.lanes)).toBe('l2')
  })

  it('undoes a change made on this page with Ctrl+Z', async () => {
    const user = setup()
    act(() => s().updatePhase('p1', { name: '改了' }))
    expect(screen.getByTestId('phase-p1')).toHaveTextContent('改了')
    await user.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('phase-p1')).toHaveTextContent('强化')
  })
})

describe('pickLaneId', () => {
  const lanes = data.lanes

  it('falls back to the lane with the smallest order, or null without lanes', () => {
    expect(pickLaneId([...lanes].reverse())).toBe('l1')
    expect(pickLaneId([])).toBeNull()
  })

  it('uses the remembered lane while it exists and ignores it once it is gone', () => {
    setLastLaneId('l2')
    expect(pickLaneId(lanes)).toBe('l2')
    setLastLaneId('gone')
    expect(pickLaneId(lanes)).toBe('l1')
  })
})

describe('overflow list', () => {
  const crowded = (milestones: AppData['milestones'] = []): AppData => ({
    ...createEmptyData(),
    lanes: data.lanes,
    phases: ['a', 'b', 'c', 'd'].map((id, index) => ({
      id,
      laneId: index < 2 ? 'l1' : 'l2',
      name: `阶段${id}`,
      start: '2026-11-09',
      end: '2026-11-12',
      tentative: false,
      note: '',
    })),
    milestones,
  })

  it('shows +N for a crowded day and lists every item of that day in lane order', async () => {
    const user = setup('#/calendar', crowded())
    const cell = screen.getByTestId('day-2026-11-09')
    await user.click(within(cell).getByRole('button', { name: '+2 项' }))
    const list = await screen.findByRole('dialog', { name: '11月9日的项目' })
    const names = within(list)
      .getAllByRole('button')
      .map((button) => button.textContent)
    expect(names).toEqual(['阶段a', '阶段b', '阶段c', '阶段d'])
  })

  it('puts milestones after the phases of their lane', async () => {
    const user = setup(
      '#/calendar',
      crowded([{ id: 'mm', laneId: 'l1', name: '节点mm', date: '2026-11-09', note: '' }]),
    )
    const cell = screen.getByTestId('day-2026-11-09')
    await user.click(within(cell).getByRole('button', { name: /^\+\d 项$/ }))
    const list = await screen.findByRole('dialog', { name: '11月9日的项目' })
    expect(
      within(list)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['阶段a', '阶段b', '节点mm', '阶段c', '阶段d'])
  })

  it('opens the editor for an item that is hidden on the grid', async () => {
    const user = setup('#/calendar', crowded())
    expect(screen.queryByTestId('phase-d')).not.toBeInTheDocument()
    await user.click(
      within(screen.getByTestId('day-2026-11-09')).getByRole('button', { name: '+2 项' }),
    )
    const list = await screen.findByRole('dialog', { name: '11月9日的项目' })
    await user.click(within(list).getByRole('button', { name: '阶段d' }))
    expect(screen.queryByRole('dialog', { name: '11月9日的项目' })).not.toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'phase', id: 'd' })
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
  })

  it('closes with Escape and changes nothing', async () => {
    const user = setup('#/calendar', crowded())
    const before = s().data
    await user.click(
      within(screen.getByTestId('day-2026-11-09')).getByRole('button', { name: '+2 项' }),
    )
    await screen.findByRole('dialog', { name: '11月9日的项目' })
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '11月9日的项目' })).not.toBeInTheDocument()
    expect(s().selection).toBeNull()
    expect(s().data).toBe(before)
  })

  it('has no +N button on a day with room', () => {
    setup()
    expect(screen.queryByRole('button', { name: /^\+\d+ 项$/ })).not.toBeInTheDocument()
  })
})

describe('the editor and its item', () => {
  it('follows the item to its new month when the date leaves the visible month', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    await screen.findByRole('dialog', { name: '编辑节点' })

    act(() => s().updateMilestone('m1', { date: '2026-12-15' }))

    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-12'))
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
    expect(screen.getByTestId('milestone-m1')).toBeInTheDocument()
  })

  it('closes the panel when leaving the page so it does not reappear elsewhere', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    await screen.findByRole('dialog', { name: '编辑节点' })

    window.location.hash = '#/timeline'
    await waitFor(() => expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument())
    expect(useEditorStore.getState().editing).toBeNull()
  })
})
