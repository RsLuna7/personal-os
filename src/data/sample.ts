import { createEmptyData, type AppData, type ISODate } from './schema'

const DAY_MS = 86_400_000

/** 示例数据全部虚构，日期相对 today 计算。 */
export function createSampleData(today: ISODate): AppData {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const weekday = (new Date(todayMs).getUTCDay() + 6) % 7 // 周一为 0
  const mondayMs = todayMs - weekday * DAY_MS
  const at = (weeks: number, days = 0): ISODate =>
    new Date(mondayMs + (weeks * 7 + days) * DAY_MS).toISOString().slice(0, 10)

  return {
    ...createEmptyData(),
    lanes: [
      { id: 'sample-lane-exam', name: '示例考试 A', color: 'iris', order: 0 },
      { id: 'sample-lane-course', name: '示例课程', color: 'teal', order: 1 },
      { id: 'sample-lane-intern', name: '示例实习', color: 'amber', order: 2 },
    ],
    phases: [
      {
        id: 'sample-phase-1',
        laneId: 'sample-lane-exam',
        name: '基础阶段',
        start: at(-16),
        end: at(-4),
        tentative: false,
        note: '',
      },
      {
        id: 'sample-phase-2',
        laneId: 'sample-lane-exam',
        name: '强化阶段',
        start: at(-4),
        end: at(12),
        tentative: false,
        note: '这是一条示例备注。',
      },
      {
        id: 'sample-phase-3',
        laneId: 'sample-lane-exam',
        name: '冲刺阶段',
        start: at(12),
        end: at(20),
        tentative: false,
        note: '',
      },
      {
        id: 'sample-phase-4',
        laneId: 'sample-lane-course',
        name: '课程学习',
        start: at(-10),
        end: at(6),
        tentative: false,
        note: '',
      },
      {
        id: 'sample-phase-5',
        laneId: 'sample-lane-course',
        name: '期末复习',
        start: at(6),
        end: at(9),
        tentative: false,
        note: '',
      },
      {
        id: 'sample-phase-6',
        laneId: 'sample-lane-intern',
        name: '实习（时间待定）',
        start: at(22),
        end: at(34),
        tentative: true,
        note: '',
      },
    ],
    milestones: [
      {
        id: 'sample-milestone-1',
        laneId: 'sample-lane-exam',
        name: '模拟测试',
        date: at(8, 5),
        note: '',
      },
      {
        id: 'sample-milestone-2',
        laneId: 'sample-lane-exam',
        name: '示例考试',
        date: at(20, 5),
        note: '',
      },
      {
        id: 'sample-milestone-3',
        laneId: 'sample-lane-course',
        name: '期末考试',
        date: at(9, 2),
        note: '',
      },
    ],
    terms: [
      { id: 'sample-term-1', name: '示例学期一', start: at(-10), end: at(10) },
      { id: 'sample-term-2', name: '示例假期', start: at(10), end: at(16) },
      { id: 'sample-term-3', name: '示例学期二', start: at(16), end: at(36) },
    ],
  }
}
