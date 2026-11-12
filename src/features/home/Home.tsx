import { useMemo } from 'react'
import { useStore } from '@/data/store'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { LaneOverview } from './LaneOverview'
import { NowStrip } from './NowStrip'
import { activePhaseCount, nextMilestone, summarizeLanes } from './summary'
import { TimelineCard } from './TimelineCard'

/** 全局：现在的情况、整体时间线、各板块概览。 */
export function Home() {
  const data = useStore((state) => state.data)
  const today = useToday()
  const summaries = useMemo(() => summarizeLanes(data, today), [data, today])
  const upcoming = useMemo(() => nextMilestone(data, today), [data, today])

  if (data.lanes.length === 0) return <EmptyState />

  return (
    <div data-testid="home" className="min-h-0 flex-1 overflow-y-auto bg-(--bg-canvas)">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <NowStrip today={today} activeCount={activePhaseCount(summaries)} upcoming={upcoming} />
        <TimelineCard />
        <LaneOverview summaries={summaries} today={today} />
      </div>
    </div>
  )
}
