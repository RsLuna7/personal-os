import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Lane, Milestone, Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { fromDay, toDay } from './days'
import { countdownText, formatDay, formatDuration } from './format'
import { WEEK } from './snap'

/*
 * 时间线上悬停色块 / 节点时出现的详情卡片。
 * 卡片挂在页面根节点上，拿不到板块的颜色变量，所以由调用方把 data-lane-color 写在 TooltipContent 上。
 */

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function yearOf(day: number): string {
  return fromDay(day).slice(0, 4)
}

function weekdayOf(day: number): string {
  return WEEKDAYS[new Date(`${fromDay(day)}T00:00:00Z`).getUTCDay()]
}

function useLane(laneId: string): Lane | undefined {
  return useStore((state) => state.data.lanes.find((lane) => lane.id === laneId))
}

export type PhaseState = 'upcoming' | 'current' | 'ended'

export interface PhaseProgress {
  state: PhaseState
  /** 0–1：今天走到了阶段的哪里 */
  ratio: number
  /** 卡片底部右侧的一句话 */
  label: string
}

/** endDay 不含当天。 */
export function phaseProgress(startDay: number, endDay: number, today: number): PhaseProgress {
  if (today < startDay)
    return { state: 'upcoming', ratio: 0, label: `${startDay - today} 天后开始` }
  if (today >= endDay) {
    return { state: 'ended', ratio: 1, label: `已结束 ${today - (endDay - 1)} 天` }
  }
  const week = Math.floor((today - startDay) / WEEK) + 1
  return {
    state: 'current',
    ratio: (today - startDay) / (endDay - startDay),
    label: `第 ${week} 周 · 还剩 ${endDay - today} 天`,
  }
}

function LaneChip({ lane }: { lane: Lane | undefined }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-(--text-muted)">
      <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
      <span className="truncate">{lane?.name ?? '未分组'}</span>
    </span>
  )
}

function Pill({
  children,
  solid = false,
  dashed = false,
}: {
  children: ReactNode
  solid?: boolean
  dashed?: boolean
}) {
  return (
    <span
      className={
        'flex shrink-0 items-center gap-1 rounded-full border px-2 py-px text-[11px] leading-[18px] font-medium ' +
        (solid
          ? 'border-(--lane-solid) bg-(--lane-solid) text-(--lane-solid-text)'
          : 'border-(--lane-border) bg-(--lane-fill) text-(--lane-text)') +
        (dashed ? ' border-dashed' : '')
      }
    >
      {children}
    </span>
  )
}

/** 卡片顶部的色条；待确认的阶段画成虚线，和时间线上的虚线边框呼应。 */
function Stripe({ dashed = false }: { dashed?: boolean }) {
  return (
    <div
      aria-hidden
      className="h-1 bg-(--lane-dot)"
      style={
        dashed
          ? {
              background:
                'repeating-linear-gradient(90deg, var(--lane-dot) 0 8px, transparent 8px 12px)',
            }
          : undefined
      }
    />
  )
}

function Title({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2.5 font-serif text-[18px] leading-snug font-bold break-words text-(--text)">
      {children}
    </div>
  )
}

/** 虚线分隔 + 底部一行说明，像票根。 */
function Footer({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-dashed border-(--border) pt-2.5 text-[12px] whitespace-nowrap">
      <span className="text-(--text-muted)">{left}</span>
      <span className="font-medium text-(--lane-text)">{right}</span>
    </div>
  )
}

function DateStack({ day, align }: { day: number; align: 'left' | 'right' }) {
  return (
    <div className={align === 'right' ? 'text-right' : undefined}>
      <div className="text-[11px] leading-none tracking-wide text-(--text-muted) tabular-nums">
        {yearOf(day)}
      </div>
      <div className="mt-1 font-serif text-[20px] leading-tight font-bold whitespace-nowrap text-(--text) tabular-nums">
        {formatDay(day)}
      </div>
    </div>
  )
}

export function PhaseTip({ phase, today }: { phase: Phase; today: number }) {
  const lane = useLane(phase.laneId)
  const startDay = toDay(phase.start)
  const endDay = toDay(phase.end)
  const progress = phaseProgress(startDay, endDay, today)
  const current = !phase.tentative && !phase.done && progress.state === 'current'

  let status = { upcoming: '未开始', current: '进行中', ended: '已结束' }[progress.state]
  if (phase.tentative) status = '待确认'
  if (phase.done) status = '已完成'

  return (
    <>
      <Stripe dashed={phase.tentative} />
      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <LaneChip lane={lane} />
          <Pill solid={current} dashed={phase.tentative}>
            {phase.done && <Check aria-hidden className="size-3" strokeWidth={3} />}
            {status}
          </Pill>
        </div>
        <Title>{phase.name}</Title>

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <DateStack day={startDay} align="left" />
          <DateStack day={endDay - 1} align="right" />
        </div>
        <div aria-hidden className="relative mx-1 mt-3 h-1.5">
          <div
            className={
              'absolute inset-0 rounded-full bg-(--lane-fill) ' +
              (phase.tentative
                ? 'outline-1 -outline-offset-1 outline-(--lane-border) outline-dashed'
                : '')
            }
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-(--lane-solid)"
            style={{ width: `${progress.ratio * 100}%` }}
          />
          {progress.state === 'current' && (
            <span
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-(--bg-card) bg-(--today) shadow-sm"
              style={{ left: `${progress.ratio * 100}%` }}
            />
          )}
        </div>

        <Footer left={`共 ${formatDuration(endDay - startDay)}`} right={progress.label} />
      </div>
    </>
  )
}

export function MilestoneTip({ milestone, today }: { milestone: Milestone; today: number }) {
  const lane = useLane(milestone.laneId)
  const day = toDay(milestone.date)

  return (
    <>
      <Stripe />
      <div className="px-4 pt-3 pb-3.5">
        <div className="flex items-center justify-between gap-3">
          <LaneChip lane={lane} />
          <Pill solid={day === today && !milestone.done}>
            {milestone.done && <Check aria-hidden className="size-3" strokeWidth={3} />}
            {milestone.done ? '已完成' : '节点'}
          </Pill>
        </div>
        <Title>{milestone.name}</Title>

        <div className="mt-3.5 flex items-end justify-between gap-3">
          <DateStack day={day} align="left" />
          <div className="pb-0.5 text-[12px] text-(--text-muted)">{weekdayOf(day)}</div>
        </div>

        <Footer left="时间节点" right={countdownText(day, today)} />
      </div>
    </>
  )
}
