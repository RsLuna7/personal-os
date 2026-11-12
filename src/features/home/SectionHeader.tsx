import type { ReactNode } from 'react'

interface SectionHeaderProps {
  id: string
  title: string
  /** 标题右侧的操作按钮 */
  children?: ReactNode
}

/** 主页各区块的标题行：放在卡片外面，所有区块统一高度和字号。 */
export function SectionHeader({ id, title, children }: SectionHeaderProps) {
  return (
    <header className="mb-3 flex min-h-8 items-center gap-2">
      <h2 id={id} className="mr-auto font-serif text-[18px] font-bold text-(--text)">
        {title}
      </h2>
      {children}
    </header>
  )
}
