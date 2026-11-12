import { Maximize2Icon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Timeline } from '@/features/timeline/Timeline'
import { ZoomControls } from '@/features/timeline/ZoomControls'
import { SectionHeader } from './SectionHeader'

/** 主页里的时间线：只看不改，要编辑点“展开”。 */
export function TimelineCard() {
  return (
    <section aria-labelledby="timeline-card-title">
      <SectionHeader id="timeline-card-title" title="时间线">
        <ZoomControls />
        <a href="#/timeline" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Maximize2Icon className="size-3.5" aria-hidden />
          展开
        </a>
      </SectionHeader>
      <div className="overflow-hidden rounded-[16px] bg-(--bg-card) shadow-(--shadow-card)">
        <Timeline readOnly className="max-h-[420px]" />
      </div>
    </section>
  )
}
