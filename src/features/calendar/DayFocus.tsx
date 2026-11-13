import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { PlusIcon, XIcon } from 'lucide-react'
import type { Lane } from '@/data/schema'
import { useStore, type Selection } from '@/data/store'
import { openEditor, useEditorStore } from '@/features/editor/editorStore'
import { fromDay } from '@/features/timeline/days'
import { formatDayWithYear } from '@/features/timeline/format'
import { colorOfLane, type DayEntry } from './cells'
import { DRAG_THRESHOLD_PX } from './drag'
import { MilestoneItem } from './MilestoneItem'
import { TodoItem } from './TodoItem'
import { addTodoOnDay, type MoveTarget } from './useCalendarDrag'

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六']

interface DayFocusProps {
  day: number
  today: number
  entries: DayEntry[]
  lanes: Lane[]
  selection: Selection | null
  onClose: () => void
}

/** 放大视图里的条目只能点开编辑，不能拖：拖动是按月网格换算日期的，在这里会改到卡片底下的那一天。 */
function pressToOpen(event: ReactPointerEvent<HTMLElement>, target: MoveTarget): void {
  if (event.button !== 0) return
  const { clientX, clientY } = event
  const finish = (up: PointerEvent) => {
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
    if (Math.hypot(up.clientX - clientX, up.clientY - clientY) >= DRAG_THRESHOLD_PX) return
    if (target.kind === 'milestone')
      useStore.getState().select({ kind: 'milestone', id: target.id })
    openEditor(target.kind, target.id)
  }
  const cancel = () => {
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', cancel)
  }
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', cancel)
}

function focusableIn(root: HTMLElement): HTMLElement[] {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button, [role="button"], [tabindex="0"], input, a[href]',
    ),
  ].filter((element) => element.tabIndex >= 0 && !element.hasAttribute('disabled'))
}

/**
 * 一天的放大视图：点格子右上角的“+N”打开，那一格放大成页面中央的一张大卡片，
 * 其余页面渐隐成画布底色，只剩这张卡片（过渡见 app/viewTransition.ts、index.css 的 day-surface）。
 * 卡片里列出这一天的全部条目，点开编辑、勾选、新建；Esc、点背景或右上角的叉关闭。
 */
export function DayFocus({ day, today, entries, lanes, selection, onClose }: DayFocusProps) {
  const cardRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    cardRef.current?.querySelector<HTMLElement>('[data-close]')?.focus()
    // 编辑面板开着时，Esc 和点背景归面板，先关面板、不连这张卡片一起关。
    // 用捕获阶段在面板自己处理之前记下“那一刻面板开没开”。
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && useEditorStore.getState().editing === null) closeRef.current()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [])

  const editorWasOpenOnPress = useRef(false)

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.key === 'Tab') {
      // 焦点留在卡片里
      const items = focusableIn(event.currentTarget)
      if (items.length === 0) return
      const first = items[0]!
      const last = items[items.length - 1]!
      if (event.shiftKey && target === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && target === last) {
        event.preventDefault()
        first.focus()
      }
      return
    }
    const kind = target.dataset.item
    const id = target.dataset.itemId
    if ((kind !== 'todo' && kind !== 'milestone') || !id) return
    if (event.key === 'Enter') {
      event.preventDefault()
      if (kind === 'milestone') useStore.getState().select({ kind, id })
      openEditor(kind, id)
    } else if (event.key === ' ' && kind === 'todo') {
      event.preventDefault()
      useStore.getState().toggleTodo(id)
    }
  }

  const iso = fromDay(day)
  const [, month, date] = iso.split('-').map(Number)
  const weekday = WEEKDAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()]
  const todoCount = entries.filter((entry) => entry.kind === 'todo').length
  const milestoneCount = entries.length - todoCount
  const summary =
    entries.length === 0
      ? '这一天还没有安排'
      : [todoCount > 0 && `${todoCount} 个待办`, milestoneCount > 0 && `${milestoneCount} 个节点`]
          .filter(Boolean)
          .join(' · ')

  return createPortal(
    <div data-testid="day-focus" className="day-focus-root">
      <div
        className="day-focus-backdrop"
        aria-hidden
        onPointerDownCapture={() => {
          editorWasOpenOnPress.current = useEditorStore.getState().editing !== null
        }}
        onClick={() => {
          if (editorWasOpenOnPress.current) {
            editorWasOpenOnPress.current = false
            return
          }
          onClose()
        }}
      />
      <section
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${formatDayWithYear(day)}的全部安排`}
        data-day-focus={day}
        onKeyDown={onCardKeyDown}
        className="day-focus-card"
      >
        <header className="day-focus-head">
          <div className="flex items-baseline gap-3">
            <span className="day-focus-date">{date}</span>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-medium text-(--text)">
                {month}月 · 星期{weekday}
              </span>
              <span className="text-[13px] text-(--text-muted)">{summary}</span>
            </div>
            {day === today && <span className="day-focus-today">今天</span>}
          </div>
          <button
            type="button"
            data-close
            aria-label="关闭"
            className="day-focus-close"
            onClick={onClose}
          >
            <XIcon aria-hidden className="size-4" />
          </button>
        </header>
        <div className="day-focus-list" data-testid="day-focus-list">
          {entries.map((entry, index) => (
            <div
              key={
                entry.kind === 'todo' ? `todo-${entry.todo.id}` : `milestone-${entry.milestone.id}`
              }
              className="day-focus-row"
              style={{ '--i': index } as React.CSSProperties}
            >
              {entry.kind === 'todo' ? (
                <TodoItem
                  todo={entry.todo}
                  color={colorOfLane(lanes, entry.todo.laneId)}
                  dragging={false}
                  onMoveStart={pressToOpen}
                />
              ) : (
                <MilestoneItem
                  milestone={entry.milestone}
                  color={colorOfLane(lanes, entry.milestone.laneId)}
                  selected={selection?.kind === 'milestone' && selection.id === entry.milestone.id}
                  dragging={false}
                  onMoveStart={pressToOpen}
                />
              )}
            </div>
          ))}
        </div>
        <footer className="day-focus-foot">
          <button type="button" className="day-focus-add" onClick={() => addTodoOnDay(day)}>
            <PlusIcon aria-hidden className="size-4" />
            添加待办
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
