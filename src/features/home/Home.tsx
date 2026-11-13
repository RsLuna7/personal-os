import { useMemo, useState } from 'react'
import { useStore } from '@/data/store'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { LaneOverview } from './LaneOverview'
import { NowStrip } from './NowStrip'
import { activePhaseCount, isIdle, nextMilestone, summarizeLanes } from './summary'
import { TimelineCard } from './TimelineCard'
import { TodoBoard } from './TodoBoard'

/** 全局：现在的情况、整体时间线、各板块概览。 */
export function Home() {
  const data = useStore((state) => state.data)
  const today = useToday()
  // 从完整时间线收起回来时，卡片正在缩回原位，这时首页各块不再做入场动画（打开那一刻就定下来）
  const [enter] = useState(() => !document.documentElement.dataset.vt)
  const summaries = useMemo(() => summarizeLanes(data, today), [data, today])
  const upcoming = useMemo(() => nextMilestone(data, today), [data, today])
  const plannedLaneIds = useMemo(
    () => new Set(summaries.filter((summary) => !isIdle(summary)).map(({ lane }) => lane.id)),
    [summaries],
  )

  if (data.lanes.length === 0) return <EmptyState />

  return (
    <div
      data-testid="home"
      data-enter={String(enter)}
      className="min-h-0 flex-1 overflow-y-auto bg-(--bg-canvas)"
    >
      <div className="home-sections mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <NowStrip today={today} activeCount={activePhaseCount(summaries)} upcoming={upcoming} />
        <TimelineCard plannedLaneIds={plannedLaneIds} />
        <TodoBoard todos={data.todos} lanes={data.lanes} today={today} />
        <LaneOverview summaries={summaries} today={today} />
      </div>
    </div>
  )
}
