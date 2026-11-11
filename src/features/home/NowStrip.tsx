import { formatDay } from '@/features/timeline/format'
import type { UpcomingMilestone } from './summary'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface NowStripProps {
  today: number
  /** 正在进行的阶段个数（每个板块最多算一个） */
  activeCount: number
  upcoming: UpcomingMilestone | null
}

/** 主页最上面一块：今天是哪天、几个阶段在进行、下一个节点还有几天。 */
export function NowStrip({ today, activeCount, upcoming }: NowStripProps) {
  const weekday = WEEKDAYS[new Date(today * 86_400_000).getUTCDay()]

  return (
    <section
      aria-label="现在"
      data-testid="now-strip"
      className="flex items-stretch gap-8 rounded-[16px] bg-(--bg-card) px-6 py-5 shadow-(--shadow-card)"
    >
      <div className="flex items-stretch gap-4">
        <span aria-hidden className="w-1.5 rounded-full bg-(--today)" />
        <div>
          <div className="text-[12px] text-(--text-muted)">今天</div>
          <div className="font-serif text-[26px] leading-tight font-bold text-(--text)">
            {formatDay(today)} 周{weekday}
          </div>
        </div>
      </div>
      <div className="self-center text-[14px] text-(--text-muted)">
        {activeCount > 0 ? (
          <>
            <span className="mr-1 font-serif text-[26px] font-bold text-(--text)">
              {activeCount}
            </span>
            个阶段进行中
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
            className="flex items-center justify-end gap-4"
          >
            <div>
              <div className="flex items-center justify-end gap-2 text-[16px] font-semibold text-(--text)">
                <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--lane-dot)" />
                {upcoming.milestone.name}
              </div>
              <div className="text-[12px] text-(--text-muted)">
                {upcoming.lane.name} · {formatDay(today + upcoming.inDays)}
              </div>
            </div>
            <div className="rounded-[10px] bg-(--lane-solid) px-3 py-1.5 text-(--lane-solid-text)">
              {upcoming.inDays === 0 ? (
                <span className="text-[16px] font-semibold">就是今天</span>
              ) : (
                <>
                  <span className="font-serif text-[26px] leading-none font-bold">
                    {upcoming.inDays}
                  </span>
                  <span className="ml-1 text-[12px]">天后</span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-[14px] text-(--text-muted)">暂无即将到来的节点</div>
        )}
      </div>
    </section>
  )
}
