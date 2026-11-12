import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { NOTE_MAX, type Phase } from '@/data/schema'
import { useStore } from '@/data/store'
import { addDays } from '@/features/timeline/days'
import { showDeleteToast } from './deleteToast'
import {
  cleanName,
  DateField,
  EditorPopover,
  ERROR_END_BEFORE_START,
  LaneSelect,
  NameField,
  useDraft,
} from './fields'

interface PhaseEditorProps {
  phaseId: string
  anchor: HTMLElement | null
  onClose: () => void
  selectName?: boolean
}

export function PhaseEditor({ phaseId, anchor, onClose, selectName = false }: PhaseEditorProps) {
  const phase = useStore((state) => state.data.phases.find((item) => item.id === phaseId))

  // 撤销等操作让这个阶段消失时，面板跟着关掉
  useEffect(() => {
    if (!phase) onClose()
  }, [phase, onClose])
  if (!phase) return null

  return (
    <PhaseForm
      key={phase.id}
      phase={phase}
      anchor={anchor}
      onClose={onClose}
      selectName={selectName}
    />
  )
}

function PhaseForm({
  phase,
  anchor,
  onClose,
  selectName,
}: {
  phase: Phase
  anchor: HTMLElement | null
  onClose: () => void
  selectName: boolean
}) {
  const lanes = useStore((state) => state.data.lanes)
  const updatePhase = useStore((state) => state.updatePhase)
  const removePhase = useStore((state) => state.removePhase)
  const tentativeId = useId()
  const doneId = useId()
  const noteId = useId()
  const [note, setNote] = useDraft(phase.note)
  const nameInput = useRef<HTMLInputElement | null>(null)

  /** 界面上的结束日期含当天，比存的值早一天 */
  const endInclusive = addDays(phase.end, -1)

  const save = (patch: Partial<Omit<Phase, 'id'>>) => updatePhase(phase.id, patch)

  /** 关闭前把还没失焦的名称和备注存下来 */
  const close = () => {
    const pendingName = nameInput.current ? cleanName(nameInput.current.value) : phase.name
    save({ name: pendingName, note })
    onClose()
  }

  return (
    <EditorPopover
      label="编辑阶段"
      anchor={anchor}
      anchorSelector={`[data-testid="phase-${phase.id}"]`}
      selectName={selectName}
      onClose={close}
    >
      <NameField
        value={phase.name}
        onCommit={(name) => save({ name })}
        inputRef={(element) => {
          nameInput.current = element
        }}
      />
      <div className="flex gap-2">
        <DateField
          label="开始"
          value={phase.start}
          onCommit={(start) => {
            if (start > endInclusive) return ERROR_END_BEFORE_START
            save({ start })
            return null
          }}
        />
        <DateField
          label="结束"
          value={endInclusive}
          onCommit={(end) => {
            if (end < phase.start) return ERROR_END_BEFORE_START
            save({ end: addDays(end, 1) })
            return null
          }}
        />
      </div>
      <LaneSelect value={phase.laneId} lanes={lanes} onChange={(laneId) => save({ laneId })} />
      <div className="flex items-center justify-between">
        <Label htmlFor={tentativeId}>待确认</Label>
        <Switch
          id={tentativeId}
          checked={phase.tentative}
          onCheckedChange={(tentative) => save({ tentative })}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor={doneId}>已完成</Label>
        <Switch id={doneId} checked={phase.done} onCheckedChange={(done) => save({ done })} />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={noteId}>备注</Label>
        <Textarea
          id={noteId}
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(event) => setNote(event.target.value)}
          onBlur={() => save({ note })}
        />
      </div>
      <div className="flex justify-end border-t border-(--border) pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-(--danger)"
          onClick={() => {
            removePhase(phase.id)
            showDeleteToast(phase.name)
            onClose()
          }}
        >
          删除
        </Button>
      </div>
    </EditorPopover>
  )
}
