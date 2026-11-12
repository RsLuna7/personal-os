import type { Todo } from '@/data/schema'
import { toDay } from '@/features/timeline/days'

/** 主页待办清单最多显示几条（不算已完成），其余去今日页看 */
export const HOME_TODO_LIMIT = 5

export interface HomeTodos {
  /** 日期在今天之前、还没做完的待办，日期早的在前 */
  overdue: Todo[]
  /** 今天还没做完的待办 */
  today: Todo[]
  /** 今天已经做完的待办：收在最下面一行“已完成 N”，不占清单的名额 */
  doneToday: Todo[]
}

function byCreated(a: Todo, b: Todo): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * 主页“待办”板块要显示的内容：过期没做完的、今天没做完的、今天做完的。没安排日期的不算。
 * keep 里的待办刚被勾掉：先留在原来的位置（显示删除线），过一会儿再收进“已完成”，免得一勾列表就跳。
 */
export function homeTodos(
  todos: Todo[],
  today: number,
  keep: ReadonlySet<string> = new Set(),
): HomeTodos {
  const open = (todo: Todo) => !todo.done || keep.has(todo.id)
  const overdue = todos
    .filter((todo) => todo.date !== null && toDay(todo.date) < today && open(todo))
    .sort((a, b) => a.date!.localeCompare(b.date!) || byCreated(a, b))
  const ofToday = todos.filter((todo) => todo.date !== null && toDay(todo.date) === today)
  return {
    overdue,
    today: ofToday.filter(open).sort(byCreated),
    doneToday: ofToday.filter((todo) => !open(todo)).sort(byCreated),
  }
}

/** 按顺序取前 limit 条：先过期，再今天。返回两组各显示哪些，以及没显示的条数。 */
export function limitTodos(
  { overdue, today }: Pick<HomeTodos, 'overdue' | 'today'>,
  limit: number = HOME_TODO_LIMIT,
): { overdue: Todo[]; today: Todo[]; hidden: number } {
  const shownOverdue = overdue.slice(0, limit)
  const shownToday = today.slice(0, Math.max(0, limit - shownOverdue.length))
  return {
    overdue: shownOverdue,
    today: shownToday,
    hidden: overdue.length + today.length - shownOverdue.length - shownToday.length,
  }
}
