import { laneHref } from '@/features/lane/select'
import { countdownText, formatDay } from '@/features/timeline/format'
import { toDay } from '@/features/timeline/days'
import { SectionHeader } from './SectionHeader'
import { isIdle, type LaneSummary } from './summary'

interface LaneCardProps {
  summary: LaneSummary
  today: number
}

function LaneCard({ summary, today }: LaneCardProps) {
  const { lane, current, alsoActive, progress, daysLeft, next, nextMilestone } = summary
  const percent = progress === null ? 0 : Math.round(progress * 100)
  const elapsed = current ? today - toDay(current.start) + 1 : 0
  const total = current ? toDay(current.end) - toDay(current.start) : 0

  return (
    <a
      href={laneHref(lane.id)}
      data-lane-color={lane.color}
      data-testid={`overview-${lane.id}`}
      className="flex flex-col overflow-hidden rounded-[16px] bg-(--bg-card) shadow-(--shadow-card) transition-shadow duration-(--dur-fast) ease-(--ease-out) hover:shadow-(--shadow-card-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
    >
      <h3 className="flex items-center gap-2 bg-(--lane-fill) px-5 py-3 text-[14px] font-semibold text-(--lane-text)">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-(--lane-dot)" />
        <span className="truncate" title={lane.name}>
          {lane.name}
        </span>
      </h3>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {current ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span
                className="truncate font-serif text-[22px] leading-tight font-bold text-(--text)"
                title={current.name}
              >
                {current.name}
              </span>
              {current.tentative && (
                <span className="shrink-0 text-[12px] text-(--text-muted)">待确认</span>
              )}
            </div>
            <div
              role="progressbar"
              aria-label={`${current.name}进度`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="mt-3 h-2.5 overflow-hidden rounded-full bg-(--lane-fill)"
            >
              <div
                className="h-full rounded-full bg-(--lane-solid)"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 text-[12px] text-(--text-muted)">
              第 {elapsed} 天 / 共 {total} 天 · 还剩 {daysLeft} 天
            </div>
            {/* 同一板块同时进行的其他阶段，不然在卡片上看不到 */}
            {alsoActive.length > 0 && (
              <div className="mt-1 truncate text-[12px] text-(--text-muted)">
                还有「{alsoActive[0].name}」
                {alsoActive.length > 1 ? `等 ${alsoActive.length} 个阶段` : ''}同时进行
              </div>
            )}
          </div>
        ) : (
          <div className="text-[16px] text-(--text-muted)">暂无进行中阶段</div>
        )}

        <dl className="mt-auto flex flex-col gap-1.5 border-t border-(--border) pt-3 text-[12px] text-(--text-muted)">
          {nextMilestone && (
            <div className="flex gap-2">
              <dt className="shrink-0">下一个节点</dt>
              <dd className="min-w-0 truncate text-(--text)">
                {nextMilestone.name} · {countdownText(toDay(nextMilestone.date), today)}
              </dd>
            </div>
          )}
          {next && (
            <div className="flex gap-2">
              <dt className="shrink-0">下一阶段</dt>
              <dd className="min-w-0 truncate text-(--text)">
                {next.name} · {formatDay(toDay(next.start))}开始
              </dd>
            </div>
          )}
          {!nextMilestone && !next && <div>后面还没有安排</div>}
        </dl>
      </div>
    </a>
  )
}

interface LaneOverviewProps {
  summaries: LaneSummary[]
  today: number
}

/** 后面什么都没安排的板块：收成一排小标签，点进去就是板块页。 */
function IdleLanes({ summaries }: { summaries: LaneSummary[] }) {
  return (
    <div
      data-testid="idle-lanes"
      className="flex flex-wrap items-center gap-2 text-[13px] text-(--text-muted)"
    >
      <span className="mr-1">还没有安排</span>
      {summaries.map(({ lane }) => (
        <a
          key={lane.id}
          href={laneHref(lane.id)}
          data-lane-color={lane.color}
          data-testid={`idle-${lane.id}`}
          className="flex max-w-[200px] items-center gap-1.5 rounded-full border border-(--border) bg-(--bg-card) px-3 py-1 text-(--text) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-subtle) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-(--lane-dot)" />
          <span className="truncate" title={lane.name}>
            {lane.name}
          </span>
        </a>
      ))}
    </div>
  )
}

/**
 * 有安排的板块各一张小卡：当前阶段、进度、下一个节点和下一阶段。
 * 后面什么都没安排的板块不占大卡片，收在下面一排小标签里。
 */
export function LaneOverview({ summaries, today }: LaneOverviewProps) {
  const planned = summaries.filter((summary) => !isIdle(summary))
  const idle = summaries.filter(isIdle)
  return (
    <section aria-labelledby="lane-overview-title">
      <SectionHeader id="lane-overview-title" title="板块概览" />
      {planned.length > 0 && (
        <div className="mb-4 grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {planned.map((summary) => (
            <LaneCard key={summary.lane.id} summary={summary} today={today} />
          ))}
        </div>
      )}
      {idle.length > 0 && <IdleLanes summaries={idle} />}
    </section>
  )
}
