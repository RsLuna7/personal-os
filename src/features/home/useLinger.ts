import { useEffect, useRef, useState } from 'react'
import type { Todo } from '@/data/schema'
import { useStore } from '@/data/store'

/** 勾掉以后在原位停留多久再收进“已完成”（Things 的做法：手刚点下去，列表别跳） */
export const LINGER_MS = 1500

/**
 * 勾选待办，并记下哪些是刚勾掉、还在原位停留的。
 * 取消勾选立刻回到清单里；勾上的过 LINGER_MS 再从 lingering 里拿掉。
 */
export function useLinger(): { lingering: ReadonlySet<string>; toggle: (todo: Todo) => void } {
  const [lingering, setLingering] = useState<ReadonlySet<string>>(new Set())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => clearTimeout(timer))
  }, [])

  const toggle = (todo: Todo) => {
    useStore.getState().toggleTodo(todo.id)
    const timer = timers.current.get(todo.id)
    if (timer) clearTimeout(timer)
    if (todo.done) {
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

  return { lingering, toggle }
}

function withOut(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (!set.has(id)) return set
  const next = new Set(set)
  next.delete(id)
  return next
}
