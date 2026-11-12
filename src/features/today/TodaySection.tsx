import type { ReactNode } from 'react'
import { SectionHeader } from '@/features/home/SectionHeader'

interface TodaySectionProps {
  id: string
  title: string
  testId: string
  /** 拖拽时作为落点 */
  dropZone?: 'today' | 'inbox'
  /** 拖着的待办正在这一栏上方 */
  dropActive?: boolean
  /** 标题右侧 */
  actions?: ReactNode
  className?: string
  children: ReactNode
}

/** 今日页的一栏：卡片外是标题，卡片和首页各区块同款。 */
export function TodaySection({
  id,
  title,
  testId,
  dropZone,
  dropActive = false,
  actions,
  className = '',
  children,
}: TodaySectionProps) {
  return (
    <section
      aria-labelledby={id}
      data-testid={testId}
      data-drop-zone={dropZone}
      className={`min-w-0 ${className}`}
    >
      <SectionHeader id={id} title={title}>
        {actions}
      </SectionHeader>
      <div
        data-drop-active={String(dropActive)}
        className="rounded-[16px] bg-(--bg-card) px-5 py-3 shadow-(--shadow-card) outline-2 outline-offset-2 outline-transparent transition-[outline-color] duration-(--dur-fast) data-[drop-active=true]:outline-(--brand)"
      >
        {children}
      </div>
    </section>
  )
}

/** 一组的小标题，比如“今天 3”“明天” */
export function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="pt-1 text-[12px] text-(--text-muted)">{children}</h3>
}
