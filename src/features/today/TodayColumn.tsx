import { useMemo, useState, type PointerEvent } from 'react'
import { ChevronDownIcon, InboxIcon, SunriseIcon, Trash2Icon } from 'lucide-react'
import { NAME_MAX, type ISODate, type Lane, type Todo } from '@/data/schema'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { homeTodos } from '@/features/home/todayTodos'
import { useLinger } from '@/features/home/useLinger'
import { fromDay, toDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'
import { GroupTitle, TodaySection } from './TodaySection'
import { RowAction, TodayTodoRow } from './TodayTodoRow'

interface TodayColumnProps {
  todos: Todo[]
  lanes: Lane[]
  today: number
  /** 收件箱里的待办正被拖到这一栏上方 */
  dropActive?: boolean
  onRowPointerDown?: (event: PointerEvent<HTMLLIElement>, todo: Todo) => void
  draggingId?: string | null
  className?: string
}

/**
 * 今日页中间栏：过期的、今天的、今天做完的。规则和首页待办一样（过期可以全部移到今天，
 * 勾掉的先停留再收进“已完成”），但不限条数，还能添加、推到明天、移回收件箱、删除。
 */
export function TodayColumn({
  todos,
  lanes,
  today,
  dropActive = false,
  onRowPointerDown,
  draggingId = null,
  className,
}: TodayColumnProps) {
  const { lingering, toggle } = useLinger()
  const [showDone, setShowDone] = useState(false)
  const groups = useMemo(() => homeTodos(todos, today, lingering), [todos, today, lingering])

  const actions = (todo: Todo) => {
    const store = useStore.getState()
    return (
      <>
        {/* 做完的不给挪：挪走以后哪一栏都不显示做完的待办，就找不到了 */}
        {!todo.done && (
          <>
            <RowAction
              label={`推到明天「${todo.title}」`}
              icon={SunriseIcon}
              onClick={() => store.updateTodo(todo.id, { date: fromDay(today + 1) })}
            />
            <RowAction
              label={`移回收件箱「${todo.title}」`}
              icon={InboxIcon}
              onClick={() => store.updateTodo(todo.id, { date: null })}
            />
          </>
        )}
        <RowAction
          label={`删除「${todo.title}」`}
          icon={Trash2Icon}
          danger
          onClick={() => {
            store.removeTodo(todo.id)
            showDeleteToast(todo.title)
          }}
        />
      </>
    )
  }

  const row = (todo: Todo, overdue: boolean) => (
    <TodayTodoRow
      key={todo.id}
      todo={todo}
      lanes={lanes}
      onToggle={toggle}
      onPointerDown={todo.done ? undefined : onRowPointerDown}
      dragging={draggingId === todo.id}
      meta={
        overdue && todo.date ? (
          <span className="shrink-0 text-[12px] text-(--danger)">
            {formatDay(toDay(todo.date))}
          </span>
        ) : undefined
      }
      actions={actions(todo)}
    />
  )

  const empty = groups.overdue.length === 0 && groups.today.length === 0

  return (
    <TodaySection
      id="today-column-title"
      title="今天"
      testId="today-column"
      dropZone="today"
      dropActive={dropActive}
      className={className}
    >
      {groups.overdue.length > 0 && (
        <>
          <div className="flex items-center pt-1">
            <h3 className="mr-auto text-[12px] text-(--danger)">过期 {groups.overdue.length}</h3>
            <button
              type="button"
              onClick={() =>
                useStore.getState().moveTodos(
                  groups.overdue.filter((todo) => !todo.done).map((todo) => todo.id),
                  fromDay(today),
                )
              }
              className="rounded-[4px] px-1 text-[12px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
            >
              全部移到今天
            </button>
          </div>
          <ul>{groups.overdue.map((todo) => row(todo, true))}</ul>
        </>
      )}
      {groups.today.length > 0 && (
        <>
          <GroupTitle>今天 {groups.today.length}</GroupTitle>
          <ul>{groups.today.map((todo) => row(todo, false))}</ul>
        </>
      )}
      {empty && <p className="py-2 text-[14px] text-(--text-muted)">今天没有待办</p>}
      <AddTodo date={fromDay(today)} />
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
          {showDone && <ul>{groups.doneToday.map((todo) => row(todo, false))}</ul>}
        </>
      )}
    </TodaySection>
  )
}

/** “+ 添加今天的待办”：点开是输入框，回车加一条并清空继续输，Esc 或空着失焦就收起。 */
function AddTodo({ date }: { date: ISODate }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-9 w-full items-center rounded-[6px] text-[14px] text-(--text-muted) hover:text-(--text) focus-visible:outline-2 focus-visible:outline-(--text)"
      >
        + 添加今天的待办
      </button>
    )
  }

  const close = () => {
    setValue('')
    setOpen(false)
  }

  return (
    <input
      autoFocus
      aria-label="新待办"
      placeholder="写下要做的事，回车添加"
      maxLength={NAME_MAX}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
          return
        }
        if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
        event.preventDefault()
        const title = value.trim()
        if (title === '') return
        useStore.getState().addTodo({ title, date })
        setValue('')
      }}
      onBlur={() => {
        if (value.trim() === '') close()
      }}
      className="my-1 h-9 w-full rounded-[8px] border border-(--border) bg-(--bg-card) px-2.5 text-[14px] text-(--text) outline-none placeholder:text-(--text-muted) focus:border-(--sand-8)"
    />
  )
}
