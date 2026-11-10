import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Milestone } from '@/data/schema'
import { useStore } from '@/data/store'
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
}

export function MilestoneDot({ milestone, scale, today, nextX }: MilestoneDotProps) {
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
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-testid={`milestone-${milestone.id}`}
          data-anim
          role="button"
          tabIndex={0}
          aria-label={`${milestone.name}，${date}，${countdown}`}
          data-selected={String(selected)}
          className="milestone-dot absolute top-1.5 left-0 flex cursor-pointer items-center rounded-[6px] select-none"
          style={{
            transform: `translateX(${x}px)`,
            height: MILESTONE_BAND_HEIGHT,
            marginLeft: -DOT_SIZE / 2,
            gap: LABEL_GAP,
          }}
          onClick={() => select({ kind: 'milestone', id: milestone.id })}
        >
          <span
            className="shrink-0 rounded-full bg-(--lane-dot)"
            style={{ width: DOT_SIZE, height: DOT_SIZE }}
          />
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
      </TooltipContent>
    </Tooltip>
  )
}
