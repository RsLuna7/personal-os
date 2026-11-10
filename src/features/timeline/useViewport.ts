import { useLayoutEffect, useRef, type RefObject } from 'react'
import { create } from 'zustand'
import { getStorage, loadUiPrefs, saveUiPrefs } from '@/data/persistence'
import type { AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay, todayISO } from './days'
import {
  panBy as panScale,
  presetScale,
  zoomAt as zoomScale,
  type Scale,
  type ZoomPreset,
} from './scale'

export const LABEL_COLUMN_WIDTH = 112
export const MIN_LABEL_WIDTH = 24
/** 今天在画布上的位置：左起四分之一 */
const TODAY_POSITION = 0.25
const DEFAULT_WIDTH = 1168
const ANIMATE_MS = 250

interface ViewportState {
  scale: Scale
  /** 画布宽度（不含左侧板块名一列） */
  width: number
  preset: ZoomPreset | 'custom'
  /** 是否已按偏好初始化过 */
  ready: boolean
  /** 切换档位、回到今天时短暂为 true，让色块平滑过渡 */
  animating: boolean
}

const initialState: ViewportState = {
  scale: { originDay: 0, pxPerDay: 2 },
  width: DEFAULT_WIDTH,
  preset: 'year',
  ready: false,
  animating: false,
}

export const useViewportStore = create<ViewportState>()(() => initialState)

export function resetViewport(): void {
  useViewportStore.setState(initialState)
}

const today = () => toDay(todayISO())

export function dataRange(data: AppData): { min: number; max: number } | null {
  const days = [
    ...data.phases.flatMap((p) => [toDay(p.start), toDay(p.end)]),
    ...data.milestones.map((m) => toDay(m.date)),
    ...data.terms.flatMap((t) => [toDay(t.start), toDay(t.end)]),
  ]
  if (days.length === 0) return null
  return { min: Math.min(...days), max: Math.max(...days) }
}

function withTodayAtQuarter(pxPerDay: number, width: number): Scale {
  return { originDay: today() - (width * TODAY_POSITION) / pxPerDay, pxPerDay }
}

function remember(patch: { zoomPreset: ZoomPreset | 'custom'; pxPerDay: number | null }): void {
  const storage = getStorage(window)
  saveUiPrefs(storage, { ...loadUiPrefs(storage, new Date()), ...patch })
}

let animateTimer: ReturnType<typeof setTimeout> | undefined
function animate(): void {
  clearTimeout(animateTimer)
  useViewportStore.setState({ animating: true })
  animateTimer = setTimeout(() => useViewportStore.setState({ animating: false }), ANIMATE_MS)
}

function init(): void {
  const { width } = useViewportStore.getState()
  const prefs = loadUiPrefs(getStorage(window), new Date())
  const range = dataRange(useStore.getState().data)
  let scale: Scale
  if (prefs.zoomPreset === 'custom') {
    scale = withTodayAtQuarter(prefs.pxPerDay ?? initialState.scale.pxPerDay, width)
  } else if (prefs.zoomPreset === 'all' && range) {
    scale = presetScale('all', width, today(), range)
  } else {
    scale = withTodayAtQuarter(presetScale(prefs.zoomPreset, width, today(), range).pxPerDay, width)
  }
  useViewportStore.setState({ scale, preset: prefs.zoomPreset, ready: true })
}

function setPreset(preset: ZoomPreset): void {
  const { width } = useViewportStore.getState()
  animate()
  useViewportStore.setState({
    scale: presetScale(preset, width, today(), dataRange(useStore.getState().data)),
    preset,
  })
  remember({ zoomPreset: preset, pxPerDay: null })
}

function zoomAt(factor: number, anchorX: number): void {
  const scale = zoomScale(useViewportStore.getState().scale, factor, anchorX)
  useViewportStore.setState({ scale, preset: 'custom' })
  remember({ zoomPreset: 'custom', pxPerDay: scale.pxPerDay })
}

function panBy(dx: number): void {
  useViewportStore.setState({ scale: panScale(useViewportStore.getState().scale, dx) })
}

function goToToday(): void {
  const { scale, width } = useViewportStore.getState()
  animate()
  useViewportStore.setState({ scale: withTodayAtQuarter(scale.pxPerDay, width) })
}

export interface Viewport {
  scale: Scale
  width: number
  preset: ZoomPreset | 'custom'
  animating: boolean
  setPreset(preset: ZoomPreset): void
  zoomAt(factor: number, anchorX: number): void
  panBy(dx: number): void
  goToToday(): void
  /** 挂在时间线的滚动容器上，用来量宽度；不需要量宽的调用方可以不用 */
  containerRef: RefObject<HTMLDivElement | null>
}

export function useViewport(): Viewport {
  const { scale, width, preset, animating } = useViewportStore()
  const containerRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const element = containerRef.current
    if (!element) return
    const measure = () => {
      const measured = element.clientWidth - LABEL_COLUMN_WIDTH
      if (measured > 0 && measured !== useViewportStore.getState().width) {
        useViewportStore.setState({ width: measured })
      }
    }
    measure()
    if (!useViewportStore.getState().ready) init()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return { scale, width, preset, animating, setPreset, zoomAt, panBy, goToToday, containerRef }
}
