import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import type { Lane, Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { colorOfLane } from '@/features/calendar/cells'
import { fromDay, toDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'
import { SectionHeader } from './SectionHeader'
import { homeTodos, limitTodos } from './todayTodos'

/** 勾掉以后在原位停留多久再收进“已完成”（Things 的做法：手刚点下去，列表别跳） */
export const LINGER_MS = 1500

interface TodoRowProps {
  todo: Todo
  lanes: Lane[]
  overdue: boolean
  onToggle: (todo: Todo) => void
}

/** 一行待办：勾选框、板块色条、标题；过期的在右边写原来的日期。 */
function TodoRow({ todo, lanes, overdue, onToggle }: TodoRowProps) {
  return (
    <li
      data-testid={`home-todo-${todo.id}`}
      data-lane-color={colorOfLane(lanes, todo.laneId)}
      data-done={String(todo.done)}
      className="todo-item flex min-h-9 items-center gap-2.5 text-[14px]"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.done}
        aria-label={`完成「${todo.title}」`}
        className="inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-(--sand-8) bg-(--bg-card) text-(--text) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--text)"
        onClick={() => onToggle(todo)}
      >
        {todo.done && <CheckIcon aria-hidden className="size-3" />}
      </button>
      <span aria-hidden className="todo-bar h-4" />
      <span className="todo-title min-w-0 flex-1 truncate" title={todo.title}>
        {todo.title}
      </span>
      {overdue && todo.date && (
        <span className="shrink-0 text-[12px] text-(--danger)">{formatDay(toDay(todo.date))}</span>
      )}
    </li>
  )
}

interface TodoBoardProps {
  todos: Todo[]
  lanes: Lane[]
  today: number
}

/**
 * 主页的待办：过期没做完的和今天的，最多 5 条，可以直接勾掉。
 * - 过期的可以一键全部移到今天（Todoist 的做法），算一步撤销；
 * - 勾掉的先在原位停留一会儿再收进最下面一行“已完成 N”，不占 5 条的名额（滴答清单、Things 的做法）。
 * 安排、补充、改日期去日历（以后是“今日”页）。什么都没有时整块不显示。
 */
export function TodoBoard({ todos, lanes, today }: TodoBoardProps) {
  // 刚勾掉、还在原位停留的待办
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set())
  const [showDone, setShowDone] = useState(false)
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const groups = useMemo(() => homeTodos(todos, today, lingering), [todos, today, lingering])
  const total = groups.overdue.length + groups.today.length + groups.doneToday.length
  if (total === 0) return null
  const shown = limitTodos(groups)

  const toggle = (todo: Todo) => {
    useStore.getState().toggleTodo(todo.id)
    const timer = timers.current.get(todo.id)
    if (timer) clearTimeout(timer)
    if (todo.done) {
      // 取消勾选：立刻回到清单里
      timers.current.delete(todo.id)
      setLingering((current) => withOut(current, todo.id))
      return
    }
    setLingering((current) => new Set(current).add(todo.id))
    timers.current.set(
      todo.id,
      setTimeout(() => {
        timers.current.delete(todo.id)
        setLingering((current) => withOut(current, todo.id))
      }, LINGER_MS),
    )
  }

  const moveOverdueToToday = () => {
    useStore.getState().moveTodos(
      groups.overdue.filter((todo) => !todo.done).map((todo) => todo.id),
      fromDay(today),
    )
  }

  return (
    <section aria-labelledby="todo-board-title" data-testid="todo-board">
      <SectionHeader id="todo-board-title" title="待办">
        <a
          href="#/calendar"
          className="text-[13px] text-(--text-muted) transition-colors duration-(--dur-fast) ease-(--ease-out) hover:text-(--text)"
        >
          {shown.hidden > 0 ? `还有 ${shown.hidden} 项 · ` : ''}去日历 →
        </a>
      </SectionHeader>
      <div className="rounded-[16px] bg-(--bg-card) px-5 py-3 shadow-(--shadow-card)">
        {shown.overdue.length > 0 && (
          <>
            <div className="flex items-center pt-1">
              <h3 className="mr-auto text-[12px] text-(--danger)">过期 {groups.overdue.length}</h3>
              <button
                type="button"
                onClick={moveOverdueToToday}
                className="rounded-[4px] px-1 text-[12px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
              >
                全部移到今天
              </button>
            </div>
            <ul>
              {shown.overdue.map((todo) => (
                <TodoRow key={todo.id} todo={todo} lanes={lanes} overdue onToggle={toggle} />
              ))}
            </ul>
          </>
        )}
        {shown.today.length > 0 && (
          <>
            <h3 className="pt-1 text-[12px] text-(--text-muted)">今天 {groups.today.length}</h3>
            <ul>
              {shown.today.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  lanes={lanes}
                  overdue={false}
                  onToggle={toggle}
                />
              ))}
            </ul>
          </>
        )}
        {groups.doneToday.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone((open) => !open)}
              className="flex items-center gap-1 pt-1 text-[12px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
            >
              已完成 {groups.doneToday.length}
              <ChevronDownIcon
                aria-hidden
                className={`size-3.5 transition-transform duration-(--dur-fast) ${showDone ? 'rotate-180' : ''}`}
              />
            </button>
            {showDone && (
              <ul>
                {groups.doneToday.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    lanes={lanes}
                    overdue={false}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function withOut(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set
  const next = new Set(set)
  next.delete(id)
  return next
}
