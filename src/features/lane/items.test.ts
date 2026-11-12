import type { Milestone, Phase } from '@/data/schema'
import { toDay } from '@/features/timeline/days'
import { buildLaneItems, PHASE_STATUS_TEXT } from './items'

const TODAY = toDay('2026-11-10')

const phase = (id: string, start: string, end: string, extra: Partial<Phase> = {}): Phase => ({
  id,
  laneId: 'L',
  name: id,
  start,
  end,
  tentative: false,
  done: false,
  note: '',
  ...extra,
})

const milestone = (id: string, date: string, extra: Partial<Milestone> = {}): Milestone => ({
  id,
  laneId: 'L',
  name: id,
  date,
  done: false,
  note: '',
  ...extra,
})

const ids = (items: { id: string }[]) => items.map((item) => item.id)
const statusOf = (laneItems: ReturnType<typeof buildLaneItems>, id: string) => {
  const item = [...laneItems.current, ...laneItems.ended].find((i) => i.id === id)
  return item?.kind === 'phase' ? item.status : undefined
}

describe('buildLaneItems', () => {
  it('returns two empty groups for empty input', () => {
    expect(buildLaneItems('L', [], [], TODAY)).toEqual({ current: [], ended: [] })
  })

  it('has a Chinese text for every phase status', () => {
    expect(PHASE_STATUS_TEXT).toEqual({
      'in-progress': '进行中',
      tentative: '待确认',
      upcoming: '未开始',
      ended: '已结束',
    })
  })

  describe('phase status', () => {
    const result = buildLaneItems(
      'L',
      [
        phase('ends-today', '2026-10-01', '2026-11-10'),
        phase('ends-tomorrow', '2026-10-01', '2026-11-11'),
        phase('starts-today', '2026-11-10', '2026-11-20'),
        phase('starts-tomorrow', '2026-11-11', '2026-11-20'),
        phase('tentative-running', '2026-11-01', '2026-11-20', { tentative: true }),
        phase('tentative-future', '2026-11-15', '2026-11-20', { tentative: true }),
        phase('tentative-expired', '2026-10-01', '2026-11-05', { tentative: true }),
      ],
      [],
      TODAY,
    )

    it('treats a phase whose end equals today as ended (end is exclusive)', () => {
      expect(statusOf(result, 'ends-today')).toBe('ended')
      expect(result.ended.map((i) => i.id)).toContain('ends-today')
    })

    it('keeps a phase that ends tomorrow in progress', () => {
      expect(statusOf(result, 'ends-tomorrow')).toBe('in-progress')
    })

    it('starts a phase on its start day', () => {
      expect(statusOf(result, 'starts-today')).toBe('in-progress')
      expect(statusOf(result, 'starts-tomorrow')).toBe('upcoming')
    })

    it('marks tentative phases as tentative unless they are over', () => {
      expect(statusOf(result, 'tentative-running')).toBe('tentative')
      expect(statusOf(result, 'tentative-future')).toBe('tentative')
      expect(statusOf(result, 'tentative-expired')).toBe('ended')
    })
  })

  it('treats a milestone today as current and one yesterday as ended', () => {
    const result = buildLaneItems(
      'L',
      [],
      [milestone('today', '2026-11-10'), milestone('yesterday', '2026-11-09')],
      TODAY,
    )
    expect(ids(result.current)).toEqual(['today'])
    expect(ids(result.ended)).toEqual(['yesterday'])
  })

  it('mixes phases and milestones in chronological order within each group', () => {
    const result = buildLaneItems(
      'L',
      [phase('p-late', '2026-12-01', '2026-12-10'), phase('p-early', '2026-11-12', '2026-11-20')],
      [milestone('m-mid', '2026-11-25'), milestone('m-first', '2026-11-11')],
      TODAY,
    )
    expect(ids(result.current)).toEqual(['m-first', 'p-early', 'm-mid', 'p-late'])
  })

  it('sorts ended items chronologically too', () => {
    const result = buildLaneItems(
      'L',
      [phase('p', '2026-09-01', '2026-09-10')],
      [milestone('m1', '2026-08-01'), milestone('m2', '2026-10-01')],
      TODAY,
    )
    expect(ids(result.ended)).toEqual(['m1', 'p', 'm2'])
  })

  it('puts a phase before a milestone on the same day', () => {
    const result = buildLaneItems(
      'L',
      [phase('p', '2026-11-15', '2026-11-20')],
      [milestone('a-milestone', '2026-11-15')],
      TODAY,
    )
    expect(ids(result.current)).toEqual(['p', 'a-milestone'])
  })

  it('breaks same-day, same-kind ties by id regardless of input order', () => {
    const result = buildLaneItems(
      'L',
      [phase('b', '2026-11-15', '2026-11-20'), phase('a', '2026-11-15', '2026-11-18')],
      [milestone('y', '2026-11-16'), milestone('x', '2026-11-16')],
      TODAY,
    )
    expect(ids(result.current)).toEqual(['a', 'b', 'x', 'y'])
  })

  it('leaves out other lanes', () => {
    const result = buildLaneItems(
      'L',
      [
        phase('mine', '2026-11-12', '2026-11-20'),
        phase('theirs', '2026-11-12', '2026-11-20', { laneId: 'other' }),
      ],
      [milestone('mine-m', '2026-11-12'), milestone('theirs-m', '2026-11-12', { laneId: 'other' })],
      TODAY,
    )
    expect(ids(result.current)).toEqual(['mine', 'mine-m'])
    expect(result.ended).toEqual([])
  })
})
