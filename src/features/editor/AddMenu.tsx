import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStore } from '@/data/store'
import { fromDay, toDay, todayISO } from '@/features/timeline/days'
import { mondayOf, WEEK } from '@/features/timeline/snap'
import { openEditor, startRenamingLane } from './editorStore'

const NEW_PHASE_WEEKS = 4

/** 新建一个板块并直接进入改名。 */
export function addLaneAndRename(): void {
  startRenamingLane(useStore.getState().addLane())
}

function firstLaneId(): string | undefined {
  const { lanes } = useStore.getState().data
  return [...lanes].sort((a, b) => a.order - b.order)[0]?.id
}

function addPhase(): void {
  const laneId = firstLaneId()
  if (!laneId) return
  const store = useStore.getState()
  const start = mondayOf(toDay(todayISO()))
  const id = store.addPhase({
    laneId,
    start: fromDay(start),
    end: fromDay(start + NEW_PHASE_WEEKS * WEEK),
  })
  store.select({ kind: 'phase', id })
  openEditor('phase', id, true)
}

function addMilestone(): void {
  const laneId = firstLaneId()
  if (!laneId) return
  const store = useStore.getState()
  const id = store.addMilestone({ laneId, date: todayISO() })
  store.select({ kind: 'milestone', id })
  openEditor('milestone', id, true)
}

export function AddMenu() {
  const hasLanes = useStore((state) => state.data.lanes.length > 0)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <PlusIcon aria-hidden />
          添加
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-32"
        onCloseAutoFocus={(event) => {
          // The menu traps focus while open; hand it to the rename box once it has closed.
          event.preventDefault()
          const rename = document.querySelector<HTMLInputElement>('[data-lane-rename]')
          rename?.focus()
          rename?.select()
        }}
      >
        <DropdownMenuItem disabled={!hasLanes} onSelect={addPhase}>
          阶段
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasLanes} onSelect={addMilestone}>
          节点
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={addLaneAndRename}>板块</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
