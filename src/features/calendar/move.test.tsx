import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { toDay } from '@/features/timeline/days'
import { resetViewport } from '@/features/timeline/useViewport'
import { resetCalendarState } from './lastLane'
import { monthWeeks } from './month'

const s = () => useStore.getState()

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
  ],
  phases: [
    // 11 月 9 日到 13 日，都在同一个周行里
    {
      id: 'p1',
      laneId: 'l1',
      name: '强化',
      start: '2026-11-09',
      end: '2026-11-14',
      tentative: false,
      note: '',
    },
    // 跨周：11 月 27 日到 12 月 1 日，第一段在 11 月 23 日起的周行，第二段在 11 月 30 日起的周行
    {
      id: 'p2',
      laneId: 'l2',
      name: '实习',
      start: '2026-11-27',
      end: '2026-12-02',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '面试', date: '2026-11-20', note: '' }],
}

const WEEKS = monthWeeks({ year: 2026, month: 11 }).flat()

function center(iso: string, dx = 0): { clientX: number; clientY: number } {
  const index = WEEKS.indexOf(toDay(iso))
  return { clientX: (index % 7) * 100 + 50 + dx, clientY: Math.floor(index / 7) * 100 + 50 }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/calendar'
  resetViewport()
  resetEditor()
  resetCalendarState()
  s().hydrate(data)
  render(<App />)
  vi.spyOn(screen.getByTestId('month-grid'), 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 700,
    height: 600,
    right: 700,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  })
})
afterEach(() => vi.useRealTimers())

const phase = (id: string) => s().data.phases.find((item) => item.id === id)!
const dates = (id: string) => [phase(id).start, phase(id).end]
const press = (element: Element, iso: string) =>
  fireEvent.pointerDown(element, { ...center(iso), button: 0, pointerId: 1 })
const move = (iso: string, dx = 0) =>
  fireEvent.pointerMove(window, { ...center(iso, dx), pointerId: 1 })
const release = (iso: string, dx = 0) =>
  fireEvent.pointerUp(window, { ...center(iso, dx), pointerId: 1 })

describe('moving a phase', () => {
  it('moves by the dragged days, keeps the length and is one undo step', async () => {
    const before = s().past.length
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-12')
    move('2026-11-14')
    release('2026-11-14')
    expect(dates('p1')).toEqual(['2026-11-12', '2026-11-17'])
    expect(s().past.length).toBe(before + 1)
    await userEvent.setup().keyboard('{Control>}z{/Control}')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-14'])
  })

  it('moves a week down in the same column', () => {
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-18')
    release('2026-11-18')
    expect(dates('p1')).toEqual(['2026-11-16', '2026-11-21'])
  })

  it('shows the new place while dragging without writing, then clears the preview', () => {
    const before = s().data
    const bar = screen.getByTestId('phase-p1')
    press(bar, '2026-11-11')
    move('2026-11-14')
    expect(s().data).toBe(before)
    expect(screen.getByTestId('phase-p1')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('11月12日'),
    )
    expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-dragging', 'true')
    release('2026-11-14')
    expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-dragging', 'false')
  })

  it('works from the second week row of a phase that crosses weeks', () => {
    const segment = document.querySelector('[data-segment="p2"]')!
    press(segment, '2026-12-01')
    move('2026-12-02')
    release('2026-12-02')
    expect(dates('p2')).toEqual(['2026-11-28', '2026-12-03'])
  })

  it('does not write when it is dropped where it started', () => {
    const before = s().past.length
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    fireEvent.pointerMove(window, { ...center('2026-11-11', 20), pointerId: 1 })
    release('2026-11-11', 20)
    expect(s().past.length).toBe(before)
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-14'])
  })
})

describe('resizing a phase', () => {
  it('drags the end handle so the hovered day is the last day', () => {
    press(screen.getByTestId('phase-p1-handle-end'), '2026-11-13')
    move('2026-11-16')
    release('2026-11-16')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-17'])
  })

  it('keeps at least one day when the end goes before the start', () => {
    press(screen.getByTestId('phase-p1-handle-end'), '2026-11-13')
    move('2026-11-05')
    release('2026-11-05')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-10'])
  })

  it('drags the start handle', () => {
    press(screen.getByTestId('phase-p1-handle-start'), '2026-11-09')
    move('2026-11-06')
    release('2026-11-06')
    expect(dates('p1')).toEqual(['2026-11-06', '2026-11-14'])
  })

  it('keeps at least one day when the start goes past the end', () => {
    press(screen.getByTestId('phase-p1-handle-start'), '2026-11-09')
    move('2026-11-20')
    release('2026-11-20')
    expect(dates('p1')).toEqual(['2026-11-13', '2026-11-14'])
  })

  it('puts handles only on the segments that hold the real start and end', () => {
    expect(screen.getByTestId('phase-p2-handle-start')).toBeInTheDocument()
    const lastSegment = document.querySelector('[data-segment="p2"]')!
    expect(lastSegment.querySelector('[data-handle="end"]')).not.toBeNull()
    expect(lastSegment.querySelector('[data-handle="start"]')).toBeNull()
  })
})

describe('moving a milestone', () => {
  it('moves to the dropped day in one undo step', () => {
    const before = s().past.length
    press(screen.getByTestId('milestone-m1'), '2026-11-20')
    move('2026-11-24')
    release('2026-11-24')
    expect(s().data.milestones[0]!.date).toBe('2026-11-24')
    expect(s().past.length).toBe(before + 1)
  })
})

describe('clicks and cancelling', () => {
  it('treats under 4px as a click: selects and opens the editor, data unchanged', async () => {
    const before = s().data
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    fireEvent.pointerMove(window, { ...center('2026-11-11', 3), pointerId: 1 })
    release('2026-11-11', 3)
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
    expect(s().data).toBe(before)
  })

  it('cancels with Escape', () => {
    const before = s().past.length
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-14')
    fireEvent.keyDown(window, { key: 'Escape' })
    release('2026-11-14')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-14'])
    expect(s().past.length).toBe(before)
    expect(screen.getByTestId('phase-p1')).toHaveAttribute('data-dragging', 'false')
  })

  it('cancels when released outside the grid', () => {
    const before = s().past.length
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-14')
    fireEvent.pointerUp(window, { clientX: 760, clientY: 250, pointerId: 1 })
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-14'])
    expect(s().past.length).toBe(before)
  })

  it('cancels quietly when the item disappears in the middle of a drag', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-14')
    act(() => s().removePhase('p1'))
    release('2026-11-14')
    expect(s().data.phases.map((item) => item.id)).toEqual(['p2'])
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('leaves no listeners behind: another bar still opens its editor on click', async () => {
    press(screen.getByTestId('phase-p1'), '2026-11-11')
    move('2026-11-14')
    release('2026-11-14')
    await userEvent.setup().click(screen.getByTestId('phase-p2'))
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'phase', id: 'p2' })
  })
})
