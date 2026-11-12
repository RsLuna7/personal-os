import type { PointerEvent, ReactNode } from 'react'
import { CheckIcon, type LucideIcon } from 'lucide-react'
import type { Lane, Todo } from '@/data/schema'
import { colorOfLane } from '@/features/calendar/cells'
import { openEditor } from '@/features/editor/editorStore'

interface TodayTodoRowProps {
  todo: Todo
  lanes: Lane[]
  onToggle: (todo: Todo) => void
  /** 标题右侧的小字，比如过期待办原来的日期 */
  meta?: ReactNode
  /** 悬停或聚焦这一行时出现的操作按钮 */
  actions: ReactNode
  /** 按下时可能开始拖拽（宽屏才有） */
  onPointerDown?: (event: PointerEvent<HTMLLIElement>, todo: Todo) => void
  dragging?: boolean
}

/** 今日页的一行待办：勾选框、板块色条、标题（点开编辑）、悬停操作。 */
export function TodayTodoRow({
  todo,
  lanes,
  onToggle,
  meta,
  actions,
  onPointerDown,
  dragging = false,
}: TodayTodoRowProps) {
  return (
    <li
      data-testid={`todo-${todo.id}`}
      data-item-id={todo.id}
      data-lane-color={colorOfLane(lanes, todo.laneId)}
      data-done={String(todo.done)}
      data-dragging={String(dragging)}
      onPointerDown={onPointerDown && ((event) => onPointerDown(event, todo))}
      className="todo-item group flex min-h-9 items-center gap-2.5 text-[14px]"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={`完成「${todo.title}」`}
        onPointerDown={(event) => event.stopPropagation()}
        className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-(--sand-8) bg-(--bg-card) text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
        onClick={() => onToggle(todo)}
      >
        {todo.done && <CheckIcon aria-hidden className="size-3" />}
      </button>
      <span aria-hidden className="todo-bar h-4" />
      <button
        type="button"
        className="todo-title min-w-0 flex-1 cursor-pointer truncate rounded-[4px] text-left focus-visible:outline-2 focus-visible:outline-(--text)"
        title={todo.title}
        onClick={() => openEditor('todo', todo.id)}
      >
        {todo.title}
      </button>
      {meta}
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-(--dur-fast) group-focus-within:opacity-100 group-hover:opacity-100">
        {actions}
      </span>
    </li>
  )
}

/** 行尾的小图标按钮。label 形如“推到明天「标题」”，悬停提示只显示前半句。 */
export function RowAction({
  label,
  icon: Icon,
  onClick,
  danger = false,
}: {
  label: string
  icon: LucideIcon
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label.replace(/「.*」$/, '')}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={`inline-flex size-6 items-center justify-center rounded-[6px] text-(--text-muted) hover:bg-(--bg-subtle) focus-visible:outline-2 focus-visible:outline-(--text) ${danger ? 'hover:text-(--danger)' : 'hover:text-(--text)'}`}
    >
      <Icon aria-hidden className="size-3.5" />
    </button>
  )
}
