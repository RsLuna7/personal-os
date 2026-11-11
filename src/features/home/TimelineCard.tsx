import { Maximize2Icon } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Timeline } from '@/features/timeline/Timeline'
import { ZoomControls } from '@/features/timeline/ZoomControls'

/** 主页里的时间线：只看不改，要编辑点“展开”。 */
export function TimelineCard() {
  return (
    <section
      aria-labelledby="timeline-card-title"
      className="overflow-hidden rounded-[12px] border border-(--border) bg-(--bg-page)"
    >
      <header className="flex items-center gap-2 border-b border-(--border) px-4 py-2.5">
        <h2 id="timeline-card-title" className="mr-auto text-[14px] font-medium text-(--text)">
          时间线
        </h2>
        <ZoomControls />
        <a href="#/timeline" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <Maximize2Icon className="size-3.5" aria-hidden />
          展开
        </a>
      </header>
      <Timeline readOnly className="max-h-[420px]" />
    </section>
  )
}
