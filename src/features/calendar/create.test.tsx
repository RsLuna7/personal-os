import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
}

const WEEKS = monthWeeks({ year: 2026, month: 11 }).flat()

/** 网格被桩成 700 × 600：六周，每格 100 × 100。 */
function center(iso: string): { clientX: number; clientY: number } {
  const index = WEEKS.indexOf(toDay(iso))
  return { clientX: (index % 7) * 100 + 50, clientY: Math.floor(index / 7) * 100 + 50 }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  resetViewport()
  resetEditor()
  resetCalendarState()
})
afterEach(() => vi.useRealTimers())

function setup(initial: AppData = data) {
  window.location.hash = '#/calendar'
  s().hydrate(initial)
  const user = userEvent.setup()
  const view = render(<App />)
  const grid = screen.queryByTestId('month-grid')
  if (grid) {
    vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue({
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
  }
  return { user, view }
}

const cell = (iso: string) => screen.getByTestId(`day-${iso}`)
const press = (iso: string, extra = {}) =>
  fireEvent.pointerDown(cell(iso), { ...center(iso), button: 0, pointerId: 1, ...extra })
const move = (iso: string) => fireEvent.pointerMove(cell(iso), { ...center(iso), pointerId: 1 })
const release = (iso: string) => fireEvent.pointerUp(cell(iso), { ...center(iso), pointerId: 1 })

describe('creating a phase by dragging over days', () => {
  it('creates a phase for the dragged range in the first lane and opens the editor', async () => {
    setup()
    const before = s().past.length
    press('2026-11-12')
    move('2026-11-13')
    move('2026-11-15')
    release('2026-11-15')

    const [phase] = s().data.phases
    expect(s().data.phases).toHaveLength(1)
    expect(phase).toMatchObject({ laneId: 'l1', start: '2026-11-12', end: '2026-11-16' })
    expect(s().past.length).toBe(before + 1)
    expect(s().selection).toEqual({ kind: 'phase', id: phase!.id })
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
    const name = screen.getByDisplayValue('新阶段') as HTMLInputElement
    await waitFor(() => expect(name).toHaveFocus())
    expect([name.selectionStart, name.selectionEnd]).toEqual([0, 3])
    expect(s().data.milestones).toHaveLength(0)
  })

  it('undoes in one step', async () => {
    const { user } = setup()
    press('2026-11-12')
    move('2026-11-15')
    release('2026-11-15')
    await screen.findByRole('dialog', { name: '编辑阶段' })
    ;(document.activeElement as HTMLElement).blur()
    await user.keyboard('{Control>}z{/Control}')
    expect(s().data.phases).toEqual([])
  })

  it('gives the same range when dragging backwards', () => {
    setup()
    press('2026-11-15')
    move('2026-11-12')
    release('2026-11-12')
    expect(s().data.phases[0]).toMatchObject({ start: '2026-11-12', end: '2026-11-16' })
  })

  it('highlights exactly the covered days while dragging, without changing data', () => {
    setup()
    const before = s().data
    press('2026-11-12')
    move('2026-11-15')
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(4)
    expect(cell('2026-11-14')).toHaveAttribute('data-preview', 'true')
    expect(cell('2026-11-16')).not.toHaveAttribute('data-preview', 'true')
    expect(s().data).toBe(before)
    release('2026-11-15')
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(0)
  })

  it('stays within the grid: releasing outside cancels', () => {
    setup()
    const before = s().data
    press('2026-11-12')
    move('2026-11-15')
    fireEvent.pointerUp(cell('2026-11-15'), { clientX: 750, clientY: 250, pointerId: 1 })
    expect(s().data).toBe(before)
    expect(screen.queryByRole('dialog', { name: '编辑阶段' })).not.toBeInTheDocument()
  })

  it('cancels with Escape and cleans up so the next click still works', () => {
    setup()
    const before = s().data
    press('2026-11-12')
    move('2026-11-15')
    fireEvent.keyDown(window, { key: 'Escape' })
    release('2026-11-15')
    expect(s().data).toBe(before)
    expect(document.querySelectorAll('[data-preview="true"]')).toHaveLength(0)

    press('2026-11-12')
    release('2026-11-12')
    expect(s().data.milestones).toHaveLength(1)
  })

  it('does nothing when the page goes away in the middle of a drag', () => {
    const { view } = setup()
    const before = s().data
    press('2026-11-12')
    move('2026-11-15')
    view.unmount()
    fireEvent.pointerUp(window, { clientX: 650, clientY: 250, pointerId: 1 })
    expect(s().data).toBe(before)
  })
})

describe('creating a milestone by clicking a day', () => {
  it('adds one milestone on that day and opens the editor', async () => {
    setup()
    press('2026-11-12')
    release('2026-11-12')
    expect(s().data.milestones).toHaveLength(1)
    expect(s().data.milestones[0]).toMatchObject({ laneId: 'l1', date: '2026-11-12' })
    expect(s().data.phases).toHaveLength(0)
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
  })

  it('treats a 3px wobble as a click', () => {
    setup()
    press('2026-11-12')
    fireEvent.pointerMove(cell('2026-11-12'), {
      clientX: center('2026-11-12').clientX + 3,
      clientY: center('2026-11-12').clientY,
      pointerId: 1,
    })
    release('2026-11-12')
    expect(s().data.milestones).toHaveLength(1)
    expect(s().data.phases).toHaveLength(0)
  })

  it('does not add a milestone after a range drag', () => {
    setup()
    press('2026-11-12')
    move('2026-11-15')
    release('2026-11-15')
    expect(s().data.milestones).toHaveLength(0)
  })

  it('ignores other mouse buttons', () => {
    setup()
    press('2026-11-12', { button: 2 })
    release('2026-11-12')
    expect(s().data.milestones).toHaveLength(0)
  })

  it('does not create anything when an existing bar is clicked, and selects it', async () => {
    const withPhase: AppData = {
      ...data,
      phases: [
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
    }
    const { user } = setup(withPhase)
    await user.click(screen.getByTestId('phase-p1'))
    expect(s().data.phases).toHaveLength(1)
    expect(s().data.milestones).toHaveLength(0)
    expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
  })
})

describe('default lane', () => {
  it('uses the lane the last edited item was moved to', async () => {
    setup()
    press('2026-11-12')
    move('2026-11-13')
    release('2026-11-13')
    const id = s().data.phases[0]!.id
    await screen.findByRole('dialog', { name: '编辑阶段' })
    act(() => s().updatePhase(id, { laneId: 'l2' }))

    press('2026-11-20')
    release('2026-11-20')
    expect(s().data.milestones[0]).toMatchObject({ laneId: 'l2', date: '2026-11-20' })
  })

  it('has no grid and creates nothing without lanes', () => {
    setup(createEmptyData())
    expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument()
    expect(s().data.phases).toHaveLength(0)
    expect(s().data.milestones).toHaveLength(0)
  })
})
