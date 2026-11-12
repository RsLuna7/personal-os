import { useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import type { Habit, Lane } from '@/data/schema'
import { useStore } from '@/data/store'
import { openEditor } from '@/features/editor/editorStore'
import { isDue } from './habits'
import { HabitRow } from './HabitRow'
import { TodaySection } from './TodaySection'

interface HabitColumnProps {
  habits: Habit[]
  lanes: Lane[]
  today: number
  className?: string
}

function byCreated(a: Habit, b: Habit): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/** 今日页右栏：今天要打的习惯；今天不用打的收成一行，点开才看。 */
export function HabitColumn({ habits, lanes, today, className }: HabitColumnProps) {
  const [showOff, setShowOff] = useState(false)
  const sorted = [...habits].sort(byCreated)
  const due = sorted.filter((habit) => isDue(habit, today))
  const off = sorted.filter((habit) => !isDue(habit, today))

  const addHabit = () => {
    const id = useStore.getState().addHabit()
    openEditor('habit', id, true)
  }

  return (
    <TodaySection id="habit-column-title" title="打卡" testId="habit-column" className={className}>
      {habits.length === 0 && <p className="py-2 text-[14px] text-(--text-muted)">还没有习惯</p>}
      {due.length > 0 && (
        <ul>
          {due.map((habit) => (
            <HabitRow key={habit.id} habit={habit} lanes={lanes} today={today} due />
          ))}
        </ul>
      )}
      {off.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showOff}
            onClick={() => setShowOff((open) => !open)}
            className="flex items-center gap-1 pt-1 text-[12px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
          >
            今天不用打 {off.length}
            <ChevronDownIcon
              aria-hidden
              className={`size-3.5 transition-transform duration-(--dur-fast) ${showOff ? 'rotate-180' : ''}`}
            />
          </button>
          {showOff && (
            <ul>
              {off.map((habit) => (
                <HabitRow key={habit.id} habit={habit} lanes={lanes} today={today} due={false} />
              ))}
            </ul>
          )}
        </>
      )}
      <button
        type="button"
        onClick={addHabit}
        className="flex min-h-9 w-full items-center rounded-[6px] text-[14px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
      >
        + 新习惯
      </button>
    </TodaySection>
  )
}
