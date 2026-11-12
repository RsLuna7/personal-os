import { useMemo, type PointerEvent } from 'react'
import { ArrowRightIcon } from 'lucide-react'
import type { Lane, Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { useLinger } from '@/features/home/useLinger'
import { fromDay } from '@/features/timeline/days'
import { inboxGroups } from './inbox'
import { GroupTitle, TodaySection } from './TodaySection'
import { RowAction, TodayTodoRow } from './TodayTodoRow'

interface InboxColumnProps {
  todos: Todo[]
  lanes: Lane[]
  today: number
  /** 今天栏里的待办正被拖到这一栏上方 */
  dropActive?: boolean
  onRowPointerDown?: (event: PointerEvent<HTMLLIElement>, todo: Todo) => void
  draggingId?: string | null
  className?: string
}

/** 今日页左栏：没安排日期的，和接下来 7 天的待办。每一行都可以一键移到今天，宽屏还能拖过去。 */
export function InboxColumn({
  todos,
  lanes,
  today,
  dropActive = false,
  onRowPointerDown,
  draggingId = null,
  className,
}: InboxColumnProps) {
  const { lingering, toggle } = useLinger()
  const groups = useMemo(() => inboxGroups(todos, today, lingering), [todos, today, lingering])

  return (
    <TodaySection
      id="inbox-column-title"
      title="收件箱"
      testId="inbox-column"
      dropZone="inbox"
      dropActive={dropActive}
      className={className}
    >
      {groups.length === 0 && <p className="py-2 text-[14px] text-(--text-muted)">收件箱是空的</p>}
      {groups.map((group) => (
        <div key={group.key}>
          <GroupTitle>{group.title}</GroupTitle>
          <ul>
            {group.todos.map((todo) => (
              <TodayTodoRow
                key={todo.id}
                todo={todo}
                lanes={lanes}
                onToggle={toggle}
                onPointerDown={onRowPointerDown}
                dragging={draggingId === todo.id}
                actions={
                  <RowAction
                    label={`移到今天「${todo.title}」`}
                    icon={ArrowRightIcon}
                    onClick={() =>
                      useStore.getState().updateTodo(todo.id, { date: fromDay(today) })
                    }
                  />
                }
              />
            ))}
          </ul>
        </div>
      ))}
    </TodaySection>
  )
}
