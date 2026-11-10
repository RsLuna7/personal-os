import { useEffect, useRef } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { Input } from '@/components/ui/input'
import { LANE_COLORS, NAME_MAX, type LaneColor } from '@/data/schema'
import { useStore } from '@/data/store'
import { showDeleteToast } from './deleteToast'
import { startRenamingLane, useEditorStore } from './editorStore'
import { cleanName, useDraft } from './fields'

export const LANE_COLOR_NAMES: Record<LaneColor, string> = {
  iris: '靛紫',
  tomato: '番茄红',
  teal: '青绿',
  amber: '琥珀',
  blue: '蓝',
  grass: '草绿',
  pink: '粉',
  bronze: '古铜',
}

function RenameInput({ laneId, name }: { laneId: string; name: string }) {
  const updateLane = useStore((state) => state.updateLane)
  const [draft, setDraft] = useDraft(name)
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])
  const commit = () => {
    updateLane(laneId, { name: cleanName(draft) })
    startRenamingLane(null)
  }
  return (
    <Input
      ref={input}
      data-lane-rename
      aria-label="板块名称"
      value={draft}
      maxLength={NAME_MAX}
      className="h-7 px-1 text-[14px]"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit()
        if (event.key === 'Escape') startRenamingLane(null)
      }}
    />
  )
}

/** 板块名：点击弹出菜单，可改名、换颜色、上移、下移、删除。 */
export function LaneMenu({ laneId }: { laneId: string }) {
  const lane = useStore((state) => state.data.lanes.find((item) => item.id === laneId))
  const laneCount = useStore((state) => state.data.lanes.length)
  const updateLane = useStore((state) => state.updateLane)
  const moveLane = useStore((state) => state.moveLane)
  const removeLane = useStore((state) => state.removeLane)
  const renaming = useEditorStore((state) => state.renamingLaneId === laneId)

  if (!lane) return null
  if (renaming) return <RenameInput laneId={lane.id} name={lane.name} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title={lane.name}
          className="-mx-1 min-w-0 truncate rounded-[6px] px-1 py-0.5 text-left text-[14px] font-medium text-(--text) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:bg-(--bg-panel) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
        >
          {lane.name}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-44"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem onSelect={() => startRenamingLane(lane.id)}>重命名</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          aria-label="颜色"
          value={lane.color}
          onValueChange={(color) => updateLane(lane.id, { color: color as LaneColor })}
          className="grid grid-cols-4 gap-2 p-2"
        >
          {LANE_COLORS.map((color) => (
            <DropdownMenuPrimitive.RadioItem
              key={color}
              value={color}
              aria-label={LANE_COLOR_NAMES[color]}
              title={LANE_COLOR_NAMES[color]}
              data-lane-color={color}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full bg-(--lane-dot) outline-offset-2 outline-(--text) focus-visible:outline-2 data-[state=checked]:outline-2"
            />
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={lane.order === 0} onSelect={() => moveLane(lane.id, -1)}>
          上移
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={lane.order >= laneCount - 1}
          onSelect={() => moveLane(lane.id, 1)}
        >
          下移
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            removeLane(lane.id)
            showDeleteToast(lane.name)
          }}
        >
          删除板块
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
