import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { NAME_MAX, type Term } from '@/data/schema'
import { useStore } from '@/data/store'
import { addDays, fromDay, toDay, todayISO } from '@/features/timeline/days'
import { mondayOf, WEEK } from '@/features/timeline/snap'
import {
  cleanName,
  ERROR_DATE_REQUIRED,
  ERROR_END_BEFORE_START,
  ErrorText,
  isPlausibleDate,
} from './fields'

export const ERROR_TERMS_OVERLAP = '学期时间不能重叠'
const NEW_TERM_WEEKS = 18

interface Row {
  id: string
  name: string
  start: string
  /** 含当天 */
  end: string
}

const toRow = (term: Term): Row => ({ ...term, end: addDays(term.end, -1) })

function validate(rows: Row[]): { ok: true; terms: Term[] } | { ok: false; error: string } {
  if (rows.some((row) => !isPlausibleDate(row.start) || !isPlausibleDate(row.end))) {
    return { ok: false, error: ERROR_DATE_REQUIRED }
  }
  if (rows.some((row) => row.end < row.start)) return { ok: false, error: ERROR_END_BEFORE_START }
  const terms = rows
    .map((row) => ({
      id: row.id,
      name: cleanName(row.name),
      start: row.start,
      end: addDays(row.end, 1),
    }))
    .sort((a, b) => a.start.localeCompare(b.start))
  if (terms.some((term, index) => index > 0 && term.start < terms[index - 1].end)) {
    return { ok: false, error: ERROR_TERMS_OVERLAP }
  }
  return { ok: true, terms }
}

interface TermsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TermsDialog({ open, onOpenChange }: TermsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <TermsForm onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function TermsForm({ onClose }: { onClose: () => void }) {
  const setTerms = useStore((state) => state.setTerms)
  const [rows, setRows] = useState<Row[]>(() => useStore.getState().data.terms.map(toRow))
  const [error, setError] = useState<string | null>(null)

  const patch = (id: string, change: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...change } : row)))
    setError(null)
  }

  const addRow = () => {
    const last = [...rows].sort((a, b) => a.end.localeCompare(b.end)).at(-1)
    const start =
      last && isPlausibleDate(last.end) ? toDay(last.end) + 1 : mondayOf(toDay(todayISO()))
    setRows((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: '新学期',
        start: fromDay(start),
        end: fromDay(start + NEW_TERM_WEEKS * WEEK - 1),
      },
    ])
    setError(null)
  }

  const finish = () => {
    const result = validate(rows)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setTerms(result.terms)
    onClose()
  }

  return (
    <DialogContent
      showCloseButton={false}
      className="max-w-[560px] gap-4 rounded-[12px] border border-(--border) p-6 ring-0 sm:max-w-[560px]"
    >
      <DialogHeader>
        <DialogTitle className="text-[16px] font-medium">编辑学期</DialogTitle>
        <DialogDescription className="text-[12px]">
          学期显示在时间标尺下方，用来对照各阶段处在哪个学期。
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {rows.length === 0 && <p className="py-2 text-[14px] text-(--text-muted)">还没有学期。</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <Input
              aria-label="名称"
              value={row.name}
              maxLength={NAME_MAX}
              className="min-w-0 flex-1"
              onChange={(event) => patch(row.id, { name: event.target.value })}
            />
            <Input
              aria-label="开始"
              type="date"
              value={row.start}
              className="w-36 shrink-0"
              onChange={(event) => patch(row.id, { start: event.target.value })}
            />
            <Input
              aria-label="结束"
              type="date"
              value={row.end}
              className="w-36 shrink-0"
              onChange={(event) => patch(row.id, { end: event.target.value })}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="删除学期"
              onClick={() => {
                setRows((current) => current.filter((item) => item.id !== row.id))
                setError(null)
              }}
            >
              <Trash2Icon aria-hidden />
            </Button>
          </div>
        ))}
        <div>
          <Button variant="ghost" size="sm" onClick={addRow}>
            <PlusIcon aria-hidden />
            添加学期
          </Button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button onClick={finish}>完成</Button>
      </DialogFooter>
    </DialogContent>
  )
}
