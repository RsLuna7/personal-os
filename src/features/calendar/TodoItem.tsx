import { CheckIcon } from 'lucide-react'
import type { Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { toDay } from '@/features/timeline/days'
import { formatDayWithYear } from '@/features/timeline/format'
import type { EntryColor } from './cells'
import type { MoveTarget } from './useCalendarDrag'

interface TodoItemProps {
  todo: Todo
  color: EntryColor
  dragging: boolean
  onMoveStart: (event: React.PointerEvent<HTMLElement>, target: MoveTarget) => void
}

/**
 * 一条待办：细竖色条加标题。条目本身是 `role=button`（点开编辑、拖动、键盘操作），
 * 勾选控件是旁边另一个真正的按钮，悬停或聚焦在这一行上时才显示。
 * 条目永远带自己的 `data-lane-color`，不会继承所在格子的底色。
 */
export function TodoItem({ todo, color, dragging, onMoveStart }: TodoItemProps) {
  const when = todo.date === null ? '未安排' : formatDayWithYear(toDay(todo.date))
  return (
    <div className="todo-row relative flex items-center">
      <div
        data-testid={`todo-${todo.id}`}
        role="button"
        tabIndex={0}
        data-item="todo"
        data-item-id={todo.id}
        aria-label={`待办：${todo.title}，${when}，${todo.done ? '已完成' : '未完成'}`}
        data-lane-color={color}
        data-done={String(todo.done)}
        data-dragging={String(dragging)}
        className="todo-item flex min-h-5 min-w-0 flex-1 cursor-grab touch-none items-stretch gap-1.5 text-[12px] select-none"
        onPointerDown={(event) => onMoveStart(event, { kind: 'todo', id: todo.id })}
      >
        <span aria-hidden className="todo-bar" />
        <span className="todo-title truncate self-center" title={todo.title}>
          {todo.title}
        </span>
      </div>
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={`完成「${todo.title}」`}
        // 键盘上用条目上的空格勾选，这里不再多占一个 Tab 位置
        tabIndex={-1}
        data-done={String(todo.done)}
        className="todo-check absolute right-0.5 inline-flex size-4 cursor-pointer items-center justify-center rounded-[4px] border border-(--border) bg-(--bg-card) text-(--text)"
        // 按下勾选控件不是在拖动条目
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => useStore.getState().toggleTodo(todo.id)}
      >
        {todo.done && <CheckIcon aria-hidden className="size-3" />}
      </button>
    </div>
  )
}
