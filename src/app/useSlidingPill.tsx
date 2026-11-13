import { useEffect, useLayoutEffect, useState, type RefObject } from 'react'

/** 选中底色那块“胶囊”相对容器的位置和大小，以及它该用的板块色（有的话） */
export interface Pill {
  left: number
  top: number
  width: number
  height: number
  color: string | null
}

function samePill(a: Pill | null, b: Pill | null): boolean {
  if (a === null || b === null) return a === b
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height &&
    a.color === b.color
  )
}

/**
 * 量出容器里选中的那个元素（selector）的位置，给滑动的选中底色用：选中换了，胶囊就滑过去。
 * 每次渲染后量一次，没变就不更新；窗口大小变了也重新量。容器要是定位元素（relative）。
 */
export function useSlidingPill(
  container: RefObject<HTMLElement | null>,
  selector: string,
): Pill | null {
  const [pill, setPill] = useState<Pill | null>(null)
  const [, setResized] = useState(0)

  useEffect(() => {
    const onResize = () => setResized((count) => count + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // 故意不写依赖：选中的元素可能在任何一次渲染里换掉或挪位置
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const target = container.current?.querySelector<HTMLElement>(selector)
    const next = target
      ? {
          left: target.offsetLeft,
          top: target.offsetTop,
          width: target.offsetWidth,
          height: target.offsetHeight,
          color: target.dataset.laneColor ?? null,
        }
      : null
    // 位置只有排版之后才量得到，所以只能在这里设；没变就不设，不会反复渲染
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!samePill(pill, next)) setPill(next)
  })

  return pill
}

interface SlidingPillProps {
  pill: Pill | null
  className?: string
  testId?: string
}

/** 画出那块胶囊：绝对定位在容器左上角，用 transform 挪到选中元素的位置（过渡写在 CSS 里）。 */
export function SlidingPill({ pill, className = '', testId }: SlidingPillProps) {
  if (!pill) return null
  return (
    <span
      aria-hidden
      data-testid={testId}
      data-lane-color={pill.color ?? undefined}
      className={`sliding-pill pointer-events-none absolute top-0 left-0 ${className}`}
      style={{
        transform: `translate(${pill.left}px, ${pill.top}px)`,
        width: pill.width,
        height: pill.height,
      }}
    />
  )
}
