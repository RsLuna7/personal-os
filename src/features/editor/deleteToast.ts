import { toast } from 'sonner'
import { useStore } from '@/data/store'

const TOAST_ID = 'undo-toast'
export const UNDO_TOAST_MS = 5000

let stopWatching: (() => void) | null = null

/**
 * 底部提示条，带“撤销”。5 秒后消失；期间只要数据再变（包括点了撤销），立即消失，
 * 避免“撤销”撤掉的不是提示里说的那一步。
 */
export function showUndoToast(message: string): void {
  stopWatching?.()
  const shownFor = useStore.getState().data
  stopWatching = useStore.subscribe((state) => {
    if (state.data === shownFor) return
    stopWatching?.()
    stopWatching = null
    toast.dismiss(TOAST_ID)
  })
  toast(message, {
    id: TOAST_ID,
    duration: UNDO_TOAST_MS,
    action: { label: '撤销', onClick: () => useStore.getState().undo() },
  })
}

export function showDeleteToast(name: string): void {
  showUndoToast(`已删除「${name}」`)
}
