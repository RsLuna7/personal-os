import type { Todo } from '@/data/schema'
import { toDay } from '@/features/timeline/days'
import { formatDay } from '@/features/timeline/format'
import { weekdayOf } from './habits'

/** 收件箱里显示接下来几天（不含今天）的待办 */
export const INBOX_DAYS = 7

const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export interface InboxGroup {
  /** 'unscheduled' 或那天的日期 */
  key: string
  title: string
  todos: Todo[]
}

function byCreated(a: Todo, b: Todo): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

function dayTitle(day: number, today: number): string {
  if (day === today + 1) return '明天'
  if (day === today + 2) return '后天'
  return `${formatDay(day)} ${WEEKDAY_NAMES[weekdayOf(day) - 1]}`
}

/**
 * 今日页左栏：未安排的待办，再加上接下来 7 天的待办按天分组。只放没做完的；
 * keep 里的刚被勾掉，先留在原位，过一会儿再消失。没有待办的日子不出现。
 */
export function inboxGroups(
  todos: Todo[],
  today: number,
  keep: ReadonlySet<string> = new Set(),
): InboxGroup[] {
  const open = todos.filter((todo) => !todo.done || keep.has(todo.id)).sort(byCreated)
  const groups: InboxGroup[] = []
  const unscheduled = open.filter((todo) => todo.date === null)
  if (unscheduled.length > 0) {
    groups.push({ key: 'unscheduled', title: '未安排', todos: unscheduled })
  }
  for (let day = today + 1; day <= today + INBOX_DAYS; day++) {
    const ofDay = open.filter((todo) => todo.date !== null && toDay(todo.date) === day)
    if (ofDay.length > 0) {
      groups.push({ key: ofDay[0].date!, title: dayTitle(day, today), todos: ofDay })
    }
  }
  return groups
}
