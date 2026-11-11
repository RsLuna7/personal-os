import type { Milestone, Phase } from '@/data/schema'
import { toDay } from '@/features/timeline/days'

export type PhaseStatus = 'in-progress' | 'tentative' | 'upcoming' | 'ended'

export const PHASE_STATUS_TEXT: Record<PhaseStatus, string> = {
  'in-progress': '进行中',
  tentative: '待确认',
  upcoming: '未开始',
  ended: '已结束',
}

export type LaneItem =
  | { kind: 'phase'; id: string; sortDay: number; phase: Phase; status: PhaseStatus }
  | { kind: 'milestone'; id: string; sortDay: number; milestone: Milestone }

function phaseStatus(phase: Phase, today: number): PhaseStatus {
  // end 不含当天：结束日就是今天，说明昨天已经结束
  if (toDay(phase.end) <= today) return 'ended'
  if (phase.tentative) return 'tentative'
  return toDay(phase.start) <= today ? 'in-progress' : 'upcoming'
}

function compareItems(a: LaneItem, b: LaneItem): number {
  if (a.sortDay !== b.sortDay) return a.sortDay - b.sortDay
  // 同一天阶段在前，节点在后
  if (a.kind !== b.kind) return a.kind === 'phase' ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** 把一个板块的阶段和节点按时间混排，并分成“当前及以后”和“已结束”两组。 */
export function buildLaneItems(
  laneId: string,
  phases: Phase[],
  milestones: Milestone[],
  today: number,
): { current: LaneItem[]; ended: LaneItem[] } {
  const current: LaneItem[] = []
  const ended: LaneItem[] = []

  for (const phase of phases) {
    if (phase.laneId !== laneId) continue
    const status = phaseStatus(phase, today)
    const item: LaneItem = {
      kind: 'phase',
      id: phase.id,
      sortDay: toDay(phase.start),
      phase,
      status,
    }
    ;(status === 'ended' ? ended : current).push(item)
  }

  for (const milestone of milestones) {
    if (milestone.laneId !== laneId) continue
    const sortDay = toDay(milestone.date)
    const item: LaneItem = { kind: 'milestone', id: milestone.id, sortDay, milestone }
    ;(sortDay < today ? ended : current).push(item)
  }

  return { current: current.sort(compareItems), ended: ended.sort(compareItems) }
}
