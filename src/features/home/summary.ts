import type { AppData, Lane, Milestone, Phase } from '@/data/schema'
import { toDay } from '@/features/timeline/days'

export interface LaneSummary {
  lane: Lane
  /** 正在进行的阶段；同时有多个时，优先已确定的，再取开始得更早的 */
  current: Phase | null
  /** 和 current 同时在进行的其他阶段，按同样的顺序 */
  alsoActive: Phase[]
  /** 当前阶段已过去的比例，0 到 1，今天还没过完、不算已过；没有当前阶段时为 null */
  progress: number | null
  /** 当前阶段还剩几天（含今天），没有当前阶段时为 null */
  daysLeft: number | null
  /** 当前阶段之后最近的一个阶段；没有当前阶段时，是今天之后最近的阶段 */
  next: Phase | null
  /** 今天及之后最近的节点 */
  nextMilestone: Milestone | null
}

function byStart(a: Phase, b: Phase): number {
  return a.start.localeCompare(b.start) || a.id.localeCompare(b.id)
}

function byDate(a: Milestone, b: Milestone): number {
  return a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
}

export function summarizeLane(
  lane: Lane,
  phases: Phase[],
  milestones: Milestone[],
  today: number,
): LaneSummary {
  const own = phases.filter((phase) => phase.laneId === lane.id)

  const active = own
    .filter((phase) => toDay(phase.start) <= today && today < toDay(phase.end))
    .sort((a, b) => Number(a.tentative) - Number(b.tentative) || byStart(a, b))
  const current = active[0] ?? null
  const alsoActive = active.slice(1)

  const horizon = current ? toDay(current.end) : today + 1
  const next = own.filter((phase) => toDay(phase.start) >= horizon).sort(byStart)[0] ?? null

  const nextMilestone =
    milestones
      .filter((milestone) => milestone.laneId === lane.id && toDay(milestone.date) >= today)
      .sort(byDate)[0] ?? null

  let progress: number | null = null
  let daysLeft: number | null = null
  if (current) {
    const start = toDay(current.start)
    const end = toDay(current.end)
    // 和“还剩 N 天（含今天）”一致：今天还没过完，最后一天进度条不会先满
    progress = (today - start) / (end - start)
    daysLeft = end - today
  }

  return { lane, current, alsoActive, progress, daysLeft, next, nextMilestone }
}

/** 后面什么都没安排的板块：没有进行中的阶段、没有之后的阶段，也没有今天及之后的节点。 */
export function isIdle(summary: LaneSummary): boolean {
  return !summary.current && !summary.next && !summary.nextMilestone
}

/** 正在进行的阶段一共几个（同一板块里同时进行的都算）。 */
export function activePhaseCount(summaries: LaneSummary[]): number {
  return summaries.reduce(
    (total, summary) => total + (summary.current ? 1 + summary.alsoActive.length : 0),
    0,
  )
}

/** 按板块顺序，每个板块一条摘要。 */
export function summarizeLanes(data: AppData, today: number): LaneSummary[] {
  return [...data.lanes]
    .sort((a, b) => a.order - b.order)
    .map((lane) => summarizeLane(lane, data.phases, data.milestones, today))
}

export interface UpcomingMilestone {
  milestone: Milestone
  lane: Lane
  /** 距今天的天数，0 表示就在今天 */
  inDays: number
}

/** 所有板块里今天及之后最近的节点；没有时为 null。 */
export function nextMilestone(data: AppData, today: number): UpcomingMilestone | null {
  const lanes = new Map(data.lanes.map((lane) => [lane.id, lane]))
  const candidate = data.milestones
    .filter((milestone) => toDay(milestone.date) >= today && lanes.has(milestone.laneId))
    .sort(byDate)[0]
  if (!candidate) return null
  return {
    milestone: candidate,
    lane: lanes.get(candidate.laneId)!,
    inDays: toDay(candidate.date) - today,
  }
}
