import { useMemo } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { summarizeLane } from '@/features/home/summary'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { LaneHeader } from './LaneHeader'
import { LaneSidebar } from './LaneSidebar'
import { resolveLaneId } from './select'

interface LanePageProps {
  /** 网址里的板块编号；缺省或无效时选第一个板块 */
  param: string | null
}

/** 板块：左边选板块，右边是它的详情。 */
export function LanePage({ param }: LanePageProps) {
  const data = useStore((state) => state.data)
  const editing = useEditorStore((state) => state.editing)
  const today = useToday()
  useUndoKeys()

  const lanes = useMemo(() => [...data.lanes].sort((a, b) => a.order - b.order), [data.lanes])
  const selectedId = resolveLaneId(lanes, param)
  const lane = lanes.find((item) => item.id === selectedId)

  const summary = useMemo(
    () => (lane ? summarizeLane(lane, data.phases, data.milestones, today) : null),
    [lane, data.phases, data.milestones, today],
  )

  if (!lane || !summary) return <EmptyState />

  return (
    <div className="flex min-h-0 flex-1">
      <LaneSidebar lanes={lanes} selectedId={lane.id} today={today} />
      <div className="min-w-0 flex-1 overflow-y-auto bg-(--bg-canvas)">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-6 py-6">
          <LaneHeader key={lane.id} summary={summary} today={today} />
        </div>
      </div>
      {editing?.kind === 'phase' && (
        <PhaseEditor
          phaseId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
      {editing?.kind === 'milestone' && (
        <MilestoneEditor
          milestoneId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
