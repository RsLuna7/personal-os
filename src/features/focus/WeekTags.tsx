import { formatDuration, tagColor, type TagTotal } from './stats'

/** 本周每个标签用了多少时间：色点、名字、横条、时长。 */
export function WeekTags({ rows }: { rows: TagTotal[] }) {
  if (rows.length === 0) {
    return <p className="py-2 text-[14px] text-(--text-muted)">本周还没有专注记录</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((row) => (
        <li
          key={row.tag}
          data-testid={`week-tag-${row.tag}`}
          data-lane-color={tagColor(row.tag)}
          className="grid min-h-9 grid-cols-[minmax(64px,auto)_1fr_auto] items-center gap-3 text-[14px]"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span aria-hidden className="lane-chip-dot shrink-0" />
            <span className="truncate font-medium">{row.tag}</span>
          </span>
          <span aria-hidden className="h-2 overflow-hidden rounded-full bg-(--sand-4)">
            <span
              className="block h-full rounded-full bg-(--lane-dot) transition-[width] duration-(--dur-slow) ease-(--ease-out)"
              style={{ width: `${Math.max(row.ratio, 0.03) * 100}%` }}
            />
          </span>
          <span className="w-[72px] text-right text-[13px] text-(--text-muted) tabular-nums">
            {formatDuration(row.ms)}
          </span>
        </li>
      ))}
    </ul>
  )
}
