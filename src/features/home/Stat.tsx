import type { ReactNode } from 'react'

/** 大字：每格的主数值，字号统一，几格的基线才能对齐 */
export const BIG = 'font-serif text-[26px] leading-tight font-bold text-(--text)'
/** 大字后面跟的单位或补充 */
export const UNIT = 'text-[14px] text-(--text-muted)'

interface StatProps {
  label: string
  children: ReactNode
  /** 数值下面的一行小字 */
  note?: ReactNode
}

/** 一格：上面小标签，下面大字数值。主页“现在”一条和板块页页头共用。 */
export function Stat({ label, children, note }: StatProps) {
  return (
    <div className="min-w-0">
      <div className="text-[12px] text-(--text-muted)">{label}</div>
      <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">{children}</div>
      {note && <div className="truncate text-[12px] text-(--text-muted)">{note}</div>}
    </div>
  )
}
