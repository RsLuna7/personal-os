import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { toDay } from './days'
import { type Scale } from './scale'
import { resetViewport, useViewportStore } from './useViewport'

const SCALE: Scale = { originDay: toDay('2026-11-02'), pxPerDay: 2 }
const s = () => useStore.getState()
const phase = () => s().data.phases.find((p) => p.id === 'p1')
const dates = () => [phase()!.start, phase()!.end]

const data: AppData = {
  ...createEmptyData(),
  lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '基础',
      start: '2026-11-09',
      end: '2026-12-07',
      tentative: false,
      done: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', done: false, note: '' }],
}

function setup(initial: AppData = data, selectPhase = true) {
  s().hydrate(initial)
  render(<App />)
  act(() => {
    useViewportStore.setState({ scale: SCALE, width: 1000 })
    if (selectPhase) s().select({ kind: 'phase', id: 'p1' })
  })
  return userEvent.setup()
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

it('moves the selection by a week with arrow keys, without re-snapping', async () => {
  const user = setup()
  await user.keyboard('{ArrowRight}')
  expect(dates()).toEqual(['2026-11-16', '2026-12-14'])
  await user.keyboard('{ArrowLeft}{ArrowLeft}')
  expect(dates()).toEqual(['2026-11-02', '2026-11-30'])

  act(() => s().updatePhase('p1', { start: '2026-11-04', end: '2026-12-02' }))
  await user.keyboard('{ArrowRight}')
  expect(dates()).toEqual(['2026-11-11', '2026-12-09'])
})

it('moves a milestone by a week with arrow keys', async () => {
  const user = setup()
  act(() => s().select({ kind: 'milestone', id: 'm1' }))
  await user.keyboard('{ArrowRight}')
  expect(s().data.milestones[0].date).toBe('2026-12-26')
  await user.keyboard('{ArrowLeft}{ArrowLeft}')
  expect(s().data.milestones[0].date).toBe('2026-12-12')
})

it('changes the end by a week with shift+arrow and keeps the one-week minimum', async () => {
  const user = setup()
  await user.keyboard('{Shift>}{ArrowRight}{/Shift}')
  expect(dates()).toEqual(['2026-11-09', '2026-12-14'])
  await user.keyboard('{Shift>}{ArrowLeft}{ArrowLeft}{ArrowLeft}{ArrowLeft}{/Shift}')
  expect(dates()).toEqual(['2026-11-09', '2026-11-16'])
  const n = s().past.length
  await user.keyboard('{Shift>}{ArrowLeft}{/Shift}')
  expect(dates()).toEqual(['2026-11-09', '2026-11-16'])
  expect(s().past.length).toBe(n)
})

it('deletes the selection with Delete and shows the undo toast', async () => {
  const user = setup()
  await user.keyboard('{Delete}')
  expect(phase()).toBeUndefined()
  expect(await screen.findByText('已删除「基础」')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(phase()).toBeDefined()
})

it('opens the editor with Enter and closes it with Escape', async () => {
  const user = setup()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: '编辑阶段' })
  expect(within(dialog).getByLabelText('名称')).toHaveValue('基础')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
})

it('clears the selection with Escape when no editor is open', async () => {
  const user = setup()
  await user.keyboard('{Escape}')
  expect(s().selection).toBeNull()
})

it('undoes with ctrl+z and redoes with ctrl+shift+z', async () => {
  const user = setup()
  await user.keyboard('{ArrowRight}')
  await user.keyboard('{Control>}z{/Control}')
  expect(dates()).toEqual(['2026-11-09', '2026-12-07'])
  await user.keyboard('{Control>}{Shift>}Z{/Shift}{/Control}')
  expect(dates()).toEqual(['2026-11-16', '2026-12-14'])
  await user.keyboard('{Meta>}z{/Meta}')
  expect(dates()).toEqual(['2026-11-09', '2026-12-07'])
})

it('jumps to today with T', async () => {
  const user = setup()
  await user.keyboard('t')
  expect(screen.getByTestId('today-line').style.transform).toBe('translateX(250px)')
})

it('ignores shortcuts while typing in a field', async () => {
  const user = setup()
  await user.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog', { name: '编辑阶段' })
  const name = within(dialog).getByLabelText('名称')
  await user.click(name)
  await user.keyboard('{Delete}t{ArrowRight}')
  expect(phase()).toBeDefined()
  expect(dates()).toEqual(['2026-11-09', '2026-12-07'])
})

it('ignores item shortcuts while focus is on another button', async () => {
  const user = setup()
  screen.getByRole('button', { name: '回到今天' }).focus()
  await user.keyboard('{Delete}')
  expect(phase()).toBeDefined()
})

it('does nothing on arrow keys when nothing is selected', async () => {
  const user = setup(data, false)
  const n = s().past.length
  await user.keyboard('{ArrowRight}{Delete}{Enter}')
  expect(s().past.length).toBe(n)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('reaches every phase and milestone with Tab and shows a visible focus ring', async () => {
  const user = setup(data, false)
  const seen = new Set<string>()
  for (let i = 0; i < 30; i++) {
    await user.tab()
    const id = (document.activeElement as HTMLElement | null)?.dataset.testid
    if (id) seen.add(id)
    if (id === 'phase-p1') {
      expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
      // the focus ring rule in index.css is keyed on this class
      expect(document.activeElement).toHaveClass('phase-block')
    }
  }
  expect(seen).toContain('phase-p1')
  expect(seen).toContain('milestone-m1')
})
