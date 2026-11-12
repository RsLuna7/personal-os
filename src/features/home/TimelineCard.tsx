import { Maximize2Icon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Timeline } from '@/features/timeline/Timeline'
import { ZoomControls } from '@/features/timeline/ZoomControls'
import { SectionHeader } from './SectionHeader'

interface TimelineCardProps {
  /** 要画出来的板块：后面什么都没安排的板块不占一行，和板块概览一致 */
  plannedLaneIds: ReadonlySet<string>
}

/** 主页里的时间线：只看不改，要编辑点“展开”。完整时间线里照常画出全部板块。 */
export function TimelineCard({ plannedLaneIds }: TimelineCardProps) {
  return (
    <section aria-labelledby="timeline-card-title">
      <SectionHeader id="timeline-card-title" title="时间线">
        <ZoomControls />
        <a href="#/timeline" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Maximize2Icon className="size-3.5" aria-hidden />
          展开
        </a>
      </SectionHeader>
      {/* vt-timeline：点“展开”时这张卡片放大成完整时间线，见 index.css */}
      <div className="vt-timeline overflow-hidden rounded-[16px] bg-(--bg-card) shadow-(--shadow-card)">
        <Timeline readOnly className="max-h-[420px]" laneIds={plannedLaneIds} />
      </div>
    </section>
  )
}
