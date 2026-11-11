import type { UpcomingMilestone } from './summary'
import { formatDay } from '@/features/timeline/format'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface NowStripProps {
  today: number
  /** 正在进行的阶段个数（每个板块最多算一个） */
  activeCount: number
  upcoming: UpcomingMilestone | null
}

function countdown(inDays: number): string {
  return inDays === 0 ? '就是今天' : `还有 ${inDays} 天`
}

/** 主页最上面一行：今天是哪天、几个阶段在进行、下一个节点还有几天。 */
export function NowStrip({ today, activeCount, upcoming }: NowStripProps) {
  const weekday = WEEKDAYS[new Date(today * 86_400_000).getUTCDay()]

  return (
    <section
      aria-label="现在"
      data-testid="now-strip"
      className="flex items-center gap-x-8 gap-y-2 rounded-[12px] border border-(--border) bg-(--bg-subtle) px-5 py-4"
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="h-8 w-0.5 rounded-full bg-(--today)" />
        <div>
          <div className="text-[12px] text-(--text-muted)">今天</div>
          <div className="text-[16px] font-medium text-(--text)">
            {formatDay(today)} 周{weekday}
          </div>
        </div>
      </div>
      <div className="text-[14px] text-(--text-muted)">
        {activeCount > 0 ? (
          <>
            <span className="font-medium text-(--text)">{activeCount}</span> 个阶段进行中
          </>
        ) : (
          '没有进行中的阶段'
        )}
      </div>
      <div className="ml-auto text-right">
        <div className="text-[12px] text-(--text-muted)">下一个节点</div>
        {upcoming ? (
          <div
            data-lane-color={upcoming.lane.color}
            className="flex items-center justify-end gap-2 text-[14px] text-(--text)"
          >
            <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
            <span className="font-medium">{upcoming.milestone.name}</span>
            <span className="text-(--text-muted)">
              {upcoming.lane.name} · {formatDay(today + upcoming.inDays)} ·{' '}
              {countdown(upcoming.inDays)}
            </span>
          </div>
        ) : (
          <div className="text-[14px] text-(--text-muted)">暂无即将到来的节点</div>
        )}
      </div>
    </section>
  )
}
