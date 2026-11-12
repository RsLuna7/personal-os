import type { Todo } from '@/data/schema'
import { toDay } from '@/features/timeline/days'
import { homeTodos, limitTodos } from './todayTodos'

const today = toDay('2026-11-12')
let n = 0
const todo = (title: string, date: string | null, done = false): Todo => ({
  id: `t${++n}`,
  title,
  date,
  done,
  laneId: null,
  createdAt: `2026-11-01T00:00:0${n % 10}Z`,
})

it('puts overdue, unfinished to-dos first, oldest first, and today after', () => {
  const list = [
    todo('今天 A', '2026-11-12'),
    todo('前天', '2026-11-10'),
    todo('昨天', '2026-11-11'),
    todo('昨天做完了', '2026-11-11', true),
    todo('明天', '2026-11-13'),
    todo('没安排', null),
  ]
  const result = homeTodos(list, today)
  expect(result.overdue.map((item) => item.title)).toEqual(['前天', '昨天'])
  expect(result.today.map((item) => item.title)).toEqual(['今天 A'])
})

it('keeps finished to-dos for today apart, outside the list', () => {
  const list = [todo('已做', '2026-11-12', true), todo('待做', '2026-11-12')]
  const result = homeTodos(list, today)
  expect(result.today.map((item) => item.title)).toEqual(['待做'])
  expect(result.doneToday.map((item) => item.title)).toEqual(['已做'])
})

it('keeps a just-ticked to-do where it was', () => {
  const ticked = todo('刚勾掉', '2026-11-10', true)
  const result = homeTodos([ticked], today, new Set([ticked.id]))
  expect(result.overdue.map((item) => item.title)).toEqual(['刚勾掉'])
  expect(homeTodos([ticked], today).overdue).toEqual([])
})

it('shows at most five, overdue first, and counts the rest', () => {
  const overdue = [1, 2, 3].map((i) => todo(`过期${i}`, '2026-11-10'))
  const todays = [1, 2, 3, 4].map((i) => todo(`今天${i}`, '2026-11-12'))
  const shown = limitTodos({ overdue, today: todays })
  expect(shown.overdue).toHaveLength(3)
  expect(shown.today.map((item) => item.title)).toEqual(['今天1', '今天2'])
  expect(shown.hidden).toBe(2)
})
