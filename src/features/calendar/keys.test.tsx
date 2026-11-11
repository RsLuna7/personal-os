import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { resetCalendarState } from './lastLane'

const s = () => useStore.getState()

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
  ],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '强化',
      start: '2026-11-09',
      end: '2026-11-14',
      tentative: false,
      note: '',
    },
    // 只有 1 天
    {
      id: 'p2',
      laneId: 'l2',
      name: '面试准备',
      start: '2026-11-17',
      end: '2026-11-18',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-11-20', note: '' }],
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

function setup(hash = '#/calendar', initial: AppData = data) {
  window.location.hash = hash
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const cell = (iso: string) => screen.getByTestId(`day-${iso}`)
const focus = (element: HTMLElement) => act(() => element.focus())
const phase = (id: string) => s().data.phases.find((item) => item.id === id)!
const dates = (id: string) => [phase(id).start, phase(id).end]

describe('day cells', () => {
  it('has a single tab stop on today, and arrows move it', async () => {
    const user = setup()
    expect(document.querySelectorAll('[data-day][tabindex="0"]')).toHaveLength(1)
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '0')

    focus(cell('2026-11-10'))
    await user.keyboard('{ArrowRight}')
    expect(cell('2026-11-11')).toHaveFocus()
    expect(cell('2026-11-11')).toHaveAttribute('tabindex', '0')
    expect(cell('2026-11-10')).toHaveAttribute('tabindex', '-1')

    await user.keyboard('{ArrowDown}')
    expect(cell('2026-11-18')).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowUp}')
    expect(cell('2026-11-10')).toHaveFocus()
  })

  it('starts on the first of the month when today is not in it', () => {
    setup('#/calendar/2027-02')
    expect(cell('2027-02-01')).toHaveAttribute('tabindex', '0')
  })

  it('goes to the next month when the arrow leaves this one', async () => {
    const user = setup()
    focus(cell('2026-11-30'))
    await user.keyboard('{ArrowRight}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-12'))
    await waitFor(() => expect(cell('2026-12-01')).toHaveFocus())
  })

  it('keeps the day when paging months and clamps to the last day', async () => {
    const user = setup('#/calendar/2027-01')
    focus(cell('2027-01-31'))
    await user.keyboard('{PageDown}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2027-02'))
    await waitFor(() => expect(cell('2027-02-28')).toHaveFocus())
    await user.keyboard('{PageUp}')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2027-01'))
    await waitFor(() => expect(cell('2027-01-28')).toHaveFocus())
  })

  it('does not move past January 1900 and does not fail', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const user = setup('#/calendar/1900-01')
    focus(cell('1900-01-01'))
    await user.keyboard('{ArrowLeft}{ArrowUp}{PageUp}')
    expect(window.location.hash).toBe('#/calendar/1900-01')
    expect(cell('1900-01-01')).toHaveFocus()
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('jumps back to today with T', async () => {
    const user = setup('#/calendar/2027-02')
    focus(cell('2027-02-01'))
    await user.keyboard('t')
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-11'))
    await waitFor(() => expect(cell('2026-11-10')).toHaveFocus())
  })

  it('creates a milestone with Enter and opens the editor', async () => {
    const user = setup()
    focus(cell('2026-11-12'))
    await user.keyboard('{Enter}')
    expect(s().data.milestones).toHaveLength(2)
    expect(s().data.milestones.at(-1)).toMatchObject({ date: '2026-11-12' })
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
  })
})

describe('bars and dots', () => {
  it('shifts the focused phase a day with the arrows, one undo step each', async () => {
    const user = setup()
    const before = s().past.length
    focus(screen.getByTestId('phase-p1'))
    expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
    await user.keyboard('{ArrowRight}')
    expect(dates('p1')).toEqual(['2026-11-10', '2026-11-15'])
    expect(s().past.length).toBe(before + 1)
    expect(screen.getByTestId('phase-p1')).toHaveFocus()
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(dates('p1')).toEqual(['2026-11-08', '2026-11-13'])
  })

  it('changes only the end with Shift+arrows and keeps one day at least', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-15'])

    focus(screen.getByTestId('phase-p2'))
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(dates('p2')).toEqual(['2026-11-17', '2026-11-18'])
  })

  it('moves a milestone a day and ignores Shift for it', async () => {
    const user = setup()
    focus(screen.getByTestId('milestone-m1'))
    await user.keyboard('{ArrowRight}')
    expect(s().data.milestones[0]!.date).toBe('2026-11-21')
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
    expect(s().data.milestones[0]!.date).toBe('2026-11-21')
  })

  it('opens the editor with Enter', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: '编辑阶段' })).toBeInTheDocument()
  })

  it('deletes with Delete, shows the toast and Ctrl+Z restores', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    await user.keyboard('{Delete}')
    expect(s().data.phases.map((item) => item.id)).toEqual(['p2'])
    expect(await screen.findByText('已删除「强化」')).toBeInTheDocument()
    await user.keyboard('{Control>}z{/Control}')
    expect(s().data.phases.map((item) => item.id)).toEqual(['p1', 'p2'])
  })

  it('clears the selection with Escape', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    expect(s().selection).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(s().selection).toBeNull()
  })

  it('leaves the item alone when Ctrl is held', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    await user.keyboard('{Control>}{ArrowRight}{/Control}')
    expect(dates('p1')).toEqual(['2026-11-09', '2026-11-14'])
  })

  it('undoes and redoes exactly once with Ctrl+Z and Ctrl+Shift+Z', async () => {
    const user = setup()
    focus(screen.getByTestId('phase-p1'))
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(dates('p1')).toEqual(['2026-11-11', '2026-11-16'])
    await user.keyboard('{Control>}z{/Control}')
    expect(dates('p1')).toEqual(['2026-11-10', '2026-11-15'])
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(dates('p1')).toEqual(['2026-11-11', '2026-11-16'])
  })
})

describe('keys that belong to something else', () => {
  it('ignores Delete and arrows inside the editor fields', async () => {
    const user = setup()
    await user.click(screen.getByTestId('phase-p1'))
    const name = await screen.findByDisplayValue('强化')
    focus(name)
    const before = s().data
    await user.keyboard('{Delete}{ArrowRight}')
    expect(s().data).toBe(before)
  })

  it('ignores Delete and arrows inside the +N list', async () => {
    const crowded: AppData = {
      ...data,
      phases: ['a', 'b', 'c', 'd'].map((id) => ({
        id,
        laneId: 'l1',
        name: `阶段${id}`,
        start: '2026-11-09',
        end: '2026-11-12',
        tentative: false,
        note: '',
      })),
      milestones: [],
    }
    const user = setup('#/calendar', crowded)
    await user.click(within(cell('2026-11-09')).getByRole('button', { name: '+2 项' }))
    const list = await screen.findByRole('dialog', { name: '11月9日的项目' })
    focus(within(list).getAllByRole('button')[0]!)
    s().select({ kind: 'phase', id: 'a' })
    const before = s().data
    await user.keyboard('{Delete}{ArrowRight}')
    expect(s().data).toBe(before)
  })
})
