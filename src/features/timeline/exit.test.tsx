import { act, render, screen, waitFor } from '@testing-library/react'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { toDay } from './days'
import { resetViewport, useViewportStore } from './useViewport'

const s = () => useStore.getState()
const exiting = () => [...document.querySelectorAll<HTMLElement>('[data-exiting="true"]')]

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '四级', color: 'tomato', order: 1, note: '', links: [] },
  ],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '基础',
      start: '2026-11-09',
      end: '2026-12-07',
      tentative: false,
      note: '',
    },
    {
      id: 'p2',
      laneId: 'l1',
      name: '强化',
      start: '2026-11-23',
      end: '2026-12-21',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', note: '' }],
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/timeline'
  resetViewport()
  resetEditor()
  s().hydrate(data)
  render(<App />)
  act(() =>
    useViewportStore.setState({
      scale: { originDay: toDay('2026-11-02'), pxPerDay: 2 },
      width: 1000,
    }),
  )
})
afterEach(() => vi.useRealTimers())

it('keeps a deleted phase on screen while it fades out, then removes it', async () => {
  const before = screen.getByTestId('phase-p1')
  const { transform, width, top } = before.style
  act(() => s().removePhase('p1'))

  expect(screen.queryByTestId('phase-p1')).not.toBeInTheDocument()
  const [ghost] = exiting()
  expect(ghost).toHaveTextContent('基础')
  expect(ghost).toHaveClass('phase-block')
  expect([ghost.style.transform, ghost.style.width, ghost.style.top]).toEqual([
    transform,
    width,
    top,
  ])
  expect(ghost).toHaveAttribute('aria-hidden', 'true')
  expect(ghost).not.toHaveAttribute('tabindex', '0')

  await waitFor(() => expect(exiting()).toHaveLength(0), { timeout: 1000 })
})

it('holds the other phases in place until the fade has finished', async () => {
  expect(screen.getByTestId('phase-p2').style.top).toBe('72px')
  act(() => s().removePhase('p1'))
  expect(screen.getByTestId('phase-p2').style.top).toBe('72px')
  await waitFor(() => expect(screen.getByTestId('phase-p2').style.top).toBe('32px'), {
    timeout: 1000,
  })
})

it('fades out a deleted milestone', async () => {
  act(() => s().removeMilestone('m1'))
  expect(screen.queryByTestId('milestone-m1')).not.toBeInTheDocument()
  const [ghost] = exiting()
  expect(ghost).toHaveTextContent('初试')
  expect(ghost).toHaveClass('milestone-dot')
  await waitFor(() => expect(exiting()).toHaveLength(0), { timeout: 1000 })
  expect(screen.getByTestId('lane-l1').style.height).toBe('96px')
})

it('does not react to clicks while fading out', () => {
  act(() => s().removePhase('p1'))
  const [ghost] = exiting()
  act(() => ghost.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 })))
  act(() => window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true })))
  expect(s().selection).toBeNull()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows the phase again at once when the deletion is undone mid-fade', () => {
  act(() => s().removePhase('p1'))
  act(() => s().undo())
  expect(screen.getByTestId('phase-p1')).toBeInTheDocument()
  expect(exiting()).toHaveLength(0)
})

it('does not leave a ghost behind when a phase only changes', () => {
  act(() => s().updatePhase('p1', { name: '基础一轮' }))
  expect(exiting()).toHaveLength(0)
})

describe('with prefers-reduced-motion', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('removes a deleted phase at once, with no ghost and no layout gap', () => {
    expect(screen.getByTestId('phase-p2').style.top).toBe('72px')
    act(() => s().removePhase('p1'))
    expect(screen.queryByTestId('phase-p1')).not.toBeInTheDocument()
    expect(exiting()).toHaveLength(0)
    expect(screen.getByTestId('phase-p2').style.top).toBe('32px')
  })

  it('removes a deleted milestone at once, with no ghost', () => {
    act(() => s().removeMilestone('m1'))
    expect(screen.queryByTestId('milestone-m1')).not.toBeInTheDocument()
    expect(exiting()).toHaveLength(0)
    expect(screen.getByTestId('lane-l1').style.height).toBe('96px')
  })
})
