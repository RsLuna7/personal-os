import { act, fireEvent, render, screen } from '@testing-library/react'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from './days'
import { dayToX, type Scale } from './scale'
import { LABEL_COLUMN_WIDTH, resetViewport, useViewportStore } from './useViewport'

const SCALE: Scale = { originDay: toDay('2026-11-02'), pxPerDay: 2 }
const s = () => useStore.getState()
const phaseDates = (id = 'p1') => {
  const p = s().data.phases.find((item) => item.id === id)!
  return [p.start, p.end]
}

const data: AppData = {
  ...createEmptyData(),
  lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0 }],
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
  ],
}

function drag(el: HTMLElement, from: number, to: number, release = true) {
  fireEvent.pointerDown(el, { clientX: from, button: 0, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: to, pointerId: 1 })
  if (release) fireEvent.pointerUp(el, { clientX: to, pointerId: 1 })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = ''
  resetViewport()
  s().hydrate(data)
  render(<App />)
  act(() => useViewportStore.setState({ scale: SCALE, width: 1000 }))
})
afterEach(() => vi.useRealTimers())

it('moves a phase by whole weeks on drag and records one undo step', () => {
  const n = s().past.length
  drag(screen.getByTestId('phase-p1'), 100, 118)
  expect(phaseDates()).toEqual(['2026-11-16', '2026-12-14'])
  expect(s().past.length).toBe(n + 1)
})

it('shows live dates while dragging and removes the hint on release', () => {
  const el = screen.getByTestId('phase-p1')
  drag(el, 100, 118, false)
  expect(screen.getByTestId('drag-hint')).toHaveTextContent('11月16日 – 12月13日 · 4 周')
  expect(el.style.transform).toBe('translateX(32px)')
  expect(phaseDates()).toEqual(['2026-11-09', '2026-12-07'])
  fireEvent.pointerUp(el, { clientX: 118, pointerId: 1 })
  expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument()
})

it('does not commit when the pointer returns to the start', () => {
  const n = s().past.length
  const el = screen.getByTestId('phase-p1')
  fireEvent.pointerDown(el, { clientX: 100, button: 0, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 140, pointerId: 1 })
  fireEvent.pointerMove(el, { clientX: 100, pointerId: 1 })
  fireEvent.pointerUp(el, { clientX: 100, pointerId: 1 })
  expect(s().past.length).toBe(n)
  expect(phaseDates()).toEqual(['2026-11-09', '2026-12-07'])
})

it('treats a movement under 4px as a click, not a drag', () => {
  const n = s().past.length
  drag(screen.getByTestId('phase-p1'), 100, 103)
  expect(s().past.length).toBe(n)
  expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument()
  expect(s().selection).toEqual({ kind: 'phase', id: 'p1' })
})

it('resizes from the end handle with a one-week minimum', () => {
  drag(screen.getByTestId('phase-p1-handle-end'), 200, 140)
  expect(phaseDates()).toEqual(['2026-11-09', '2026-11-16'])
})

it('resizes from the end handle to a later week', () => {
  drag(screen.getByTestId('phase-p1-handle-end'), 200, 230)
  expect(phaseDates()).toEqual(['2026-11-09', '2026-12-21'])
})

it('resizes from the start handle', () => {
  drag(screen.getByTestId('phase-p1-handle-start'), 100, 72)
  expect(phaseDates()).toEqual(['2026-10-26', '2026-12-07'])
})

it('cancels the drag on Escape', () => {
  const n = s().past.length
  const el = screen.getByTestId('phase-p1')
  drag(el, 100, 160, false)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument()
  fireEvent.pointerUp(el, { clientX: 160, pointerId: 1 })
  expect(phaseDates()).toEqual(['2026-11-09', '2026-12-07'])
  expect(s().past.length).toBe(n)
  expect(el.style.transform).toBe('translateX(14px)')
})

it('creates a four-week phase on double-click in empty lane space and selects it', () => {
  const canvas = screen.getByTestId('lane-l1-canvas')
  fireEvent.doubleClick(canvas, { clientX: dayToX(SCALE, toDay('2027-01-13')) })
  const created = s().data.phases.find((p) => p.id !== 'p1')!
  expect(created).toMatchObject({ start: '2027-01-11', end: '2027-02-08', name: '新阶段' })
  expect(s().selection).toEqual({ kind: 'phase', id: created.id })
})

it('does not create a phase when double-clicking an existing one', () => {
  fireEvent.doubleClick(screen.getByTestId('phase-p1'), { clientX: 30 })
  expect(s().data.phases).toHaveLength(1)
})

it('zooms around the pointer on ctrl+wheel and switches preset to custom', () => {
  fireEvent.wheel(screen.getByTestId('timeline'), {
    ctrlKey: true,
    deltaY: -100,
    clientX: LABEL_COLUMN_WIDTH + 200,
  })
  const { scale, preset } = useViewportStore.getState()
  expect(scale.pxPerDay).toBeCloseTo(2.2)
  expect(dayToX(scale, SCALE.originDay + 100)).toBeCloseTo(200)
  expect(preset).toBe('custom')
})

it('zooms out on ctrl+wheel down', () => {
  fireEvent.wheel(screen.getByTestId('timeline'), { ctrlKey: true, deltaY: 100, clientX: 112 })
  expect(useViewportStore.getState().scale.pxPerDay).toBeCloseTo(2 / 1.1)
})

it('pans on horizontal wheel and on dragging empty space', () => {
  fireEvent.wheel(screen.getByTestId('timeline'), { deltaX: 40 })
  expect(useViewportStore.getState().scale.originDay).toBe(SCALE.originDay + 20)

  drag(screen.getByTestId('lane-l1-canvas'), 300, 340)
  expect(useViewportStore.getState().scale.originDay).toBe(SCALE.originDay)
  expect(s().data.phases).toHaveLength(1)
})

it('leaves vertical wheel to the browser', () => {
  fireEvent.wheel(screen.getByTestId('timeline'), { deltaY: 100 })
  expect(useViewportStore.getState().scale).toEqual(SCALE)
})
