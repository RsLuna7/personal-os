import { Fragment, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useStore } from '@/data/store'
import { SectionHeader } from '@/features/home/SectionHeader'
import { fromDay, toDay } from '@/features/timeline/days'
import { formatDay, formatDayWithYear } from '@/features/timeline/format'
import { WEEK } from '@/features/timeline/snap'
import { useToday } from '@/features/timeline/useToday'
import {
  buildWeekReview,
  countItems,
  weekStartOf,
  type ReviewGroup,
  type ReviewItem,
} from './weekReview'

const KIND_TEXT = { phase: '阶段', milestone: '节点', todo: '待办' } as const

function whenText(item: ReviewItem): string {
  const first = formatDay(toDay(item.date))
  if (item.kind === 'phase' && item.lastDay && item.lastDay !== item.date) {
    return `${first} – ${formatDay(toDay(item.lastDay))}`
  }
  return first
}

function Section({
  id,
  title,
  hint,
  groups,
  empty,
}: {
  id: string
  title: string
  hint?: string
  groups: ReviewGroup[]
  empty: string
}) {
  const count = countItems(groups)
  return (
    <section aria-labelledby={id} data-testid={id}>
      <SectionHeader id={id} title={title}>
        <span className="text-[12px] text-(--text-muted)">
          {hint ? `${hint} · ` : ''}共 {count} 项
        </span>
      </SectionHeader>
      {groups.length === 0 ? (
        <p className="rounded-[16px] bg-(--bg-card) p-5 text-[14px] text-(--text-muted) shadow-(--shadow-card)">
          {empty}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((entry) => (
            <div
              key={entry.lane?.id ?? 'none'}
              data-lane-color={entry.lane?.color}
              data-testid={`${id}-${entry.lane?.id ?? 'none'}`}
              className="overflow-hidden rounded-[16px] bg-(--bg-card) shadow-(--shadow-card)"
            >
              <h3 className="flex items-center gap-2 bg-(--lane-fill,var(--bg-subtle)) px-5 py-3 text-[14px] font-semibold text-(--lane-text,var(--text))">
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full bg-(--lane-dot,var(--text-muted))"
                />
                <span className="truncate">{entry.lane?.name ?? '未归入板块'}</span>
              </h3>
              <ul className="flex flex-col gap-2 p-5">
                {entry.items.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="flex items-baseline gap-2">
                    <span className="shrink-0 rounded-[4px] bg-(--bg-subtle) px-1.5 text-[12px] text-(--text-muted)">
                      {KIND_TEXT[item.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px]" title={item.name}>
                      {item.name}
                    </span>
                    {item.tag && (
                      <span className="shrink-0 text-[12px] text-(--text-muted)">{item.tag}</span>
                    )}
                    <span className="shrink-0 text-[12px] text-(--text-muted)">
                      {whenText(item)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/** 回顾：选一周，看这周完成了什么、哪些逾期没做、下周什么到期。只读。 */
export function ReviewPage() {
  const data = useStore((state) => state.data)
  const today = useToday()
  const thisWeek = weekStartOf(fromDay(today))
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const shown = weekStart ?? thisWeek
  const review = useMemo(() => buildWeekReview(data, shown, fromDay(today)), [data, shown, today])

  const shift = (weeks: number) => setWeekStart(fromDay(toDay(shown) + weeks * WEEK))
  const range = `${formatDayWithYear(toDay(review.weekStart))} – ${formatDay(toDay(review.weekEnd))}`

  return (
    <div data-testid="review" className="min-h-0 flex-1 overflow-y-auto bg-(--bg-canvas)">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-auto font-serif text-[22px] font-bold">回顾</h1>
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>
            <ChevronLeftIcon aria-hidden />
            上一周
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={shown === thisWeek}
            onClick={() => setWeekStart(null)}
          >
            本周
          </Button>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>
            下一周
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
        <p data-testid="review-range" className="-mt-3 text-[14px] text-(--text-muted)">
          {range}
          {shown === thisWeek ? '（本周）' : ''}
        </p>
        {/* 换一周时三组整块重新挂载，入场动画再播一遍 */}
        <Fragment key={shown}>
          <Section
            id="review-done"
            title="本周完成"
            groups={review.done}
            empty="这一周还没有标记完成的事项。"
          />
          <Section
            id="review-overdue"
            title="逾期未完成"
            hint="截至今天"
            groups={review.overdue}
            empty="没有逾期未完成的事项。"
          />
          <Section
            id="review-upcoming"
            title="下周到期"
            groups={review.upcoming}
            empty="下一周没有到期的事项。"
          />
        </Fragment>
      </div>
    </div>
  )
}
