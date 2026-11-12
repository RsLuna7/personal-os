import { useLayoutEffect, useRef, type RefObject } from 'react'
import { create } from 'zustand'
import { getStorage, loadUiPrefs, saveUiPrefs } from '@/data/persistence'
import type { AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay, todayISO } from './days'
import {
  panBy as panScale,
  presetDays,
  presetScale,
  TODAY_POSITION,
  zoomAt as zoomScale,
  type Scale,
  type ZoomPreset,
} from './scale'

export const LABEL_COLUMN_WIDTH = 112
export const MIN_LABEL_WIDTH = 24
/** 宽度变化超过 1% 就按档位重新适配；再小的变化是像素抖动，不值得重算 */
const REFIT_THRESHOLD = 0.01
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
  /** 上次按档位适配时的画布宽度；宽度一变就重新适配，让“一年”始终是一年 */
  fitWidth: number
}

const initialState: ViewportState = {
  scale: { originDay: 0, pxPerDay: 2 },
  width: DEFAULT_WIDTH,
  preset: 'year',
  ready: false,
  animating: false,
  fitWidth: DEFAULT_WIDTH,
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
  } else {
    scale = presetScale(prefs.zoomPreset, width, today(), range)
  }
  useViewportStore.setState({ scale, preset: prefs.zoomPreset, ready: true, fitWidth: width })
}

function setPreset(preset: ZoomPreset): void {
  const { width } = useViewportStore.getState()
  animate()
  useViewportStore.setState({
    scale: presetScale(preset, width, today(), dataRange(useStore.getState().data)),
    preset,
    fitWidth: width,
  })
  remember({ zoomPreset: preset, pxPerDay: null })
}

function zoomAt(factor: number, anchorX: number): void {
  const scale = zoomScale(useViewportStore.getState().scale, factor, anchorX)
  useViewportStore.setState({ scale, preset: 'custom' })
  remember({ zoomPreset: 'custom', pxPerDay: scale.pxPerDay })
}

/**
 * 画布宽度变了（拖窗口、开关侧栏，或在主页卡片和完整时间线之间切换）时，按当前档位重新适配，
 * 保持“近三个月”“一年”名副其实。主页卡片最宽只到 1280 像素的版心，比宽屏上的完整时间线窄很多，
 * 所以两边各按自己的宽度适配，共用同一个“今天在左起四分之一”的位置。
 * “近三个月”“一年”保持左起四分之一处的日期不动，只改缩放；“全部”重新铺满数据。
 */
export function refit(width: number): void {
  const { preset, scale, width: oldWidth } = useViewportStore.getState()
  if (preset === 'custom') return
  const days = presetDays(preset)
  let next: Scale
  if (days === null) {
    next = presetScale(preset, width, today(), dataRange(useStore.getState().data))
  } else {
    const anchorDay = scale.originDay + (oldWidth * TODAY_POSITION) / scale.pxPerDay
    const pxPerDay = presetScale(preset, width, anchorDay, null).pxPerDay
    next = { originDay: anchorDay - (width * TODAY_POSITION) / pxPerDay, pxPerDay }
  }
  useViewportStore.setState({ scale: next, fitWidth: width })
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
      const state = useViewportStore.getState()
      if (measured <= 0 || measured === state.width) return
      const drift = Math.abs(measured - state.fitWidth) / state.fitWidth
      if (state.ready && drift > REFIT_THRESHOLD) refit(measured)
      useViewportStore.setState({ width: measured })
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
