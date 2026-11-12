import { createEmptyData, type AppData } from '@/data/schema'
import { buildWeekReview, countItems, weekStartOf } from './weekReview'

const TODAY = '2026-11-10' // 周二
const WEEK_START = '2026-11-09' // 周一

const lanes: AppData['lanes'] = [
  { id: 'l2', name: '四级', color: 'tomato', order: 1, note: '', links: [] },
  { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
]

const phase = (
  id: string,
  start: string,
  end: string,
  over: Partial<AppData['phases'][number]> = {},
): AppData['phases'][number] => ({
  id,
  laneId: 'l1',
  name: id,
  start,
  end,
  tentative: false,
  done: false,
  note: '',
  ...over,
})
const milestone = (
  id: string,
  date: string,
  over: Partial<AppData['milestones'][number]> = {},
): AppData['milestones'][number] => ({
  id,
  laneId: 'l1',
  name: id,
  date,
  done: false,
  note: '',
  ...over,
})
const todo = (
  id: string,
  date: string | null,
  over: Partial<AppData['todos'][number]> = {},
): AppData['todos'][number] => ({
  id,
  title: id,
  date,
  done: false,
  laneId: 'l1',
  createdAt: '2026-11-01T00:00:00Z',
  ...over,
})

const base = (over: Partial<AppData>): AppData => ({ ...createEmptyData(), lanes, ...over })
const ids = (groups: ReturnType<typeof buildWeekReview>['done']) =>
  groups.flatMap((group) => group.items.map((item) => item.id))

describe('weekStartOf', () => {
  it('returns the Monday of the week', () => {
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09')
    expect(weekStartOf('2026-11-16')).toBe('2026-11-16')
    expect(weekStartOf('2027-01-01')).toBe('2026-12-28')
  })
})

describe('buildWeekReview', () => {
  it('reports the Monday to Sunday range, snapping a mid-week date to its Monday', () => {
    const review = buildWeekReview(createEmptyData(), '2026-11-12', TODAY)
    expect(review.weekStart).toBe('2026-11-09')
    expect(review.weekEnd).toBe('2026-11-15')
  })

  it('is empty for empty data', () => {
    const review = buildWeekReview(createEmptyData(), WEEK_START, TODAY)
    expect(review.done).toEqual([])
    expect(review.overdue).toEqual([])
    expect(review.upcoming).toEqual([])
  })

  describe('done this week', () => {
    it('counts done milestones and todos dated inside the week, edges included', () => {
      const data = base({
        milestones: [
          milestone('m-mon', '2026-11-09', { done: true }),
          milestone('m-sun', '2026-11-15', { done: true }),
          milestone('m-before', '2026-11-08', { done: true }),
          milestone('m-after', '2026-11-16', { done: true }),
          milestone('m-open', '2026-11-10'),
        ],
        todos: [
          todo('t-in', '2026-11-12', { done: true }),
          todo('t-out', '2026-11-20', { done: true }),
          todo('t-open', '2026-11-12'),
          todo('t-unscheduled', null, { done: true }),
        ],
      })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).done)).toEqual(['m-mon', 't-in', 'm-sun'])
    })

    it('counts a done phase when its range overlaps the week, using the exclusive end', () => {
      const data = base({
        phases: [
          phase('p-inside', '2026-11-10', '2026-11-12', { done: true }),
          phase('p-spans', '2026-11-01', '2026-12-01', { done: true }),
          // 最后一天是周日 11-08，和本周不重叠
          phase('p-ended-before', '2026-11-02', '2026-11-09', { done: true }),
          // 11-15 是周日，最后一天，算重叠
          phase('p-ends-sunday', '2026-11-02', '2026-11-16', { done: true }),
          phase('p-starts-after', '2026-11-16', '2026-11-20', { done: true }),
          phase('p-not-done', '2026-11-10', '2026-11-12'),
        ],
      })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).done).sort()).toEqual([
        'p-ends-sunday',
        'p-inside',
        'p-spans',
      ])
    })

    it('follows the selected week, not today', () => {
      const data = base({ milestones: [milestone('m', '2026-11-03', { done: true })] })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).done)).toEqual([])
      expect(ids(buildWeekReview(data, '2026-11-02', TODAY).done)).toEqual(['m'])
    })
  })

  describe('overdue', () => {
    it('lists items dated before today that are not done', () => {
      const data = base({
        milestones: [
          milestone('m-late', '2026-11-09'),
          milestone('m-today', TODAY),
          milestone('m-done', '2026-11-01', { done: true }),
        ],
        todos: [
          todo('t-late', '2026-11-01'),
          todo('t-today', TODAY),
          todo('t-done', '2026-11-01', { done: true }),
          todo('t-unscheduled', null),
        ],
      })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).overdue).sort()).toEqual([
        'm-late',
        't-late',
      ])
    })

    it('treats a phase as overdue only after its last day has passed', () => {
      const data = base({
        phases: [
          // 最后一天是昨天 11-09
          phase('p-ended', '2026-11-02', '2026-11-10'),
          // 最后一天就是今天
          phase('p-ends-today', '2026-11-02', '2026-11-11'),
          phase('p-done', '2026-11-02', '2026-11-05', { done: true }),
        ],
      })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).overdue)).toEqual(['p-ended'])
    })

    it('does not depend on the selected week', () => {
      const data = base({ milestones: [milestone('m', '2026-11-01')] })
      expect(ids(buildWeekReview(data, '2026-10-05', TODAY).overdue)).toEqual(['m'])
      expect(ids(buildWeekReview(data, '2026-12-07', TODAY).overdue)).toEqual(['m'])
    })
  })

  describe('due next week', () => {
    it('lists open milestones and todos dated in the following week, edges included', () => {
      const data = base({
        milestones: [
          milestone('m-mon', '2026-11-16'),
          milestone('m-sun', '2026-11-22'),
          milestone('m-this', '2026-11-15'),
          milestone('m-later', '2026-11-23'),
          milestone('m-done', '2026-11-17', { done: true }),
        ],
        todos: [todo('t', '2026-11-18'), todo('t-done', '2026-11-18', { done: true })],
      })
      expect(ids(buildWeekReview(data, WEEK_START, TODAY).upcoming).sort()).toEqual([
        'm-mon',
        'm-sun',
        't',
      ])
    })

    it('tags phases that start or end next week', () => {
      const data = base({
        phases: [
          phase('p-starts', '2026-11-18', '2026-12-18'),
          phase('p-ends', '2026-10-01', '2026-11-20'),
          phase('p-both', '2026-11-17', '2026-11-19'),
          phase('p-through', '2026-11-01', '2026-12-18'),
          // 最后一天是 11-15（本周日），不算下周
          phase('p-ended-this-week', '2026-11-01', '2026-11-16'),
          phase('p-done', '2026-11-18', '2026-12-18', { done: true }),
        ],
      })
      const items = buildWeekReview(data, WEEK_START, TODAY).upcoming.flatMap((g) => g.items)
      expect(Object.fromEntries(items.map((item) => [item.id, item.tag]))).toEqual({
        'p-starts': '开始',
        'p-ends': '结束',
        'p-both': '开始并结束',
      })
    })
  })

  describe('grouping', () => {
    it('groups by lane in lane order, lane-less todos last, sorted by date inside a group', () => {
      const data = base({
        milestones: [
          milestone('m-b', '2026-11-12', { laneId: 'l2', done: true }),
          milestone('m-late', '2026-11-14', { done: true }),
        ],
        todos: [
          todo('t-none', '2026-11-11', { laneId: null, done: true }),
          todo('t-early', '2026-11-10', { done: true }),
        ],
        phases: [phase('p', '2026-11-11', '2026-11-13', { done: true })],
      })
      const groups = buildWeekReview(data, WEEK_START, TODAY).done
      expect(groups.map((group) => group.lane?.id ?? null)).toEqual(['l1', 'l2', null])
      expect(groups[0].items.map((item) => item.id)).toEqual(['t-early', 'p', 'm-late'])
      expect(countItems(groups)).toBe(5)
    })

    it('puts items pointing at a missing lane in the lane-less group', () => {
      const data = base({ todos: [todo('t', '2026-11-11', { laneId: 'gone', done: true })] })
      expect(buildWeekReview(data, WEEK_START, TODAY).done).toMatchObject([
        { lane: null, items: [{ id: 't' }] },
      ])
    })

    it('sets lastDay on phases to the inclusive end', () => {
      const data = base({ phases: [phase('p', '2026-11-09', '2026-11-12', { done: true })] })
      expect(buildWeekReview(data, WEEK_START, TODAY).done[0].items[0]).toMatchObject({
        date: '2026-11-09',
        lastDay: '2026-11-11',
      })
    })
  })

  it('does not modify its input', () => {
    const data = base({
      milestones: [milestone('m', '2026-11-12', { done: true })],
      todos: [todo('t', '2026-11-01')],
    })
    const copy = structuredClone(data)
    buildWeekReview(data, WEEK_START, TODAY)
    expect(data).toEqual(copy)
  })
})
