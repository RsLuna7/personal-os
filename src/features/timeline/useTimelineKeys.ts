import { useEffect } from 'react'
import { useStore } from '@/data/store'
import { showDeleteToast } from '@/features/editor/deleteToast'
import { openEditor } from '@/features/editor/editorStore'
import { addDays, toDay } from './days'
import { WEEK } from './snap'
import type { Viewport } from './useViewport'

/** 正在输入文字时不响应任何快捷键。 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select') || target.isContentEditable
}

/** 焦点在别的按钮、菜单或面板里时，不把按键当成对选中项的操作。 */
function isBusyElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('button, a, [role="menu"], [role="dialog"]') !== null
}

function moveSelection(weeks: number, resize: boolean): void {
  const { selection, data, updatePhase, updateMilestone } = useStore.getState()
  if (!selection) return
  const days = weeks * WEEK

  if (selection.kind === 'milestone') {
    const milestone = data.milestones.find((item) => item.id === selection.id)
    if (milestone && !resize) updateMilestone(milestone.id, { date: addDays(milestone.date, days) })
    return
  }

  const phase = data.phases.find((item) => item.id === selection.id)
  if (!phase) return
  if (!resize) {
    updatePhase(phase.id, { start: addDays(phase.start, days), end: addDays(phase.end, days) })
    return
  }
  // 只动结束日期，阶段最短一周
  const end = addDays(phase.end, days)
  if (toDay(end) - toDay(phase.start) < WEEK) return
  updatePhase(phase.id, { end })
}

function deleteSelection(): void {
  const { selection, data, removePhase, removeMilestone } = useStore.getState()
  if (!selection) return
  if (selection.kind === 'phase') {
    const phase = data.phases.find((item) => item.id === selection.id)
    if (!phase) return
    removePhase(phase.id)
    showDeleteToast(phase.name)
  } else {
    const milestone = data.milestones.find((item) => item.id === selection.id)
    if (!milestone) return
    removeMilestone(milestone.id)
    showDeleteToast(milestone.name)
  }
}

/** 时间线的键盘快捷键，见设计文档第 3 节的按键表。 */
export function useTimelineKeys(viewport: Pick<Viewport, 'goToToday'>): void {
  const { goToToday } = viewport

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const store = useStore.getState()
      const mod = event.ctrlKey || event.metaKey

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        store.redo()
        return
      }
      if (mod || event.altKey || isBusyElsewhere(event.target)) return

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          if (!store.selection) return
          event.preventDefault()
          moveSelection(event.key === 'ArrowLeft' ? -1 : 1, event.shiftKey)
          return
        case 'Delete':
          if (!store.selection) return
          event.preventDefault()
          deleteSelection()
          return
        case 'Enter':
          if (!store.selection) return
          event.preventDefault()
          openEditor(store.selection.kind, store.selection.id)
          return
        case 'Escape':
          store.select(null)
          return
        case 't':
        case 'T':
          goToToday()
          return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goToToday])
}
