import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { routeHref } from '@/app/useHashRoute'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { openEditor } from '@/features/editor/editorStore'
import { isBusyElsewhere, isTyping } from '@/features/editor/useUndoKeys'
import { fromDay, toDay } from '@/features/timeline/days'
import { MAX_YEAR, MIN_YEAR, monthParam, shiftMonth, type MonthRef } from './month'
import { addTodoOnDay } from './useCalendarDrag'

type ItemKind = 'todo' | 'milestone'

function monthOf(day: number): MonthRef {
  const [year, month] = fromDay(day).split('-').map(Number)
  return { year: year!, month: month! }
}

function firstDayOf(ref: MonthRef): number {
  return toDay(`${monthParam(ref)}-01`)
}

function daysIn(ref: MonthRef): number {
  return new Date(Date.UTC(ref.year, ref.month, 0)).getUTCDate()
}

function inRange(day: number): boolean {
  const { year } = monthOf(day)
  return year >= MIN_YEAR && year <= MAX_YEAR
}

/** 条目现在的日期；未安排的待办或找不到时是 null。 */
function dateOfItem(kind: ItemKind, id: string): string | null {
  const { data } = useStore.getState()
  if (kind === 'todo') return data.todos.find((item) => item.id === id)?.date ?? null
  return data.milestones.find((item) => item.id === id)?.date ?? null
}

function deleteItem(kind: ItemKind, id: string): void {
  const { data, removeTodo, removeMilestone } = useStore.getState()
  if (kind === 'todo') {
    const todo = data.todos.find((item) => item.id === id)
    if (!todo) return
    removeTodo(id)
    showDeleteToast(todo.title)
  } else {
    const milestone = data.milestones.find((item) => item.id === id)
    if (!milestone) return
    removeMilestone(id)
    showDeleteToast(milestone.name)
  }
}

/** 把条目改到另一天。 */
function moveItem(kind: ItemKind, id: string, date: string): void {
  const store = useStore.getState()
  if (kind === 'todo') store.updateTodo(id, { date })
  else store.updateMilestone(id, { date })
}

interface Options {
  month: MonthRef
  today: number
}

/**
 * 日历的键盘：日期格是一个 roving tabindex（同一时刻只有一格能 Tab 进去），
 * 方向键在日期之间走，`Enter` 新建待办；待办和节点上用方向键挪动日期、
 * `Enter` 编辑、`Delete` 删除，待办还可以用空格勾选。
 */
export function useCalendarKeys({ month, today }: Options): {
  /** 当前能 Tab 进去的那一天 */
  tabDay: number
  onDayFocus: (day: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
  /** 刚用键盘挪过的那一条：它换到的格子可能已经有三条，要钉住它，焦点才有地方去 */
  movedId: string | null
} {
  const [focusDay, setFocusDay] = useState<number | null>(null)
  const [movedId, setMovedId] = useState<string | null>(null)
  // 翻月或者元素被重新挂载之后，等页面画好再把焦点放过去；几次渲染里都找不到就放弃。
  // 有后备选择器时，找不到目标但找得到后备元素，就改把焦点放到后备元素上
  const pending = useRef<{ selector: string; fallback: string | null; tries: number } | null>(null)

  useLayoutEffect(() => {
    const job = pending.current
    if (!job) return
    const element =
      document.querySelector<HTMLElement>(job.selector) ??
      (job.fallback ? document.querySelector<HTMLElement>(job.fallback) : null)
    if (element) {
      pending.current = null
      element.focus()
    } else if (--job.tries <= 0) {
      pending.current = null
    }
  })

  const first = firstDayOf(month)
  const last = first + daysIn(month) - 1
  const fallback = today >= first && today <= last ? today : first
  const tabDay = focusDay !== null && focusDay >= first && focusDay <= last ? focusDay : fallback

  const focusLater = (selector: string, fallbackSelector: string | null = null) => {
    pending.current = { selector, fallback: fallbackSelector, tries: 3 }
  }

  /** 翻到 day 所在的月（已经在这个月就什么都不做）。 */
  const showMonthOf = (day: number) => {
    const target = monthOf(day)
    if (target.year === month.year && target.month === month.month) return
    window.location.hash = routeHref('calendar', monthParam(target))
  }

  const goToDay = (day: number) => {
    if (!inRange(day)) return
    setFocusDay(day)
    const selector = `[data-day="${day}"]`
    if (monthOf(day).month === month.month && monthOf(day).year === month.year) {
      document.querySelector<HTMLElement>(selector)?.focus()
      return
    }
    focusLater(selector)
    showMonthOf(day)
  }

  const onDayKey = (event: KeyboardEvent<HTMLElement>, day: number) => {
    const arrows: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    setMovedId(null)
    if (event.key in arrows) {
      event.preventDefault()
      goToDay(day + arrows[event.key]!)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      addTodoOnDay(day)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      const next = shiftMonth(month, event.key === 'PageUp' ? -1 : 1)
      if (!next) return
      const dayOfMonth = Number(fromDay(day).slice(8))
      goToDay(firstDayOf(next) + Math.min(dayOfMonth, daysIn(next)) - 1)
    } else if (event.key === 't' || event.key === 'T') {
      event.preventDefault()
      goToDay(today)
    }
  }

  const onItemKey = (event: KeyboardEvent<HTMLElement>, kind: ItemKind, id: string) => {
    const store = useStore.getState()
    switch (event.key) {
      case 'Enter':
        event.preventDefault()
        if (kind === 'milestone') store.select({ kind, id })
        openEditor(kind, id)
        return
      case ' ':
        // 空格：勾选待办（节点没有完成状态）
        event.preventDefault()
        if (kind === 'todo') store.toggleTodo(id)
        return
      case 'Escape':
        if (kind === 'milestone') store.select(null)
        return
      case 'Delete': {
        event.preventDefault()
        const date = dateOfItem(kind, id)
        focusLater(date ? `[data-day="${toDay(date)}"]` : '[data-day][tabindex="0"]')
        deleteItem(kind, id)
        return
      }
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        event.preventDefault()
        if (kind === 'milestone') store.select({ kind, id })
        const date = dateOfItem(kind, id)
        // 未安排的待办没有日期可挪
        if (date === null) return
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key]!
        const day = toDay(date) + delta
        if (!inRange(day)) return
        // 条目换了格子会重新挂载，所以等页面画好再把焦点放回去；
        // 挪到别的月时页面跟着翻月；万一条目找不到，焦点退回那一天的格子
        focusLater(`[data-item-id="${id}"]`, `[data-day="${day}"]`)
        setMovedId(id)
        setFocusDay(day)
        moveItem(kind, id, fromDay(day))
        showMonthOf(day)
        return
      }
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    // 输入框、对话框、菜单、勾选控件里的按键不归网格管
    if (isTyping(target) || isBusyElsewhere(target)) return

    if (target.dataset.day !== undefined) {
      onDayKey(event, Number(target.dataset.day))
    } else if (target.dataset.item === 'todo' || target.dataset.item === 'milestone') {
      onItemKey(event, target.dataset.item, target.dataset.itemId ?? '')
    }
  }

  return { tabDay, onDayFocus: setFocusDay, onKeyDown, movedId }
}
