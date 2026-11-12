import { formatDay } from '@/features/timeline/format'
import { BIG, SOON_DAYS, Stat, UNIT } from './Stat'
import type { UpcomingMilestone } from './summary'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface NowStripProps {
  today: number
  /** 正在进行的阶段个数（同一板块里同时进行的都算） */
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
      className="flex items-stretch rounded-[16px] bg-(--bg-card) px-6 py-4 shadow-(--shadow-card) [&>*+*]:ml-8 [&>*+*]:border-l [&>*+*]:border-(--border) [&>*+*]:pl-8"
    >
      <div className="flex shrink-0 items-stretch gap-4">
        <span aria-hidden className="now-today-bar w-1.5 rounded-full bg-(--today)" />
        <Stat label="今天">
          <span className={BIG}>
            {formatDay(today)} 周{weekday}
          </span>
        </Stat>
      </div>

      {/* 没有进行中的阶段时不显示：板块概览卡片里已经写了 */}
      {activeCount > 0 && (
        <div className="shrink-0">
          <Stat label="进行中">
            <span className={BIG}>{activeCount}</span>
            <span className={UNIT}>个阶段</span>
          </Stat>
        </div>
      )}

      {/* 没有即将到来的节点时整块不显示 */}
      {upcoming && (
        <div
          data-lane-color={upcoming.lane.color}
          data-soon={String(upcoming.inDays <= SOON_DAYS)}
          className="min-w-0"
        >
          {/* 和另外两格一样只有一个大字（倒计时）；节点名和板块、日期放在下面一行 */}
          <Stat
            label="下一个节点"
            note={
              <span
                title={`${upcoming.milestone.name} · ${upcoming.lane.name} · ${formatDay(today + upcoming.inDays)}`}
              >
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-2 rounded-full bg-(--lane-dot) align-middle"
                />
                <span className="font-medium text-(--text)">{upcoming.milestone.name}</span>
                {` · ${upcoming.lane.name} · ${formatDay(today + upcoming.inDays)}`}
              </span>
            }
          >
            {upcoming.inDays === 0 ? (
              <span className={BIG}>今天</span>
            ) : (
              <>
                <span className={BIG}>{upcoming.inDays}</span>
                <span className={UNIT}>天后</span>
              </>
            )}
          </Stat>
        </div>
      )}
    </section>
  )
}
