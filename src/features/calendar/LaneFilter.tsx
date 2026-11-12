import type { Lane } from '@/data/schema'
import { NEUTRAL } from './cells'

interface LaneFilterProps {
  lanes: Lane[]
  /** 有没有不挂板块的待办：有才多一个“未分类” */
  hasNeutral: boolean
  active: ReadonlySet<string>
  onToggle: (key: string) => void
  onClear: () => void
}

/**
 * 页头右侧的板块图例：一个色点加板块名，说明格子里每种颜色是什么。
 * 点一个只看这个板块（可以多选），再点取消；有筛选时右边出现“显示全部”。
 */
export function LaneFilter({ lanes, hasNeutral, active, onToggle, onClear }: LaneFilterProps) {
  const items = [
    ...[...lanes]
      .sort((a, b) => a.order - b.order)
      .map((lane) => ({
        key: lane.id,
        name: lane.name,
        color: lane.color as string,
      })),
    ...(hasNeutral ? [{ key: NEUTRAL, name: '未分类', color: NEUTRAL }] : []),
  ]
  if (items.length === 0) return null
  const filtering = active.size > 0
  return (
    <div className="ml-auto flex min-w-0 items-center pl-6">
      <div
        role="group"
        aria-label="按板块筛选"
        data-testid="lane-filter"
        className="lane-filter flex min-w-0 items-center gap-1 overflow-x-auto"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={active.has(item.key)}
            data-lane-color={item.color}
            data-dim={String(filtering && !active.has(item.key))}
            className="lane-chip"
            onClick={() => onToggle(item.key)}
          >
            <span aria-hidden className="lane-chip-dot" />
            {item.name}
          </button>
        ))}
      </div>
      {/* 放在滚动区外面：图例再长，“显示全部”也始终看得到 */}
      {filtering && (
        <button type="button" className="lane-chip lane-chip-clear" onClick={onClear}>
          显示全部
        </button>
      )}
    </div>
  )
}
