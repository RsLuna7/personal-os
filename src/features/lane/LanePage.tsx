import { useEffect, useMemo } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { MilestoneEditor } from '@/features/editor/MilestoneEditor'
import { PhaseEditor } from '@/features/editor/PhaseEditor'
import { useUndoKeys } from '@/features/editor/useUndoKeys'
import { summarizeLane } from '@/features/home/summary'
import { EmptyState } from '@/features/timeline/EmptyState'
import { useToday } from '@/features/timeline/useToday'
import { ItemsCard } from './ItemsCard'
import { LaneHeader } from './LaneHeader'
import { LaneSidebar } from './LaneSidebar'
import { LinksCard } from './LinksCard'
import { NoteCard } from './NoteCard'
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

  // 在编辑面板里把阶段或节点换到别的板块后，它不在这一页了，面板没有东西可贴
  const editedLaneId = useMemo(() => {
    if (!editing) return null
    const list = editing.kind === 'phase' ? data.phases : data.milestones
    return list.find((item) => item.id === editing.id)?.laneId ?? null
  }, [editing, data.phases, data.milestones])
  useEffect(() => {
    if (editedLaneId !== null && editedLaneId !== lane?.id) closeEditor()
  }, [editedLaneId, lane?.id])

  if (!lane || !summary) return <EmptyState />

  return (
    <div className="flex min-h-0 flex-1">
      <LaneSidebar lanes={lanes} selectedId={lane.id} today={today} />
      <div className="min-w-0 flex-1 overflow-y-auto bg-(--bg-canvas)">
        <div className="mx-auto max-w-[960px] px-6 py-6">
          {/* 换板块时整块重新挂载，输入框里的草稿不会带到另一个板块 */}
          <div
            key={lane.id}
            data-lane-color={lane.color}
            className="lane-detail flex flex-col gap-6"
          >
            <LaneHeader summary={summary} today={today} />
            {/* 先看要做的事（阶段与节点），再看参考资料（备注、链接） */}
            <ItemsCard lane={lane} today={today} />
            <NoteCard lane={lane} />
            <LinksCard lane={lane} />
          </div>
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
