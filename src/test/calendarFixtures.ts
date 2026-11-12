import { createEmptyData, type AppData, type Todo } from '@/data/schema'

/** 测试里造一条待办；不写的字段给出合理的默认值。 */
export function makeTodo(id: string, patch: Partial<Todo> = {}): Todo {
  return {
    id,
    title: id,
    date: null,
    done: false,
    laneId: null,
    createdAt: '2026-11-01T08:00:00.000Z',
    ...patch,
  }
}

/**
 * 日历测试用的数据（今天是 2026-11-10）：
 * - 11 月 12 日：写周报（考研，未完成）、买菜（不挂板块，未完成）
 * - 11 月 13 日：交作业（实习，已完成）
 * - 未安排：读论文（考研）
 * - 11 月 20 日：节点“面试”（实习）
 */
export const calendarData: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
  ],
  milestones: [{ id: 'm1', laneId: 'l2', name: '面试', date: '2026-11-20', done: false, note: '' }],
  todos: [
    makeTodo('t1', { title: '写周报', date: '2026-11-12', laneId: 'l1' }),
    makeTodo('t2', { title: '买菜', date: '2026-11-12' }),
    makeTodo('t3', { title: '交作业', date: '2026-11-13', laneId: 'l2', done: true }),
    makeTodo('t4', { title: '读论文', laneId: 'l1' }),
  ],
}
