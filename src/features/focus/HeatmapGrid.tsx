import { formatDay } from '@/features/timeline/format'
import { weekdayOf } from '@/features/today/habits'
import { HEATMAP_WEEKS, type Heatmap } from './stats'

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
/** 左侧只标这几行，免得挤 */
const LABELLED_ROWS = [0, 2, 4]
const CELL = 14
const GAP = 3

/** 日历热力图：每列一周，周一在上，每格是这一天专注的总分钟数。 */
export function HeatmapGrid({ map }: { map: Heatmap }) {
  const width = map.columns.length * (CELL + GAP) - GAP
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-2" style={{ width: 'max-content' }}>
        <div
          aria-hidden
          className="grid pt-[18px] text-[11px] text-(--text-muted)"
          style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP }}
        >
          {WEEKDAY_NAMES.map((name, row) => (
            <span key={name} className="leading-[14px]">
              {LABELLED_ROWS.includes(row) ? name : ''}
            </span>
          ))}
        </div>
        <div>
          <div
            aria-hidden
            className="relative h-[18px] text-[11px] text-(--text-muted)"
            style={{ width }}
          >
            {map.months.map(({ column, month }) => (
              <span
                key={column}
                className="absolute top-0 leading-[14px]"
                style={{ left: column * (CELL + GAP) }}
              >
                {month}月
              </span>
            ))}
          </div>
          <div
            role="group"
            aria-label={`最近 ${HEATMAP_WEEKS} 周的专注热力图`}
            className="grid"
            style={{
              gridAutoFlow: 'column',
              gridTemplateRows: `repeat(7, ${CELL}px)`,
              gridAutoColumns: `${CELL}px`,
              gap: GAP,
            }}
          >
            {map.columns.flat().map((cell) => {
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
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
