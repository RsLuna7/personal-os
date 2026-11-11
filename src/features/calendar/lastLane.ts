import type { Lane } from '@/data/schema'

// 新建阶段和节点时默认放进最近用过的板块。只是界面状态，不进数据，刷新页面就忘。
let lastLaneId: string | null = null

export function getLastLaneId(): string | null {
  return lastLaneId
}

export function setLastLaneId(id: string | null): void {
  lastLaneId = id
}

export function resetCalendarState(): void {
  lastLaneId = null
}

/** 新建项放进哪个板块：最近用过且还在的，否则 order 最小的；没有板块返回 null。 */
export function pickLaneId(lanes: Lane[]): string | null {
  if (lastLaneId !== null && lanes.some((lane) => lane.id === lastLaneId)) return lastLaneId
  let first: Lane | undefined
  for (const lane of lanes) if (!first || lane.order < first.order) first = lane
  return first?.id ?? null
}
