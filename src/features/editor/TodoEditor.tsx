import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { showDeleteToast } from './deleteToast'
import { cleanName, DateField, EditorPopover, LaneSelect, NameField } from './fields'

interface TodoEditorProps {
  todoId: string
  anchor: HTMLElement | null
  onClose: () => void
  selectName?: boolean
}

export function TodoEditor({ todoId, anchor, onClose, selectName = false }: TodoEditorProps) {
  const todo = useStore((state) => state.data.todos.find((item) => item.id === todoId))

  // 撤销等操作让这条待办消失时，面板跟着关掉
  useEffect(() => {
    if (!todo) onClose()
  }, [todo, onClose])
  if (!todo) return null

  return (
    <TodoForm key={todo.id} todo={todo} anchor={anchor} onClose={onClose} selectName={selectName} />
  )
}

function TodoForm({
  todo,
  anchor,
  onClose,
  selectName,
}: {
  todo: Todo
  anchor: HTMLElement | null
  onClose: () => void
  selectName: boolean
}) {
  const lanes = useStore((state) => state.data.lanes)
  const updateTodo = useStore((state) => state.updateTodo)
  const removeTodo = useStore((state) => state.removeTodo)
  const doneId = useId()
  const nameInput = useRef<HTMLInputElement | null>(null)

  const save = (patch: Partial<Pick<Todo, 'title' | 'date' | 'done' | 'laneId'>>) =>
    updateTodo(todo.id, patch)

  /** 关闭前把还没失焦的标题存下来 */
  const close = () => {
    const pendingTitle = nameInput.current ? cleanName(nameInput.current.value) : todo.title
    save({ title: pendingTitle })
    onClose()
  }

  return (
    <EditorPopover
      label="编辑待办"
      anchor={anchor}
      anchorSelector={`[data-testid="todo-${todo.id}"]`}
      selectName={selectName}
      onClose={close}
    >
      <NameField
        label="标题"
        value={todo.title}
        onCommit={(title) => save({ title })}
        inputRef={(element) => {
          nameInput.current = element
        }}
      />
      <div className="flex items-end gap-2">
        <DateField
          label="日期"
          value={todo.date ?? ''}
          onCommit={(date) => {
            save({ date })
            return null
          }}
          optional
        />
        {todo.date !== null && (
          <Button variant="ghost" size="sm" onClick={() => save({ date: null })}>
            清除日期
          </Button>
        )}
      </div>
      <LaneSelect
        allowNone
        value={todo.laneId ?? ''}
        lanes={lanes}
        onChange={(laneId) => save({ laneId: laneId === '' ? null : laneId })}
      />
      <div className="flex items-center justify-between">
        <Label htmlFor={doneId}>完成</Label>
        <Switch id={doneId} checked={todo.done} onCheckedChange={(done) => save({ done })} />
      </div>
      <div className="flex justify-end border-t border-(--border) pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-(--danger)"
          onClick={() => {
            removeTodo(todo.id)
            showDeleteToast(todo.title)
            onClose()
          }}
        >
          删除
        </Button>
      </div>
    </EditorPopover>
  )
}
