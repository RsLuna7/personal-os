import { LaneMenu } from '@/features/editor/LaneMenu'
import type { LaneSummary } from '@/features/home/summary'
import { toDay } from '@/features/timeline/days'
import { countdownText, formatDay } from '@/features/timeline/format'

interface LaneHeaderProps {
  summary: LaneSummary
  today: number
}

/** 板块页顶部：大标题和一行摘要，摘要的内容和主页的板块概览卡一致。 */
export function LaneHeader({ summary, today }: LaneHeaderProps) {
  const { lane, current, alsoActive, progress, daysLeft, next, nextMilestone } = summary
  const percent = progress === null ? 0 : Math.round(progress * 100)

  const parts: string[] = []
  if (current) {
    parts.push(
      `当前：${current.name}${current.tentative ? '（待确认）' : ''}`,
      `已过 ${percent}% · 还剩 ${daysLeft} 天`,
    )
    if (alsoActive.length > 0)
      parts.push(`同时进行：${alsoActive.map((phase) => phase.name).join('、')}`)
  } else {
    parts.push('暂无进行中阶段')
  }
  if (nextMilestone) {
    parts.push(
      `下一个节点：${nextMilestone.name} · ${countdownText(toDay(nextMilestone.date), today)}`,
    )
  }
  if (next) {
    parts.push(`下一阶段：${next.name} · ${formatDay(toDay(next.start))}开始`)
  }

  return (
    <header
      data-lane-color={lane.color}
      className="rounded-[16px] bg-(--bg-card) px-6 py-5 shadow-(--shadow-card)"
    >
      <div className="flex items-center gap-3">
        <span aria-hidden className="size-3 shrink-0 rounded-full bg-(--lane-dot)" />
        <h1 className="min-w-0">
          <LaneMenu laneId={lane.id} variant="title" />
        </h1>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-(--text-muted)">
        {parts.map((part) => (
          <span key={part}>{part}</span>
        ))}
      </p>
    </header>
  )
}
