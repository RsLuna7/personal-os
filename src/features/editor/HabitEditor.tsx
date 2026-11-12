import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Habit } from '@/data/schema'
import { EVERY_DAY, useStore } from '@/data/store'
import { showDeleteToast } from './deleteToast'
import { weekdayOf } from '@/features/today/habits'
import { useToday } from '@/features/timeline/useToday'
import { cleanName, EditorPopover, LaneSelect, NameField } from './fields'

const WEEKDAY_SHORT = ['一', '二', '三', '四', '五', '六', '日']

interface HabitEditorProps {
  habitId: string
  anchor: HTMLElement | null
  onClose: () => void
  selectName?: boolean
}

export function HabitEditor({ habitId, anchor, onClose, selectName = false }: HabitEditorProps) {
  const habit = useStore((state) => state.data.habits.find((item) => item.id === habitId))

  // 撤销等操作让这个习惯消失时，面板跟着关掉
  useEffect(() => {
    if (!habit) onClose()
  }, [habit, onClose])
  if (!habit) return null

  return (
    <HabitForm
      key={habit.id}
      habit={habit}
      anchor={anchor}
      onClose={onClose}
      selectName={selectName}
    />
  )
}

function HabitForm({
  habit,
  anchor,
  onClose,
  selectName,
}: {
  habit: Habit
  anchor: HTMLElement | null
  onClose: () => void
  selectName: boolean
}) {
  const lanes = useStore((state) => state.data.lanes)
  const updateHabit = useStore((state) => state.updateHabit)
  const removeHabit = useStore((state) => state.removeHabit)
  const today = useToday()
  const everyDayId = useId()
  const nameInput = useRef<HTMLInputElement | null>(null)
  const everyDay = habit.weekdays.length === 7

  const save = (patch: Partial<Pick<Habit, 'name' | 'weekdays' | 'laneId'>>) =>
    updateHabit(habit.id, patch)

  /** 关闭前把还没失焦的名字存下来 */
  const close = () => {
    save({ name: nameInput.current ? cleanName(nameInput.current.value) : habit.name })
    onClose()
  }

  const toggleWeekday = (weekday: number) => {
    const on = habit.weekdays.includes(weekday)
    // 至少留一天：最后一天点不掉（store 也会拒绝空的星期）
    if (on && habit.weekdays.length === 1) return
    save({
      weekdays: on ? habit.weekdays.filter((day) => day !== weekday) : [...habit.weekdays, weekday],
    })
  }

  return (
    <EditorPopover
      label="编辑习惯"
      anchor={anchor}
      anchorSelector={`[data-testid="habit-${habit.id}"]`}
      selectName={selectName}
      onClose={close}
    >
      <NameField
        value={habit.name}
        onCommit={(name) => save({ name })}
        inputRef={(element) => {
          nameInput.current = element
        }}
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={everyDayId}>每天</Label>
          <Switch
            id={everyDayId}
            checked={everyDay}
            // 关掉“每天”时先只留今天是星期几（习惯今天照样要打），再由下面的星期按钮挑
            onCheckedChange={(on) => save({ weekdays: on ? EVERY_DAY : [weekdayOf(today)] })}
          />
        </div>
        {!everyDay && (
          <div role="group" aria-label="打卡的星期" className="flex gap-1">
            {WEEKDAY_SHORT.map((short, index) => {
              const weekday = index + 1
              const on = habit.weekdays.includes(weekday)
              return (
                <button
                  key={weekday}
                  type="button"
                  aria-label={`周${short}`}
                  aria-pressed={on}
                  onClick={() => toggleWeekday(weekday)}
                  className={`size-8 flex-1 rounded-[6px] border text-[13px] focus-visible:outline-2 focus-visible:outline-(--text) ${
                    on
                      ? 'border-(--text) bg-(--text) text-(--bg-card)'
                      : 'border-(--border) text-(--text-muted) hover:text-(--text)'
                  }`}
                >
                  {short}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <LaneSelect
        allowNone
        value={habit.laneId ?? ''}
        lanes={lanes}
        onChange={(laneId) => save({ laneId: laneId === '' ? null : laneId })}
      />
      <div className="flex justify-end border-t border-(--border) pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-(--danger)"
          onClick={() => {
            removeHabit(habit.id)
            showDeleteToast(habit.name)
            onClose()
          }}
        >
          删除
        </Button>
      </div>
    </EditorPopover>
  )
}
