import { useMemo } from 'react'
import { useStore } from '@/data/store'
import { closeEditor, useEditorStore } from '@/features/editor/editorStore'
import { HabitEditor } from '@/features/editor/HabitEditor'
import { TodoEditor } from '@/features/editor/TodoEditor'
import { homeTodos } from '@/features/home/todayTodos'
import { fromDay, toDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'
import { mondayOf } from '@/features/timeline/snap'
import { isHolidayName, weekLabel } from '@/features/timeline/ticks'
import { useToday } from '@/features/timeline/useToday'
import { HabitColumn } from './HabitColumn'
import { isDue, weekdayOf } from './habits'
import { InboxColumn } from './InboxColumn'
import { TodayColumn } from './TodayColumn'
import { useColumnDrag } from './useColumnDrag'

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/**
 * 今日页：收件箱 | 今天 | 打卡。宽屏（≥1024）三栏并排、能从收件箱拖进今天；
 * 窄一些就上下排，顺序是今天、打卡、收件箱。
 */
export function TodayPage() {
  const data = useStore((state) => state.data)
  const editing = useEditorStore((state) => state.editing)
  const today = useToday()
  const drag = useColumnDrag({ today })
  const draggingId = drag.dragging?.todo.id ?? null

  const week = useMemo(() => {
    const spans = data.terms.map((term) => ({
      start: toDay(term.start),
      end: toDay(term.end),
      holiday: isHolidayName(term.name),
    }))
    const label = weekLabel(mondayOf(today), spans)
    // 学期外 weekLabel 给的是日期数字，页头不需要
    return label.startsWith('第') ? label : null
  }, [data.terms, today])

  const progress = useMemo(() => {
    const groups = homeTodos(data.todos, today)
    const todoTotal = groups.today.length + groups.doneToday.length
    const due = data.habits.filter((habit) => isDue(habit, today))
    const checked = due.filter((habit) => habit.checks.includes(fromDay(today)))
    return `待办 ${groups.doneToday.length}/${todoTotal} · 打卡 ${checked.length}/${due.length}`
  }, [data.todos, data.habits, today])

  return (
    <div
      data-testid="today-page"
      className="min-h-0 flex-1 overflow-y-auto bg-(--bg-canvas) select-none"
    >
      <div className="mx-auto flex max-w-[1280px] flex-col gap-6 px-6 py-6">
        <header
          data-testid="today-header"
          className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
        >
          <h1 className="font-serif text-[24px] font-bold text-(--text)">
            {`${formatDay(today)} ${WEEKDAY_NAMES[weekdayOf(today) - 1]}`}
          </h1>
          {week && <span className="text-[14px] text-(--text-muted)">{week}</span>}
          <span className="ml-auto text-[13px] text-(--text-muted) tabular-nums">{progress}</span>
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr_1fr]">
          <TodayColumn
            className="lg:order-2"
            todos={data.todos}
            lanes={data.lanes}
            today={today}
            dropActive={drag.over === 'today'}
            draggingId={draggingId}
            onRowPointerDown={(event, todo) => drag.onRowPointerDown(event, todo, 'today')}
          />
          <HabitColumn
            className="lg:order-3"
            habits={data.habits}
            lanes={data.lanes}
            today={today}
          />
          <InboxColumn
            className="lg:order-1"
            todos={data.todos}
            lanes={data.lanes}
            today={today}
            dropActive={drag.over === 'inbox'}
            draggingId={draggingId}
            onRowPointerDown={(event, todo) => drag.onRowPointerDown(event, todo, 'inbox')}
          />
        </div>
      </div>
      {drag.dragging && (
        <div
          aria-hidden
          className="pointer-events-none fixed top-0 left-0 z-50 max-w-60 truncate rounded-[8px] bg-(--bg-card) px-3 py-1.5 text-[14px] text-(--text) opacity-90 shadow-(--shadow-card)"
          style={{
            transform: `translate(${drag.dragging.x + 12}px, ${drag.dragging.y + 8}px)`,
          }}
        >
          {drag.dragging.todo.title}
        </div>
      )}
      {editing?.kind === 'todo' && (
        <TodoEditor
          todoId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
      {editing?.kind === 'habit' && (
        <HabitEditor
          habitId={editing.id}
          anchor={null}
          selectName={editing.selectName}
          onClose={closeEditor}
        />
      )}
    </div>
  )
}
