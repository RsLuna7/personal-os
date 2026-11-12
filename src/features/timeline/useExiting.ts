import { useEffect, useState } from 'react'

export const EXIT_MS = 200

/** 用户要求减少动态效果时，不播放消失过渡，被删的项立即移除。 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * 刚被删除的项。它们会在列表里多留 EXIT_MS 毫秒，用来播放消失过渡。
 * 被删的项如果又回来了（撤销），立即不再算作“正在消失”。
 */
export function useExiting<T extends { id: string }>(items: T[]): T[] {
  const [previous, setPrevious] = useState(items)
  const [exiting, setExiting] = useState<T[]>([])

  if (previous !== items) {
    const present = new Set(items.map((item) => item.id))
    const removed = prefersReducedMotion() ? [] : previous.filter((item) => !present.has(item.id))
    const stillExiting = exiting.filter((item) => !present.has(item.id))
    setPrevious(items)
    if (removed.length > 0 || stillExiting.length !== exiting.length) {
      setExiting([...stillExiting, ...removed])
    }
  }

  useEffect(() => {
    if (exiting.length === 0) return
    const timer = setTimeout(() => setExiting([]), EXIT_MS)
    return () => clearTimeout(timer)
  }, [exiting])

  return exiting
}
