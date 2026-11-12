import { LaneMenu } from '@/features/editor/LaneMenu'
import { BIG, Stat, UNIT } from '@/features/home/Stat'
import type { LaneSummary } from '@/features/home/summary'
import { toDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'

/** 下一个节点在这么多天之内，倒计时换成醒目的颜色 */
export const SOON_DAYS = 3

interface LaneHeaderProps {
  summary: LaneSummary
  today: number
}

/**
 * 板块页顶部：大标题，下面三格——当前阶段（带进度条）、下一个节点（倒计时）、下一阶段。
 * 格子的样式和主页“现在”一条一致；没有节点或下一阶段时，那一格不显示。
 */
export function LaneHeader({ summary, today }: LaneHeaderProps) {
  const { lane, current, alsoActive, progress, daysLeft, next, nextMilestone } = summary
  const percent = progress === null ? 0 : Math.round(progress * 100)
  const elapsed = current ? today - toDay(current.start) + 1 : 0
  const total = current ? toDay(current.end) - toDay(current.start) : 0
  const inDays = nextMilestone ? toDay(nextMilestone.date) - today : null
  const soon = inDays !== null && inDays <= SOON_DAYS
  const countClass = soon ? BIG.replace('text-(--text)', 'text-(--brand)') : BIG

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

      {/* 窄一些时当前阶段单独一行，节点和下一阶段并排在下面；够宽（lg）才三格一行 */}
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-(--border) pt-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div data-testid="lane-stat-current" className="col-span-2 min-w-0 lg:col-span-1">
          {current ? (
            <>
              <Stat label="当前阶段">
                <span className={`${BIG} truncate`} title={current.name}>
                  {current.name}
                </span>
                {current.tentative && <span className={UNIT}>待确认</span>}
              </Stat>
              <div className="mt-2 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-label={`${current.name}进度`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percent}
                  className="h-2 flex-1 overflow-hidden rounded-full bg-(--lane-fill)"
                >
                  <div
                    className="h-full rounded-full bg-(--lane-solid)"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="shrink-0 text-[12px] text-(--text-muted) tabular-nums">
                  {percent}%
                </span>
              </div>
              <div className="mt-1.5 text-[12px] text-(--text-muted)">
                第 {elapsed} 天 / 共 {total} 天 · 还剩 {daysLeft} 天
              </div>
              {alsoActive.length > 0 && (
                <div className="mt-0.5 truncate text-[12px] text-(--text-muted)">
                  同时进行：{alsoActive.map((phase) => phase.name).join('、')}
                </div>
              )}
            </>
          ) : (
            <Stat label="当前阶段">
              <span className="text-[16px] leading-[34px] text-(--text-muted)">暂无进行中阶段</span>
            </Stat>
          )}
        </div>

        {nextMilestone && inDays !== null && (
          <div data-testid="lane-stat-milestone" data-soon={String(soon)} className="min-w-0">
            <Stat
              label="下一个节点"
              note={
                <span title={`${nextMilestone.name} · ${formatDay(toDay(nextMilestone.date))}`}>
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block size-2 rotate-45 bg-(--lane-dot) align-middle"
                  />
                  <span className="font-medium text-(--text)">{nextMilestone.name}</span>
                  {` · ${formatDay(toDay(nextMilestone.date))}`}
                </span>
              }
            >
              {/* 三天之内用品牌橙色提醒 */}
              {inDays === 0 ? (
                <span className={countClass}>今天</span>
              ) : (
                <>
                  <span className={countClass}>{inDays}</span>
                  <span className={UNIT}>天后</span>
                </>
              )}
            </Stat>
          </div>
        )}

        {next && (
          <div data-testid="lane-stat-next" className="min-w-0">
            <Stat
              label="下一阶段"
              note={
                <span className="font-medium text-(--text)" title={next.name}>
                  {next.name}
                </span>
              }
            >
              <span className={BIG}>{formatDay(toDay(next.start))}</span>
              <span className={UNIT}>开始</span>
            </Stat>
          </div>
        )}
      </div>
    </header>
  )
}
