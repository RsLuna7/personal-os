import { CheckIcon } from 'lucide-react'
import type { Habit, Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { colorOfLane } from '@/features/calendar/cells'
import { openEditor } from '@/features/editor/editorStore'
import { fromDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'
import { createdDay, RECENT_DAYS, recentDays, streak, type DayMark } from './habits'

const MARK_TEXT: Record<DayMark, string> = { done: '已打卡', missed: '未打卡', off: '不用打' }

const MARK_CLASS: Record<DayMark, string> = {
  done: 'bg-(--lane-dot) border-(--lane-dot)',
  missed: 'border-(--sand-7) bg-(--bg-card)',
  off: 'border-(--sand-5) bg-(--bg-card) opacity-50',
}

interface HabitRowProps {
  habit: Habit
  lanes: Lane[]
  today: number
  /** 今天要不要打；不用打的没有今天的勾选框 */
  due: boolean
}

/** 一个习惯：今天的勾选框、板块色条、名字（点开编辑）、最近 7 天的格子（可补打）、连续记录。 */
export function HabitRow({ habit, lanes, today, due }: HabitRowProps) {
  const checkedToday = habit.checks.includes(fromDay(today))
  const count = streak(habit, today)
  const start = createdDay(habit)
  const toggle = (day: number) => useStore.getState().toggleCheck(habit.id, fromDay(day))

  return (
    <li
      data-testid={`habit-${habit.id}`}
      data-lane-color={colorOfLane(lanes, habit.laneId)}
      data-done={String(due && checkedToday)}
      className="todo-item flex min-h-9 items-center gap-2.5 text-[14px]"
    >
      {due ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={checkedToday}
          aria-label={`打卡「${habit.name}」`}
          className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-(--sand-8) bg-(--bg-card) text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
          onClick={() => toggle(today)}
        >
          {checkedToday && <CheckIcon aria-hidden className="size-3" />}
        </button>
      ) : (
        <span aria-hidden className="size-4 shrink-0" />
      )}
      <span aria-hidden className="todo-bar h-4" />
      <button
        type="button"
        className="todo-title min-w-0 flex-1 cursor-pointer truncate rounded-[4px] text-left focus-visible:outline-2 focus-visible:outline-(--text)"
        title={habit.name}
        onClick={() => openEditor('habit', habit.id)}
      >
        {habit.name}
      </button>
      <span
        role="group"
        aria-label={`「${habit.name}」最近 ${RECENT_DAYS} 天`}
        className="flex shrink-0 items-center gap-[3px]"
      >
        {recentDays(habit, today).map(({ day, mark }) => (
          <button
            key={day}
            type="button"
            data-mark={mark}
            aria-label={`${habit.name} ${formatDay(day)} ${MARK_TEXT[mark]}`}
            aria-pressed={mark === 'done'}
            title={`${formatDay(day)} ${MARK_TEXT[mark]}`}
            // 习惯建立之前的日子不能打卡：打了也不算进连续记录
            disabled={day < start}
            onClick={() => toggle(day)}
            // 格子只有 12px，用伪元素把可点的范围撑到约 15×24px，不改变排版
            className={`relative size-3 cursor-pointer rounded-[3px] border transition-colors duration-(--dur-fast) after:absolute after:-inset-x-[1.5px] after:-inset-y-1.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-(--text) disabled:cursor-default ${MARK_CLASS[mark]}`}
          />
        ))}
      </span>
      <span className="w-9 shrink-0 text-right text-[12px] text-(--text-muted) tabular-nums">
        {count > 0 ? `${count} 天` : ''}
      </span>
    </li>
  )
}
