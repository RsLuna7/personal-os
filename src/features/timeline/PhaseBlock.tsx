import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from './days'
import { formatDuration, formatRangeWithYear } from './format'
import { ROW_HEIGHT } from './layout'
import { dayToX, type Scale } from './scale'
import { MIN_LABEL_WIDTH } from './useViewport'

interface PhaseBlockProps {
  phase: Phase
  scale: Scale
  top: number
  today: number
}

export function PhaseBlock({ phase, scale, top, today }: PhaseBlockProps) {
  const selected = useStore(
    (state) => state.selection?.kind === 'phase' && state.selection.id === phase.id,
  )
  const select = useStore((state) => state.select)

  const startDay = toDay(phase.start)
  const endDay = toDay(phase.end)
  const x = dayToX(scale, startDay)
  const width = (endDay - startDay) * scale.pxPerDay
  const range = formatRangeWithYear(startDay, endDay)
  const duration = `共 ${formatDuration(endDay - startDay)}`
  /** 色块左端滚出画面时，把名称推回可见区域 */
  const labelInset = Math.max(0, Math.min(-x, width - MIN_LABEL_WIDTH * 3))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          data-testid={`phase-${phase.id}`}
          data-anim
          role="button"
          tabIndex={0}
          aria-label={`${phase.name}，${range}，${duration}${phase.tentative ? '，待确认' : ''}`}
          data-past={String(endDay <= today)}
          data-tentative={String(phase.tentative)}
          data-selected={String(selected)}
          className="phase-block absolute left-0 flex cursor-pointer items-center rounded-[6px] border px-2 text-[14px] select-none"
          style={{
            transform: `translateX(${x}px)`,
            width: `${width}px`,
            top: `${top}px`,
            height: ROW_HEIGHT,
          }}
          onClick={() => select({ kind: 'phase', id: phase.id })}
        >
          {width >= MIN_LABEL_WIDTH && (
            <span className="truncate" title={phase.name} style={{ marginLeft: labelInset }}>
              {phase.name}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="font-medium">{phase.name}</div>
        <div>{range}</div>
        <div>
          {duration}
          {phase.tentative ? ' · 待确认' : ''}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
