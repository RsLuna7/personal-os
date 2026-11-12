import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { NOTE_MAX, type Milestone } from '@/data/schema'
import { useStore } from '@/data/store'
import { showDeleteToast } from './deleteToast'
import { cleanName, DateField, EditorPopover, LaneSelect, NameField, useDraft } from './fields'

interface MilestoneEditorProps {
  milestoneId: string
  anchor: HTMLElement | null
  onClose: () => void
  selectName?: boolean
}

export function MilestoneEditor({
  milestoneId,
  anchor,
  onClose,
  selectName = false,
}: MilestoneEditorProps) {
  const milestone = useStore((state) =>
    state.data.milestones.find((item) => item.id === milestoneId),
  )

  useEffect(() => {
    if (!milestone) onClose()
  }, [milestone, onClose])
  if (!milestone) return null

  return (
    <MilestoneForm
      key={milestone.id}
      milestone={milestone}
      anchor={anchor}
      onClose={onClose}
      selectName={selectName}
    />
  )
}

function MilestoneForm({
  milestone,
  anchor,
  onClose,
  selectName,
}: {
  milestone: Milestone
  anchor: HTMLElement | null
  onClose: () => void
  selectName: boolean
}) {
  const lanes = useStore((state) => state.data.lanes)
  const updateMilestone = useStore((state) => state.updateMilestone)
  const removeMilestone = useStore((state) => state.removeMilestone)
  const noteId = useId()
  const doneId = useId()
  const [note, setNote] = useDraft(milestone.note)
  const nameInput = useRef<HTMLInputElement | null>(null)

  const save = (patch: Partial<Omit<Milestone, 'id'>>) => updateMilestone(milestone.id, patch)

  const close = () => {
    const pendingName = nameInput.current ? cleanName(nameInput.current.value) : milestone.name
    save({ name: pendingName, note })
    onClose()
  }

  return (
    <EditorPopover
      label="编辑节点"
      anchor={anchor}
      anchorSelector={`[data-testid="milestone-${milestone.id}"]`}
      selectName={selectName}
      onClose={close}
    >
      <NameField
        value={milestone.name}
        onCommit={(name) => save({ name })}
        inputRef={(element) => {
          nameInput.current = element
        }}
      />
      <div className="flex">
        <DateField
          label="日期"
          value={milestone.date}
          onCommit={(date) => {
            save({ date })
            return null
          }}
        />
      </div>
      <LaneSelect value={milestone.laneId} lanes={lanes} onChange={(laneId) => save({ laneId })} />
      <div className="flex items-center justify-between">
        <Label htmlFor={doneId}>已完成</Label>
        <Switch id={doneId} checked={milestone.done} onCheckedChange={(done) => save({ done })} />
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
            removeMilestone(milestone.id)
            showDeleteToast(milestone.name)
            onClose()
          }}
        >
          删除
        </Button>
      </div>
    </EditorPopover>
  )
}
