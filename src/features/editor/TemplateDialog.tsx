import { useId, useMemo, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { applyTemplate, TEMPLATES, templateCounts, type Template } from '@/data/templates'
import { addDays, todayISO } from '@/features/timeline/days'
import { showUndoToast } from './deleteToast'
import { ERROR_DATE_REQUIRED, ErrorText, isPlausibleDate } from './fields'

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TemplateDialog({ open, onOpenChange }: TemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <TemplateForm onClose={() => onOpenChange(false)} />}
    </Dialog>
  )
}

/** 月-日，预览里够用了 */
const shortDate = (date: string) => date.slice(5)

function summary(template: Template): string {
  const { lanes, phases, milestones } = templateCounts(template)
  return `${lanes} 个板块、${phases} 个阶段、${milestones} 个节点`
}

function TemplateForm({ onClose }: { onClose: () => void }) {
  const addFromTemplate = useStore((state) => state.addFromTemplate)
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
  const [start, setStart] = useState(() => todayISO())
  const [error, setError] = useState<string | null>(null)
  const startId = useId()
  const template = TEMPLATES.find((item) => item.id === templateId) ?? TEMPLATES[0]
  const valid = isPlausibleDate(start)

  /** 预览用同一个函数在空数据上算一遍，看到的日期就是实际会添加的日期。 */
  const preview = useMemo(() => {
    if (!isPlausibleDate(start)) return null
    let counter = 0
    const result = applyTemplate(createEmptyData(), template, start, () => `preview-${counter++}`)
    return result.lanes.map((lane) => ({
      id: lane.id,
      name: lane.name,
      items: [
        ...result.phases
          .filter((phase) => phase.laneId === lane.id)
          .map((phase) => ({
            key: phase.id,
            name: phase.name,
            when: `${shortDate(phase.start)} 至 ${shortDate(addDays(phase.end, -1))}`,
            sort: phase.start,
          })),
        ...result.milestones
          .filter((milestone) => milestone.laneId === lane.id)
          .map((milestone) => ({
            key: milestone.id,
            name: `${milestone.name}（节点）`,
            when: shortDate(milestone.date),
            sort: milestone.date,
          })),
      ].sort((a, b) => a.sort.localeCompare(b.sort)),
    }))
  }, [template, start])

  const confirm = () => {
    if (!isPlausibleDate(start)) {
      setError(ERROR_DATE_REQUIRED)
      return
    }
    addFromTemplate(template, start)
    showUndoToast(`已从模板「${template.name}」添加 ${template.lanes.length} 个板块`)
    onClose()
  }

  return (
    <DialogContent
      showCloseButton={false}
      className="max-w-[560px] gap-4 rounded-[12px] border border-(--border) p-6 ring-0 sm:max-w-[560px]"
    >
      <DialogHeader>
        <DialogTitle className="text-[16px] font-medium">从模板添加</DialogTitle>
        <DialogDescription className="text-[12px]">
          按开始日期铺开一套板块、阶段和节点，追加在现有内容后面，不会改动已有的东西。
        </DialogDescription>
      </DialogHeader>
      <div role="radiogroup" aria-label="模板" className="flex flex-col gap-2">
        {TEMPLATES.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-(--border) p-3 has-[:checked]:border-(--text)"
          >
            <input
              type="radio"
              name="template"
              value={item.id}
              checked={item.id === templateId}
              className="mt-1"
              onChange={() => setTemplateId(item.id)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-[14px] font-medium">{item.name}</span>
              <span className="text-[12px] text-(--text-muted)">{item.description}</span>
              <span className="text-[12px] text-(--text-muted)">{summary(item)}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={startId}>开始日期</Label>
        <Input
          id={startId}
          type="date"
          value={start}
          className="w-40"
          onChange={(event) => {
            setStart(event.target.value)
            setError(null)
          }}
        />
        {error && <ErrorText>{error}</ErrorText>}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[12px] text-(--text-muted)">将添加</div>
        {preview ? (
          <ul data-testid="template-preview" className="flex max-h-48 flex-col gap-2 overflow-auto">
            {preview.map((lane) => (
              <li key={lane.id} className="text-[14px]">
                <div className="font-medium">{lane.name}</div>
                <ul className="text-[12px] text-(--text-muted)">
                  {lane.items.map((item) => (
                    <li key={item.key}>
                      {item.name} · {item.when}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-(--text-muted)">填好开始日期后显示预览。</p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button disabled={!valid} onClick={confirm}>
          添加
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
