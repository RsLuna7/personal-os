import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { routeHref } from '@/app/useHashRoute'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { openEditor } from '@/features/editor/editorStore'
import { isBusyElsewhere, isTyping } from '@/features/editor/useUndoKeys'
import { addDays, fromDay, toDay } from '@/features/timeline/days'
import { MAX_YEAR, MIN_YEAR, monthParam, shiftMonth, type MonthRef } from './month'
import { addMilestoneOnDay } from './useCalendarDrag'

type ItemKind = 'phase' | 'milestone'

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

function deleteItem(kind: ItemKind, id: string): void {
  const { data, removePhase, removeMilestone } = useStore.getState()
  if (kind === 'phase') {
    const phase = data.phases.find((item) => item.id === id)
    if (!phase) return
    removePhase(id)
    showDeleteToast(phase.name)
  } else {
    const milestone = data.milestones.find((item) => item.id === id)
    if (!milestone) return
    removeMilestone(id)
    showDeleteToast(milestone.name)
  }
}

/** 按方向键把项目挪一天；endOnly 时只动阶段的结束日期（节点不动）。 */
function nudgeItem(kind: ItemKind, id: string, delta: number, endOnly: boolean): void {
  const store = useStore.getState()
  if (kind === 'milestone') {
    if (endOnly) return
    const milestone = store.data.milestones.find((item) => item.id === id)
    if (milestone) store.updateMilestone(id, { date: addDays(milestone.date, delta) })
    return
  }
  const phase = store.data.phases.find((item) => item.id === id)
  if (!phase) return
  if (endOnly) {
    const end = addDays(phase.end, delta)
    // 阶段最短 1 天：结束日期（不含当天）必须在开始日期之后
    if (toDay(end) > toDay(phase.start)) store.updatePhase(id, { end })
    return
  }
  store.updatePhase(id, { start: addDays(phase.start, delta), end: addDays(phase.end, delta) })
}

interface Options {
  month: MonthRef
  today: number
}

/**
 * 日历的键盘：日期格是一个 roving tabindex（同一时刻只有一格能 Tab 进去），
 * 方向键在日期之间走；色条和圆点上用方向键挪动、Delete 删除。
 */
export function useCalendarKeys({ month, today }: Options): {
  /** 当前能 Tab 进去的那一天 */
  tabDay: number
  onDayFocus: (day: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
} {
  const [focusDay, setFocusDay] = useState<number | null>(null)
  // 翻月或者元素被重新挂载之后，等页面画好再把焦点放过去；几次渲染里都找不到就放弃
  const pending = useRef<{ selector: string; tries: number } | null>(null)

  useLayoutEffect(() => {
    const job = pending.current
    if (!job) return
    const element = document.querySelector<HTMLElement>(job.selector)
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

  const focusLater = (selector: string) => {
    pending.current = { selector, tries: 3 }
  }

  const goToDay = (day: number) => {
    const target = monthOf(day)
    if (target.year < MIN_YEAR || target.year > MAX_YEAR) return
    setFocusDay(day)
    const selector = `[data-day="${day}"]`
    if (target.year === month.year && target.month === month.month) {
      document.querySelector<HTMLElement>(selector)?.focus()
      return
    }
    focusLater(selector)
    window.location.hash = routeHref('calendar', monthParam(target))
  }

  const onDayKey = (event: KeyboardEvent<HTMLElement>, day: number) => {
    const arrows: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    if (event.key in arrows) {
      event.preventDefault()
      goToDay(day + arrows[event.key]!)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      addMilestoneOnDay(day)
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
        store.select({ kind, id })
        openEditor(kind, id)
        return
      case 'Escape':
        store.select(null)
        return
      case 'Delete': {
        event.preventDefault()
        const startDay =
          kind === 'phase'
            ? store.data.phases.find((item) => item.id === id)?.start
            : store.data.milestones.find((item) => item.id === id)?.date
        if (startDay) focusLater(`[data-day="${toDay(startDay)}"]`)
        deleteItem(kind, id)
        return
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        event.preventDefault()
        store.select({ kind, id })
        focusLater(`[data-testid="${kind}-${id}"]`)
        nudgeItem(kind, id, event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey)
        return
      }
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    // 输入框、对话框、菜单、“+N 项”弹出层（它在 React 树里属于网格）里的按键不归网格管
    if (isTyping(target) || isBusyElsewhere(target)) return

    if (target.dataset.day !== undefined) {
      onDayKey(event, Number(target.dataset.day))
    } else if (target.dataset.item === 'phase' || target.dataset.item === 'milestone') {
      onItemKey(event, target.dataset.item, target.dataset.itemId ?? '')
    }
  }

  return { tabDay, onDayFocus: setFocusDay, onKeyDown }
}
