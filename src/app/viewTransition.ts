import { flushSync } from 'react-dom'
import type { Route } from './useHashRoute'

export type TransitionKind = 'expand' | 'collapse'

/** 展开后今天线和色块的入场动画最长约 1.1 秒，留一点余量再去掉标记 */
const ENTER_MARK_MS = 1400

let enterTimer: ReturnType<typeof setTimeout> | undefined

/** 主页 ↔ 完整时间线之间的切换才有过渡，其他页面之间直接切换。 */
export function transitionBetween(from: Route, to: Route): TransitionKind | null {
  if (from === 'home' && to === 'timeline') return 'expand'
  if (from === 'timeline' && to === 'home') return 'collapse'
  return null
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

/**
 * 用浏览器的 View Transitions 播放切换：时间线卡片放大成完整时间线，或反过来缩回。
 * 浏览器不支持、或系统开了“减少动态效果”时，直接切换。
 * `<html>` 上的 data-vt 和 data-timeline-enter 给 CSS 选择动画用，见 index.css。
 */
export function runViewTransition(kind: TransitionKind, update: () => void): void {
  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    update()
    return
  }
  const root = document.documentElement
  root.dataset.vt = kind
  clearTimeout(enterTimer)
  if (kind === 'expand') {
    root.dataset.timelineEnter = 'true'
    enterTimer = setTimeout(() => delete root.dataset.timelineEnter, ENTER_MARK_MS)
  } else {
    delete root.dataset.timelineEnter
  }
  const transition = document.startViewTransition(() => flushSync(update))
  // 上一个过渡还没播完又点了一次时，上一个会被跳过，ready 和 finished 都会 reject；页面本身已经切换好了
  transition.ready.catch(() => {})
  transition.finished
    .catch(() => {})
    .finally(() => {
      if (root.dataset.vt === kind) delete root.dataset.vt
    })
}
