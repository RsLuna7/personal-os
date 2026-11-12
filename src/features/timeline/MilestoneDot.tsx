import { Check } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Milestone } from '@/data/schema'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { toDay } from './days'
import { countdownText, formatDayWithYear } from './format'
import { MILESTONE_BAND_HEIGHT } from './layout'
import { dayToX, type Scale } from './scale'
import { MIN_LABEL_WIDTH } from './useViewport'

const DOT_SIZE = 8
const LABEL_GAP = 4
const LABEL_MAX_WIDTH = 160

interface MilestoneDotProps {
  milestone: Milestone
  scale: Scale
  today: number
  /** 同一泳道里下一个节点的 x，用来截断名称 */
  nextX: number | null
  /** Just deleted: drawn for the fade-out only, inert and hidden from assistive tech. */
  exiting?: boolean
  /** 只看不改：不能聚焦或打开编辑面板，悬停提示仍然可用 */
  readOnly?: boolean
}

export function MilestoneDot({
  milestone,
  scale,
  today,
  nextX,
  exiting = false,
  readOnly = false,
}: MilestoneDotProps) {
  const selected = useStore(
    (state) => state.selection?.kind === 'milestone' && state.selection.id === milestone.id,
  )
  const select = useStore((state) => state.select)

  const day = toDay(milestone.date)
  const x = dayToX(scale, day)
  const room = nextX === null ? LABEL_MAX_WIDTH : nextX - x - DOT_SIZE - LABEL_GAP * 2
  const labelWidth = Math.min(LABEL_MAX_WIDTH, room)
  const date = formatDayWithYear(day)
  const countdown = countdownText(day, today)

  return (
    <Tooltip open={exiting ? false : undefined}>
      <TooltipTrigger asChild>
        <div
          data-testid={exiting ? undefined : `milestone-${milestone.id}`}
          data-anim
          data-exiting={String(exiting)}
          aria-hidden={exiting || undefined}
          role={exiting ? undefined : readOnly ? 'img' : 'button'}
          tabIndex={exiting ? -1 : readOnly ? undefined : 0}
          aria-label={`${milestone.name}，${date}，${countdown}${milestone.done ? '，已完成' : ''}`}
          data-done={String(milestone.done)}
          data-selected={String(selected)}
          className={
            'milestone-dot absolute top-1.5 left-0 flex items-center rounded-[6px] select-none ' +
            (readOnly ? 'cursor-default' : 'cursor-pointer')
          }
          style={{
            transform: `translateX(${x}px)`,
            height: MILESTONE_BAND_HEIGHT,
            marginLeft: -DOT_SIZE / 2,
            gap: LABEL_GAP,
          }}
          onClick={() => {
            if (exiting || readOnly) return
            select({ kind: 'milestone', id: milestone.id })
            openEditor('milestone', milestone.id)
          }}
          onFocus={() => {
            if (!exiting && !readOnly) select({ kind: 'milestone', id: milestone.id })
          }}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          {milestone.done ? (
            <Check aria-hidden className="size-3 shrink-0 text-(--lane-dot)" strokeWidth={3} />
          ) : (
            <span
              className="shrink-0 rounded-full bg-(--lane-dot)"
              style={{ width: DOT_SIZE, height: DOT_SIZE }}
            />
          )}
          {labelWidth >= MIN_LABEL_WIDTH && (
            <span
              className="truncate text-[12px] text-(--text)"
              title={milestone.name}
              style={{ maxWidth: labelWidth }}
            >
              {milestone.name}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{milestone.name}</div>
        <div>{date}</div>
        <div>{countdown}</div>
        {milestone.done && <div>已完成</div>}
      </TooltipContent>
    </Tooltip>
  )
}
