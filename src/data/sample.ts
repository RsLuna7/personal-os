import { createEmptyData, type AppData, type ISODate, type Todo } from './schema'

const DAY_MS = 86_400_000

/** 示例数据全部虚构，日期相对 today 计算。 */
export function createSampleData(today: ISODate): AppData {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const weekday = (new Date(todayMs).getUTCDay() + 6) % 7 // 周一为 0
  const mondayMs = todayMs - weekday * DAY_MS
  const at = (weeks: number, days = 0): ISODate =>
    new Date(mondayMs + (weeks * 7 + days) * DAY_MS).toISOString().slice(0, 10)
  const daysAgo = (n: number): ISODate => new Date(todayMs - n * DAY_MS).toISOString().slice(0, 10)
  /** 几天前打过卡，升序 */
  const ago = (...days: number[]): ISODate[] => [...days].sort((a, b) => b - a).map(daysAgo)

  const todo = (n: number, title: string, date: ISODate | null, laneId: string | null): Todo => ({
    id: `sample-todo-${n}`,
    title,
    date,
    done: false,
    laneId,
    createdAt: `${today}T08:${String(n).padStart(2, '0')}:00.000Z`,
  })

  return {
    ...createEmptyData(),
    lanes: [
      {
        id: 'sample-lane-exam',
        name: '示例考试 A',
        color: 'iris',
        order: 0,
        note: '这是一段示例备注：写下目标、注意事项或复盘。',
        links: [
          { id: 'sample-link-1', title: '示例真题合集', url: 'https://example.com/past-papers' },
          { id: 'sample-link-2', title: '示例课程大纲', url: 'https://example.org/syllabus' },
        ],
      },
      {
        id: 'sample-lane-course',
        name: '示例课程',
        color: 'teal',
        order: 1,
        note: '期末前把作业和笔记整理一遍。',
        links: [{ id: 'sample-link-3', title: '示例课程主页', url: 'https://example.com/course' }],
      },
      {
        id: 'sample-lane-intern',
        name: '示例实习',
        color: 'amber',
        order: 2,
        note: '时间还没定，先收集信息。',
        links: [{ id: 'sample-link-4', title: '示例招聘信息', url: 'https://example.org/jobs' }],
      },
    ],
    phases: [
      {
        id: 'sample-phase-1',
        laneId: 'sample-lane-exam',
        name: '基础阶段',
        start: at(-16),
        end: at(-4),
        tentative: false,
        done: false,
        note: '',
      },
      {
        id: 'sample-phase-2',
        laneId: 'sample-lane-exam',
        name: '强化阶段',
        start: at(-4),
        end: at(12),
        tentative: false,
        done: false,
        note: '这是一条示例备注。',
      },
      {
        id: 'sample-phase-3',
        laneId: 'sample-lane-exam',
        name: '冲刺阶段',
        start: at(12),
        end: at(20),
        tentative: false,
        done: false,
        note: '',
      },
      {
        id: 'sample-phase-4',
        laneId: 'sample-lane-course',
        name: '课程学习',
        start: at(-10),
        end: at(6),
        tentative: false,
        done: false,
        note: '',
      },
      {
        id: 'sample-phase-5',
        laneId: 'sample-lane-course',
        name: '期末复习',
        start: at(6),
        end: at(9),
        tentative: false,
        done: false,
        note: '',
      },
      {
        id: 'sample-phase-6',
        laneId: 'sample-lane-intern',
        name: '实习（时间待定）',
        start: at(22),
        end: at(34),
        tentative: true,
        done: false,
        note: '',
      },
    ],
    milestones: [
      {
        id: 'sample-milestone-1',
        laneId: 'sample-lane-exam',
        name: '模拟测试',
        date: at(8, 5),
        done: false,
        note: '',
      },
      {
        id: 'sample-milestone-2',
        laneId: 'sample-lane-exam',
        name: '示例考试',
        date: at(20, 5),
        done: false,
        note: '',
      },
      {
        id: 'sample-milestone-3',
        laneId: 'sample-lane-course',
        name: '期末考试',
        date: at(9, 2),
        done: false,
        note: '',
      },
    ],
    terms: [
      { id: 'sample-term-1', name: '示例学期一', start: at(-10), end: at(10) },
      { id: 'sample-term-2', name: '示例假期', start: at(10), end: at(16) },
      { id: 'sample-term-3', name: '示例学期二', start: at(16), end: at(36) },
    ],
    todos: [
      todo(1, '整理错题本', at(0, 1), 'sample-lane-exam'),
      { ...todo(2, '背 50 个单词', at(0, 1), 'sample-lane-exam'), done: true },
      todo(3, '提交课程作业', at(0, 3), 'sample-lane-course'),
      todo(4, '打印复习资料', at(0, 3), 'sample-lane-course'),
      todo(5, '联系学长问实习', at(0, 3), 'sample-lane-intern'),
      todo(6, '买文具', at(0, 3), null),
      todo(7, '周日复盘', at(0, 6), null),
      todo(8, '做一套模拟题', at(1, 2), 'sample-lane-exam'),
      todo(9, '看一遍课程大纲', null, 'sample-lane-course'),
      todo(10, '预约体检', null, null),
    ],
    habits: [
      {
        id: 'sample-habit-words',
        name: '背单词',
        laneId: 'sample-lane-exam',
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        checks: ago(1, 2, 3, 4, 5, 7, 8, 9),
        createdAt: `${daysAgo(30)}T00:00:00.000Z`,
      },
      {
        id: 'sample-habit-gym',
        name: '健身',
        laneId: null,
        weekdays: [1, 3, 5],
        checks: ago(2, 5, 7, 9),
        createdAt: `${daysAgo(30)}T00:00:00.000Z`,
      },
      {
        id: 'sample-habit-read',
        name: '读书 20 分钟',
        laneId: null,
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        checks: ago(0, 1),
        createdAt: `${daysAgo(10)}T00:00:00.000Z`,
      },
    ],
  }
}
