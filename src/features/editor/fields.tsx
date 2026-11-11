import { useId, useLayoutEffect, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { NAME_MAX, type ISODate, type Lane } from '@/data/schema'

export const FALLBACK_NAME = '未命名'
export const ERROR_DATE_REQUIRED = '请填写日期'
export const ERROR_END_BEFORE_START = '结束日期不能早于开始日期'

/** 输入框里的草稿；数据从别处变了（拖动、撤销）就跟着更新。 */
export function useDraft(source: string) {
  const [draft, setDraft] = useState(source)
  const [previous, setPrevious] = useState(source)
  if (previous !== source) {
    setPrevious(source)
    setDraft(source)
  }
  return [draft, setDraft] as const
}

/** 去掉首尾空白；空名称退回“未命名”。 */
export function cleanName(value: string): string {
  return value.trim().slice(0, NAME_MAX) || FALLBACK_NAME
}

export const MIN_PLAUSIBLE_YEAR = 1900
/** 结束日期要加一天才存，9999 年会变成 5 位数的年份，存不进去也读不回来。 */
export const MAX_PLAUSIBLE_YEAR = 9998

/** 日期输入框在输入年份的过程中会给出 0002、0020 这样的中间值，不当真。 */
export function isPlausibleDate(value: string): value is ISODate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const year = Number(value.slice(0, 4))
  return year >= MIN_PLAUSIBLE_YEAR && year <= MAX_PLAUSIBLE_YEAR
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-[12px] text-(--danger)">
      {children}
    </p>
  )
}

interface NameFieldProps {
  value: string
  onCommit: (name: string) => void
  /** 让外面能在关闭面板前拿到没提交的草稿 */
  inputRef?: (element: HTMLInputElement | null) => void
  /** 标签文字，默认“名称” */
  label?: string
}

export function NameField({ value, onCommit, inputRef, label = '名称' }: NameFieldProps) {
  const id = useId()
  const [draft, setDraft] = useDraft(value)
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        ref={inputRef}
        data-name-field
        value={draft}
        maxLength={NAME_MAX}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(cleanName(draft))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onCommit(cleanName(draft))
        }}
      />
    </div>
  )
}

interface DateFieldProps {
  label: string
  /** 空字符串表示还没有日期（只在 optional 时出现） */
  value: ISODate | ''
  /** 返回错误文案表示没有保存；返回 null 表示已保存 */
  onCommit: (value: ISODate) => string | null
  /**
   * 日期可以留空：不再提示“请填写日期”。输入框清空或没输完时（原生日期框此时给出空值）
   * 不写入数据，失焦后恢复成数据里的日期；要清除日期得由外面另给一个明确的操作。
   */
  optional?: boolean
}

export function DateField({ label, value, onCommit, optional = false }: DateFieldProps) {
  const id = useId()
  const [draft, setDraft] = useDraft(value)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={draft}
        aria-invalid={error !== null}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          if (isPlausibleDate(next)) setError(onCommit(next))
        }}
        onBlur={() => {
          if (optional && draft === '') {
            setDraft(value)
            setError(null)
          } else if (!isPlausibleDate(draft)) setError(ERROR_DATE_REQUIRED)
        }}
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

interface LaneSelectProps {
  /** 空字符串表示“不挂板块”（只在 allowNone 时出现） */
  value: string
  lanes: Lane[]
  onChange: (laneId: string) => void
  /** 多一个“不挂板块”的选项，选它时 onChange 收到空字符串 */
  allowNone?: boolean
}

export function LaneSelect({ value, lanes, onChange, allowNone = false }: LaneSelectProps) {
  const id = useId()
  const sorted = [...lanes].sort((a, b) => a.order - b.order)
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>板块</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-[6px] border border-(--border) bg-transparent px-2 text-[14px] text-(--text) outline-none focus-visible:border-(--text)"
      >
        {allowNone && <option value="">不挂板块</option>}
        {sorted.map((lane) => (
          <option key={lane.id} value={lane.id}>
            {lane.name}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * 面板贴着的元素：给了 anchor 就用它；否则按 selector 去找，并且每次渲染后检查，
 * 记住的元素如果已经不在文档里（色块被重新挂载），就重新找。
 */
export function useAnchorElement(anchor: HTMLElement | null, selector: string): HTMLElement | null {
  const [found, setFound] = useState<HTMLElement | null>(null)
  // 故意不写依赖：元素可能在任何一次渲染里被换掉，所以每次渲染后都检查
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (anchor || found?.isConnected) return
    // The anchor element only exists after its page has committed, so it has to be looked up here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFound(document.querySelector<HTMLElement>(selector))
  })
  return anchor ?? found
}

interface EditorPopoverProps {
  label: string
  /** 面板贴着的元素；为空时按 selector 去找（新建的色块此时刚挂上） */
  anchor: HTMLElement | null
  anchorSelector: string
  selectName: boolean
  onClose: () => void
  children: ReactNode
}

export function EditorPopover({
  label,
  anchor,
  anchorSelector,
  selectName,
  onClose,
  children,
}: EditorPopoverProps) {
  const element = useAnchorElement(anchor, anchorSelector)
  if (!element) return null

  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <PopoverAnchor virtualRef={{ current: element }} />
      <PopoverContent
        aria-label={label}
        align="start"
        sideOffset={8}
        collisionPadding={16}
        className="editor-panel w-72 gap-3 rounded-[12px] border border-(--border) p-4 ring-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          const input = (event.currentTarget as HTMLElement).querySelector<HTMLInputElement>(
            '[data-name-field]',
          )
          input?.focus()
          if (selectName) input?.select()
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
