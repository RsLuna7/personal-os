import { createEmptyData, type AppData, type Phase } from '@/data/schema'
import { createSampleData } from '@/data/sample'
import { toDay } from '@/features/timeline/days'
import { nextMilestone, summarizeLane, summarizeLanes } from './summary'

const lane = { id: 'l1', name: '考研', color: 'iris' as const, order: 0, note: '', links: [] }
const phase = (id: string, start: string, end: string, extra: Partial<Phase> = {}): Phase => ({
  id,
  laneId: 'l1',
  name: id,
  start,
  end,
  tentative: false,
  done: false,
  note: '',
  ...extra,
})
const today = toDay('2026-11-10')

describe('summarizeLane', () => {
  it('finds the current phase, progress and days left', () => {
    const summary = summarizeLane(lane, [phase('a', '2026-11-01', '2026-11-21')], [], today)
    expect(summary.current?.id).toBe('a')
    // 11-01 到 11-10 共 10 天，总长 20 天
    expect(summary.progress).toBeCloseTo(0.5)
    // 含今天，到 11-21（不含）还有 11 天
    expect(summary.daysLeft).toBe(11)
  })

  it('treats the start day as inside and the end day as outside', () => {
    expect(
      summarizeLane(lane, [phase('a', '2026-11-10', '2026-11-20')], [], today).current?.id,
    ).toBe('a')
    expect(
      summarizeLane(lane, [phase('a', '2026-11-01', '2026-11-10')], [], today).current,
    ).toBeNull()
  })

  it('prefers a confirmed phase over a tentative one, then the earlier start', () => {
    const phases = [
      phase('tentative', '2026-11-01', '2026-11-30', { tentative: true }),
      phase('late', '2026-11-05', '2026-11-30'),
      phase('early', '2026-11-02', '2026-11-30'),
    ]
    expect(summarizeLane(lane, phases, [], today).current?.id).toBe('early')
  })

  it('picks the next phase after the current one ends', () => {
    const phases = [
      phase('now', '2026-11-01', '2026-11-21'),
      phase('later', '2026-12-20', '2027-01-10'),
      phase('soon', '2026-11-21', '2026-12-10'),
      phase('old', '2026-09-01', '2026-10-01'),
    ]
    expect(summarizeLane(lane, phases, [], today).next?.id).toBe('soon')
  })

  it('has no current phase and looks for the next one after today', () => {
    const phases = [
      phase('old', '2026-09-01', '2026-10-01'),
      phase('up', '2026-12-01', '2026-12-20'),
    ]
    const summary = summarizeLane(lane, phases, [], today)
    expect(summary.current).toBeNull()
    expect(summary.progress).toBeNull()
    expect(summary.daysLeft).toBeNull()
    expect(summary.next?.id).toBe('up')
  })

  it('returns nothing for an empty lane', () => {
    const summary = summarizeLane(lane, [], [], today)
    expect(summary).toMatchObject({ current: null, next: null, nextMilestone: null })
  })

  it('ignores phases and milestones of other lanes', () => {
    const other = phase('x', '2026-11-01', '2026-11-30', { laneId: 'l2' })
    expect(summarizeLane(lane, [other], [], today).current).toBeNull()
  })

  it('picks the nearest milestone today or later', () => {
    const milestones = [
      { id: 'm0', laneId: 'l1', name: '过去', date: '2026-11-09', done: false, note: '' },
      { id: 'm2', laneId: 'l1', name: '远', date: '2026-12-20', done: false, note: '' },
      { id: 'm1', laneId: 'l1', name: '今天', date: '2026-11-10', done: false, note: '' },
    ]
    expect(summarizeLane(lane, [], milestones, today).nextMilestone?.id).toBe('m1')
  })
})

describe('summarizeLanes', () => {
  it('follows the lane order', () => {
    const data: AppData = {
      ...createEmptyData(),
      lanes: [
        { id: 'b', name: 'B', color: 'teal', order: 1, note: '', links: [] },
        { id: 'a', name: 'A', color: 'iris', order: 0, note: '', links: [] },
      ],
    }
    expect(summarizeLanes(data, today).map((item) => item.lane.id)).toEqual(['a', 'b'])
  })
})

describe('nextMilestone', () => {
  it('returns the nearest milestone across lanes with its lane and countdown', () => {
    const data = createSampleData('2026-11-10')
    const result = nextMilestone(data, today)
    // 示例数据里最近的是模拟测试（第 8 周周六），比期末考试（第 9 周周三）早
    expect(result?.milestone.id).toBe('sample-milestone-1')
    expect(result?.lane.id).toBe('sample-lane-exam')
    expect(result?.inDays).toBe(toDay(result!.milestone.date) - today)
  })

  it('returns null when nothing is ahead', () => {
    expect(nextMilestone(createEmptyData(), today)).toBeNull()
    const data: AppData = {
      ...createEmptyData(),
      lanes: [lane],
      milestones: [
        { id: 'm', laneId: 'l1', name: '过去', date: '2026-01-01', done: false, note: '' },
      ],
    }
    expect(nextMilestone(data, today)).toBeNull()
  })
})
