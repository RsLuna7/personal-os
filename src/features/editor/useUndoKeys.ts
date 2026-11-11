import { useEffect } from 'react'
import { useStore } from '@/data/store'

/** 正在输入文字时不响应任何快捷键。 */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.matches('input, textarea, select') || target.isContentEditable
}

/** 焦点在别的按钮、菜单或面板里时，不把按键当成对选中项的操作。 */
export function isBusyElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.closest('button, a, [role="menu"], [role="dialog"]') !== null
}

/** 撤销和重做的键盘快捷键；不依赖具体页面，时间线和板块页共用。 */
export function useUndoKeys(enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isTyping(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'z') {
        event.preventDefault()
        const { undo, redo } = useStore.getState()
        if (event.shiftKey) redo()
        else undo()
      } else if (key === 'y') {
        event.preventDefault()
        useStore.getState().redo()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
