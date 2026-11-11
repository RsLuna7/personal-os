import type { Lane, Milestone, Phase, Term } from '@/data/schema'
import { layoutMonth, type CalendarData } from './layout'
import { monthWeeks } from './month'

// 2026 年 11 月：第 1 周行是 10 月 26 日到 11 月 1 日，第 2 周行从 11 月 2 日起
const WEEKS = monthWeeks({ year: 2026, month: 11 })

const lane = (id: string, order: number): Lane => ({
  id,
  name: id,
  color: 'iris',
  order,
  note: '',
  links: [],
})

const phase = (id: string, laneId: string, start: string, end: string): Phase => ({
  id,
  laneId,
  name: id,
  start,
  end,
  tentative: false,
  note: '',
})

const data = (
  phases: Phase[],
  extra: Partial<CalendarData> = {},
  milestones: Milestone[] = [],
  terms: Term[] = [],
): CalendarData => ({
  lanes: [lane('l1', 0), lane('l2', 1)],
  phases,
  milestones,
  terms,
  ...extra,
})

describe('layoutMonth phase bars', () => {
  it('returns one layout per week with the week days', () => {
    const layout = layoutMonth(WEEKS, data([]))
    expect(layout).toHaveLength(6)
    expect(layout[1]!.days).toEqual(WEEKS[1])
    expect(layout[0]!.bars).toEqual([])
  })

  it('cuts a phase that crosses a week into one segment per week', () => {
    const layout = layoutMonth(WEEKS, data([phase('a', 'l1', '2026-11-04', '2026-11-12')]))
    expect(layout[1]!.bars).toHaveLength(1)
    expect(layout[1]!.bars[0]).toMatchObject({
      startCol: 2,
      endCol: 6,
      startsHere: true,
      endsHere: false,
      labelled: true,
    })
    expect(layout[2]!.bars).toHaveLength(1)
    expect(layout[2]!.bars[0]).toMatchObject({
      startCol: 0,
      endCol: 2,
      startsHere: false,
      endsHere: true,
      labelled: false,
    })
    expect(layout[0]!.bars).toEqual([])
    expect(layout[3]!.bars).toEqual([])
  })

  it('puts overlapping phases in different slots ordered by lane, then start', () => {
    const layout = layoutMonth(
      WEEKS,
      data([
        phase('second-lane', 'l2', '2026-11-02', '2026-11-09'),
        phase('late', 'l1', '2026-11-04', '2026-11-09'),
        phase('early', 'l1', '2026-11-03', '2026-11-09'),
      ]),
    )
    const slotOf = (id: string) => layout[1]!.bars.find((bar) => bar.phase.id === id)!.slot
    expect(slotOf('early')).toBe(0)
    expect(slotOf('late')).toBe(1)
    expect(slotOf('second-lane')).toBe(2)
  })

  it('reuses the first free slot for phases that do not overlap', () => {
    const layout = layoutMonth(
      WEEKS,
      data([
        phase('a', 'l1', '2026-11-02', '2026-11-04'),
        phase('b', 'l1', '2026-11-04', '2026-11-06'),
      ]),
    )
    expect(layout[1]!.bars.map((bar) => bar.slot)).toEqual([0, 0])
  })

  it('gives two overlapping phases that span the same weeks consistent slots', () => {
    const layout = layoutMonth(
      WEEKS,
      data([
        phase('a', 'l1', '2026-11-04', '2026-11-12'),
        phase('b', 'l2', '2026-11-05', '2026-11-11'),
      ]),
    )
    for (const row of [1, 2]) {
      const bars = layout[row]!.bars
      expect(bars.find((bar) => bar.phase.id === 'a')!.slot).toBe(0)
      expect(bars.find((bar) => bar.phase.id === 'b')!.slot).toBe(1)
    }
  })

  it('leaves out phases outside the grid, including one that ends on the first grid day', () => {
    const layout = layoutMonth(
      WEEKS,
      data([
        phase('before', 'l1', '2026-09-01', '2026-10-26'),
        phase('after', 'l1', '2026-12-07', '2026-12-20'),
      ]),
    )
    expect(layout.flatMap((row) => row.bars)).toEqual([])
  })

  it('labels the first visible segment even when the phase started before the grid', () => {
    const layout = layoutMonth(WEEKS, data([phase('a', 'l1', '2026-10-01', '2026-11-03')]))
    expect(layout[0]!.bars[0]).toMatchObject({
      startCol: 0,
      endCol: 6,
      startsHere: false,
      endsHere: false,
      labelled: true,
    })
    expect(layout[1]!.bars[0]).toMatchObject({
      startCol: 0,
      endCol: 0,
      endsHere: true,
      labelled: false,
    })
  })

  it('puts phases of an unknown lane last', () => {
    const layout = layoutMonth(
      WEEKS,
      data([
        phase('orphan', 'gone', '2026-11-02', '2026-11-09'),
        phase('own', 'l2', '2026-11-02', '2026-11-09'),
      ]),
    )
    const slotOf = (id: string) => layout[1]!.bars.find((bar) => bar.phase.id === id)!.slot
    expect(slotOf('own')).toBe(0)
    expect(slotOf('orphan')).toBe(1)
  })
})

describe('layoutMonth terms', () => {
  it('cuts a term per week and labels only the first segment (end is exclusive)', () => {
    const term: Term = { id: 't1', name: '秋季', start: '2026-09-01', end: '2026-11-03' }
    const layout = layoutMonth(WEEKS, data([], { terms: [term] }))
    expect(layout[0]!.terms[0]).toMatchObject({ startCol: 0, endCol: 6, labelled: true })
    expect(layout[1]!.terms[0]).toMatchObject({ startCol: 0, endCol: 0, labelled: false })
    expect(layout[2]!.terms).toEqual([])
  })
})
