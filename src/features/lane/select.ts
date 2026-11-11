import { routeHref } from '@/app/useHashRoute'
import type { Lane } from '@/data/schema'

/**
 * 页面要显示哪个板块：参数指向存在的板块就用它，
 * 否则取 order 最小的；没有板块时返回 null。
 */
export function resolveLaneId(lanes: readonly Lane[], param: string | null): string | null {
  if (param !== null && lanes.some((lane) => lane.id === param)) return param
  let first: Lane | null = null
  for (const lane of lanes) {
    if (first === null || lane.order < first.order) first = lane
  }
  return first?.id ?? null
}

export function laneHref(laneId: string): string {
  return routeHref('modules', laneId)
}
