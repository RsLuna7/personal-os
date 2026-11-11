import { useId, useMemo, useState } from 'react'
import { ChevronRightIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { addMilestoneToLane, addPhaseToLane } from '@/features/editor/AddMenu'
import { openEditor, useEditorStore } from '@/features/editor/editorStore'
import { toDay } from '@/features/timeline/days'
import { countdownText, formatDay, formatRange } from '@/features/timeline/format'
import { buildLaneItems, PHASE_STATUS_TEXT, type LaneItem } from './items'

interface ItemRowProps {
  item: LaneItem
  today: number
  selected: boolean
}

function ItemRow({ item, today, selected }: ItemRowProps) {
  const select = useStore((state) => state.select)
  const isPhase = item.kind === 'phase'
  const name = isPhase ? item.phase.name : item.milestone.name
  const date = isPhase
    ? formatRange(toDay(item.phase.start), toDay(item.phase.end))
    : formatDay(toDay(item.milestone.date))
  const status = isPhase
    ? PHASE_STATUS_TEXT[item.status]
    : countdownText(toDay(item.milestone.date), today)

  return (
    <li>
      <button
        type="button"
        // 编辑面板按这个标记找到要贴着的元素（和时间线上的色块用同一个）
        data-testid={`${item.kind}-${item.id}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          select({ kind: item.kind, id: item.id })
          openEditor(item.kind, item.id)
        }}
        className={
          'flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left text-[14px] transition-colors duration-(--dur-fast) ease-(--ease-out) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text) ' +
          (selected ? 'bg-(--lane-fill)' : 'hover:bg-(--bg-subtle)')
        }
      >
        {isPhase ? (
          <span
            aria-hidden
            className="h-3 w-5 shrink-0 rounded-[3px] border border-(--lane-border) bg-(--lane-fill)"
          />
        ) : (
          <span aria-hidden className="mx-1 size-3 shrink-0 rounded-full bg-(--lane-dot)" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium text-(--text)" title={name}>
          {name}
        </span>
        <span className="shrink-0 text-[12px] text-(--text-muted)">{date}</span>
        <span className="w-20 shrink-0 text-right text-[12px] text-(--text-muted)">{status}</span>
      </button>
    </li>
  )
}

/** 板块的阶段和节点按时间混排；已结束的折叠起来。 */
export function ItemsCard({ lane, today }: { lane: Lane; today: number }) {
  const select = useStore((state) => state.select)
  const phases = useStore((state) => state.data.phases)
  const milestones = useStore((state) => state.data.milestones)
  const selection = useStore((state) => state.selection)
  const editing = useEditorStore((state) => state.editing)
  const [showEnded, setShowEnded] = useState(false)
  const titleId = useId()

  const { current, ended } = useMemo(
    () => buildLaneItems(lane.id, phases, milestones, today),
    [lane.id, phases, milestones, today],
  )

  // 正在选中或编辑的已结束项不能被折叠藏起来
  const pointsAt = (item: LaneItem) =>
    (selection?.kind === item.kind && selection.id === item.id) ||
    (editing?.kind === item.kind && editing.id === item.id)
  const expanded = showEnded || ended.some(pointsAt)

  const isSelected = (item: LaneItem) => selection?.kind === item.kind && selection.id === item.id

  return (
    <section
      aria-labelledby={titleId}
      data-lane-color={lane.color}
      className="rounded-[16px] bg-(--bg-card) p-5 shadow-(--shadow-card)"
    >
      <div className="mb-3 flex items-center gap-2">
        <h2 id={titleId} className="mr-auto font-serif text-[18px] font-bold text-(--text)">
          阶段与节点
        </h2>
        <Button variant="outline" size="sm" onClick={() => addPhaseToLane(lane.id)}>
          <PlusIcon className="size-3.5" aria-hidden />
          添加阶段
        </Button>
        <Button variant="outline" size="sm" onClick={() => addMilestoneToLane(lane.id)}>
          <PlusIcon className="size-3.5" aria-hidden />
          添加节点
        </Button>
      </div>

      {current.length === 0 && ended.length === 0 ? (
        <p className="text-[14px] text-(--text-muted)">这个板块还没有阶段和节点</p>
      ) : (
        <>
          {ended.length > 0 && (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                // 因为选中而自动展开时，收起要同时放掉选中，否则按钮像坏了
                if (expanded && selection && ended.some(isSelected)) select(null)
                setShowEnded(!expanded)
              }}
              className="mb-1 flex items-center gap-1 rounded-[6px] px-2 py-1 text-[12px] text-(--text-muted) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-subtle) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
            >
              <ChevronRightIcon
                className={'size-3.5 transition-transform ' + (expanded ? 'rotate-90' : '')}
                aria-hidden
              />
              已结束 {ended.length} 项
            </button>
          )}
          <ul className="flex flex-col gap-0.5">
            {/* 一个列表：编辑时日期跨过今天，行只是换位置，不会重新挂载 */}
            {(expanded ? [...ended, ...current] : current).map((item) => (
              <ItemRow key={item.id} item={item} today={today} selected={isSelected(item)} />
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
