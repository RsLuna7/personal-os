import type { Todo } from '@/data/schema'
import { fromDay, toDay } from '@/features/timeline/days'
import { inboxGroups } from './inbox'

const today = toDay('2026-11-12') // 周四

function todo(id: string, date: string | null, overrides: Partial<Todo> = {}): Todo {
  return {
    id,
    title: id,
    date,
    done: false,
    laneId: null,
    createdAt: `2026-11-01T00:00:0${id.length}.000Z`,
    ...overrides,
  }
}

it('returns nothing for no todos', () => expect(inboxGroups([], today)).toEqual([]))

it('puts unscheduled todos first', () => {
  const groups = inboxGroups([todo('a', '2026-11-13'), todo('b', null)], today)
  expect(groups.map((g) => [g.key, g.title, g.todos.map((t) => t.id)])).toEqual([
    ['unscheduled', '未安排', ['b']],
    ['2026-11-13', '明天', ['a']],
  ])
})

it('names the day after tomorrow and later days', () => {
  const groups = inboxGroups(
    [todo('a', '2026-11-14'), todo('b', '2026-11-15'), todo('c', '2026-11-19')],
    today,
  )
  expect(groups.map((g) => g.title)).toEqual(['后天', '11月15日 周日', '11月19日 周四'])
})

it('leaves out today, overdue and days beyond the next seven', () => {
  const groups = inboxGroups(
    [
      todo('a', '2026-11-12'),
      todo('b', '2026-11-10'),
      todo('c', fromDay(today + 8)),
      todo('d', fromDay(today + 7)),
    ],
    today,
  )
  expect(groups.flatMap((g) => g.todos.map((t) => t.id))).toEqual(['d'])
})

it('hides done todos unless they are lingering', () => {
  const done = todo('a', null, { done: true })
  expect(inboxGroups([done], today)).toEqual([])
  expect(inboxGroups([done], today, new Set(['a']))[0].todos).toEqual([done])
})

it('sorts each group by creation time', () => {
  const late = todo('late', null, { createdAt: '2026-11-05T00:00:00.000Z' })
  const early = todo('early', null, { createdAt: '2026-11-02T00:00:00.000Z' })
  expect(inboxGroups([late, early], today)[0].todos.map((t) => t.id)).toEqual(['early', 'late'])
})
