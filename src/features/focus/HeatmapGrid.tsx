import { formatDay } from '@/features/timeline/format'
import { weekdayOf } from '@/features/today/habits'
import { HEATMAP_WEEKS, type Heatmap } from './stats'

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
/** 左侧只标这几行，免得挤 */
const LABELLED_ROWS = [0, 2, 4]

/**
 * 日历热力图：每列一周，周一在上，每格是这一天专注的总分钟数。
 * 格子随卡片宽度伸缩（始终是正方形），任何宽度下都放得下 26 周，不会横向滚动。
 */
export function HeatmapGrid({ map }: { map: Heatmap }) {
  return (
    <div
      className="grid max-w-[620px] gap-[3px]"
      style={{
        gridTemplateColumns: `24px repeat(${map.columns.length}, minmax(0, 1fr))`,
        gridTemplateRows: '16px',
      }}
    >
      {map.months.map(({ column, month }) => (
        <span
          key={column}
          aria-hidden
          className="text-[11px] leading-[16px] whitespace-nowrap text-(--text-muted)"
          style={{ gridRow: 1, gridColumn: `${column + 2} / span 3` }}
        >
          {month}月
        </span>
      ))}
      {LABELLED_ROWS.map((row) => (
        <span
          key={row}
          aria-hidden
          className="self-center text-[11px] leading-none text-(--text-muted)"
          style={{ gridRow: row + 2, gridColumn: 1 }}
        >
          {WEEKDAY_NAMES[row]}
        </span>
      ))}
      <div role="group" aria-label={`最近 ${HEATMAP_WEEKS} 周的专注热力图`} className="contents">
        {map.columns.map((column, c) =>
          column.map((cell, row) => {
            const label = `${formatDay(cell.day)} ${WEEKDAY_NAMES[weekdayOf(cell.day) - 1]} · ${cell.minutes} 分钟`
            return (
              <span
                key={cell.day}
                role="img"
                aria-label={label}
                title={label}
                data-level={cell.level}
                data-future={cell.future || undefined}
                className="heat-cell"
                style={{ gridRow: row + 2, gridColumn: c + 2 }}
              />
            )
          }),
        )}
      </div>
    </div>
  )
}
