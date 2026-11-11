import type { Lane, Milestone, Phase, Term } from '@/data/schema'
import { toDay } from '@/features/timeline/days'

/** 每个周行放几个项目；第 3 槽可能被“+N 项”占用。 */
export const SLOTS = 3

const DAYS_PER_WEEK = 7

export interface CalendarData {
  lanes: Lane[]
  phases: Phase[]
  milestones: Milestone[]
  terms: Term[]
}

export interface BarSegment {
  phase: Phase
  /** 列号 0 到 6，含 */
  startCol: number
  endCol: number
  slot: number
  /** 这个阶段在网格里最先画出的一段，带名称 */
  labelled: boolean
  /** 这一段的左端就是阶段的开始日，可以放开始把手 */
  startsHere: boolean
  /** 这一段的右端就是阶段的最后一天，可以放结束把手 */
  endsHere: boolean
}

export interface TermSegment {
  term: Term
  startCol: number
  endCol: number
  labelled: boolean
}

export interface WeekLayout {
  /** 这一周的 7 个整日数 */
  days: number[]
  terms: TermSegment[]
  bars: BarSegment[]
}

const UNKNOWN_LANE_ORDER = Number.MAX_SAFE_INTEGER

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** 把 [start, end)（整日数）切到一周里；和这一周没有交集时返回 null。 */
function clipToWeek(
  start: number,
  end: number,
  weekStart: number,
): { startCol: number; endCol: number; clippedStart: number; clippedEnd: number } | null {
  const clippedStart = Math.max(start, weekStart)
  const clippedEnd = Math.min(end, weekStart + DAYS_PER_WEEK)
  if (clippedStart >= clippedEnd) return null
  return {
    startCol: clippedStart - weekStart,
    endCol: clippedEnd - 1 - weekStart,
    clippedStart,
    clippedEnd,
  }
}

/** 一个周行里最靠前的、startCol 到 endCol 都空着的槽。 */
function firstFreeSlot(occupied: boolean[][], startCol: number, endCol: number): number {
  for (let slot = 0; ; slot++) {
    const row = (occupied[slot] ??= new Array<boolean>(DAYS_PER_WEEK).fill(false))
    let free = true
    for (let col = startCol; col <= endCol; col++) if (row[col]) free = false
    if (free) {
      for (let col = startCol; col <= endCol; col++) row[col] = true
      return slot
    }
  }
}

/**
 * 月网格里每个周行的内容：学期带和阶段色条（切成每周一段、排进槽里）。
 * 日期都是整日数；阶段和学期的 end 不含当天。
 */
export function layoutMonth(weeks: number[][], data: CalendarData): WeekLayout[] {
  const laneOrder = new Map(data.lanes.map((lane) => [lane.id, lane.order]))
  const orderOf = (laneId: string) => laneOrder.get(laneId) ?? UNKNOWN_LANE_ORDER

  const phases = [...data.phases].sort(
    (a, b) =>
      orderOf(a.laneId) - orderOf(b.laneId) ||
      compareText(a.start, b.start) ||
      compareText(a.id, b.id),
  )
  const terms = [...data.terms].sort(
    (a, b) => compareText(a.start, b.start) || compareText(a.id, b.id),
  )

  const labelledPhases = new Set<string>()
  const labelledTerms = new Set<string>()

  return weeks.map((days) => {
    const weekStart = days[0]!
    const occupied: boolean[][] = []

    const termSegments: TermSegment[] = []
    for (const term of terms) {
      const clip = clipToWeek(toDay(term.start), toDay(term.end), weekStart)
      if (!clip) continue
      termSegments.push({
        term,
        startCol: clip.startCol,
        endCol: clip.endCol,
        labelled: !labelledTerms.has(term.id),
      })
      labelledTerms.add(term.id)
    }

    const bars: BarSegment[] = []
    for (const phase of phases) {
      const start = toDay(phase.start)
      const end = toDay(phase.end)
      const clip = clipToWeek(start, end, weekStart)
      if (!clip) continue
      bars.push({
        phase,
        startCol: clip.startCol,
        endCol: clip.endCol,
        slot: firstFreeSlot(occupied, clip.startCol, clip.endCol),
        labelled: !labelledPhases.has(phase.id),
        startsHere: clip.clippedStart === start,
        endsHere: clip.clippedEnd === end,
      })
      labelledPhases.add(phase.id)
    }

    return { days, terms: termSegments, bars }
  })
}
