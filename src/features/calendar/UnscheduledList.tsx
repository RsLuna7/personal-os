import { useState, type FormEvent, type KeyboardEvent, type PointerEvent } from 'react'
import { Input } from '@/components/ui/input'
import { NAME_MAX, type Lane, type Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { colorOfLane } from './cells'
import { TodoItem } from './TodoItem'
import type { MoveTarget, Preview } from './useCalendarDrag'

interface UnscheduledListProps {
  todos: Todo[]
  lanes: Lane[]
  preview: Preview | null
  onMoveStart: (event: PointerEvent<HTMLElement>, target: MoveTarget) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
}

/** 没有日期的待办。可以在这里新建、勾选、点开编辑，也可以拖进某一天的格子。 */
export function UnscheduledList({
  todos,
  lanes,
  preview,
  onMoveStart,
  onKeyDown,
}: UnscheduledListProps) {
  const [title, setTitle] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = title.trim().slice(0, NAME_MAX)
    if (clean === '') return
    useStore.getState().addTodo({ title: clean })
    setTitle('')
  }

  return (
    <aside
      aria-label="未安排"
      data-testid="unscheduled"
      onKeyDown={onKeyDown}
      className="flex min-h-0 w-64 shrink-0 flex-col gap-3 rounded-[16px] bg-(--bg-card) p-4 shadow-(--shadow-card)"
    >
      <h2 className="flex items-center gap-2 font-serif text-[18px] font-bold text-(--text)">
        未安排
        <span className="rounded-full bg-(--bg-panel) px-2 py-px font-sans text-[12px] font-medium text-(--text-muted)">
          {todos.length}
        </span>
      </h2>
      <form onSubmit={submit}>
        <Input
          aria-label="新建未安排的待办"
          placeholder="添加待办，回车确认"
          value={title}
          maxLength={NAME_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
      </form>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {todos.length === 0 ? (
          <p className="text-[12px] text-(--text-muted)">
            没有未安排的待办。拖到日期上就有日期了。
          </p>
        ) : (
          todos.map((todo) => (
            <TodoItem
              key={todo.id}
              todo={todo}
              color={colorOfLane(lanes, todo.laneId)}
              dragging={preview?.kind === 'todo' && preview.id === todo.id}
              onMoveStart={onMoveStart}
            />
          ))
        )}
      </div>
    </aside>
  )
}
