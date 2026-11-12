import { appDataSchema, createEmptyData, NAME_MAX, type AppData } from './schema'
import { applyTemplate, TEMPLATES, templateCounts } from './templates'

const existing: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '四级', color: 'tomato', order: 5, note: '', links: [] },
  ],
  phases: [
    {
      id: 'p1',
      laneId: 'l1',
      name: '基础',
      start: '2026-11-09',
      end: '2026-12-07',
      tentative: false,
      note: '',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', note: '' }],
}

const counter = () => {
  let n = 0
  return () => `new-${n++}`
}
const [semester, examPrep] = TEMPLATES

describe('templates', () => {
  it('has the two built-in templates', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual(['学期', '备考'])
  })

  it.each(TEMPLATES)('$name: names fit, indexes are valid and phases are non-empty', (template) => {
    const names = [
      ...template.lanes.map((lane) => lane.name),
      ...template.phases.map((phase) => phase.name),
      ...template.milestones.map((milestone) => milestone.name),
    ]
    expect(names.every((name) => name.length > 0 && name.length <= NAME_MAX)).toBe(true)
    for (const item of [...template.phases, ...template.milestones]) {
      expect(item.lane).toBeGreaterThanOrEqual(0)
      expect(item.lane).toBeLessThan(template.lanes.length)
    }
    expect(template.phases.every((phase) => phase.startDay < phase.endDay)).toBe(true)
  })
})

describe('applyTemplate', () => {
  it.each(TEMPLATES)('$name: produces data that passes the schema', (template) => {
    const next = applyTemplate(existing, template, '2026-12-01', counter())
    expect(appDataSchema.safeParse(next).success).toBe(true)
    const empty = applyTemplate(createEmptyData(), template, '2026-12-01', counter())
    expect(appDataSchema.safeParse(empty).success).toBe(true)
  })

  it('lays dates out as day offsets from the start date', () => {
    const next = applyTemplate(createEmptyData(), examPrep, '2026-12-01', counter())
    const byName = (name: string) => next.phases.find((phase) => phase.name === name)!
    expect(byName('基础阶段')).toMatchObject({ start: '2026-12-01', end: '2027-02-23' })
    // 强化阶段紧接在基础阶段之后（半开区间，没有空隙也没有重叠）
    expect(byName('强化阶段').start).toBe(byName('基础阶段').end)
    expect(byName('冲刺阶段').start).toBe(byName('强化阶段').end)
    const exam = next.milestones.find((milestone) => milestone.name === '正式考试')!
    expect(exam.date).toBe('2027-05-18')
  })

  it('handles month and year boundaries and leap days', () => {
    const next = applyTemplate(createEmptyData(), semester, '2027-12-27', counter())
    expect(next.milestones.find((m) => m.name === '开学')!.date).toBe('2027-12-27')
    const leap = applyTemplate(createEmptyData(), semester, '2028-02-27', counter())
    expect(leap.phases[0].end).toBe('2028-03-12')
  })

  it('keeps every milestone inside or right after its lane span and in the template length', () => {
    for (const template of TEMPLATES) {
      const next = applyTemplate(createEmptyData(), template, '2026-09-07', counter())
      const last = Math.max(...next.phases.map((phase) => Date.parse(phase.end)))
      expect(next.milestones.every((m) => Date.parse(m.date) <= last)).toBe(true)
    }
  })

  it('appends to existing data without touching it', () => {
    const before = structuredClone(existing)
    const next = applyTemplate(existing, semester, '2026-12-01', counter())
    expect(existing).toEqual(before)
    expect(next.lanes.slice(0, 2)).toEqual(existing.lanes)
    expect(next.phases[0]).toEqual(existing.phases[0])
    expect(next.milestones[0]).toEqual(existing.milestones[0])
    expect(next.terms).toEqual(existing.terms)
    expect(next.todos).toEqual(existing.todos)
    const counts = templateCounts(semester)
    expect(next.lanes).toHaveLength(2 + counts.lanes)
    expect(next.phases).toHaveLength(1 + counts.phases)
    expect(next.milestones).toHaveLength(1 + counts.milestones)
  })

  it('puts new lanes after the existing ones and cycles colors', () => {
    const ids = counter()
    const next = applyTemplate(existing, semester, '2026-12-01', ids)
    const added = next.lanes.slice(2)
    expect(added.map((lane) => lane.order)).toEqual([6, 7, 8])
    expect(added.map((lane) => lane.name)).toEqual(['课程', '考试', '作业'])
    // 没人用过的颜色先用
    expect(added.every((lane) => lane.color !== 'iris' && lane.color !== 'tomato')).toBe(true)
    expect(new Set(next.lanes.map((lane) => lane.color)).size).toBe(next.lanes.length)

    // 8 种颜色用完以后循环
    const full = applyTemplate(next, examPrep, '2027-01-01', ids)
    const again = applyTemplate(full, semester, '2027-01-01', ids)
    expect(again.lanes).toHaveLength(2 + 3 + 3 + 3)
    expect(appDataSchema.safeParse(again).success).toBe(true)
  })

  it('gives every new item a fresh unique id and points it at a new lane', () => {
    const next = applyTemplate(existing, semester, '2026-12-01', counter())
    const ids = [
      ...next.lanes.map((x) => x.id),
      ...next.phases.map((x) => x.id),
      ...next.milestones.map((x) => x.id),
    ]
    expect(new Set(ids).size).toBe(ids.length)
    const newLaneIds = new Set(next.lanes.slice(2).map((lane) => lane.id))
    expect(next.phases.slice(1).every((phase) => newLaneIds.has(phase.laneId))).toBe(true)
    expect(next.milestones.slice(1).every((m) => newLaneIds.has(m.laneId))).toBe(true)
  })

  it('applying the same template twice appends two independent copies', () => {
    const once = applyTemplate(createEmptyData(), examPrep, '2026-12-01', counter())
    const twice = applyTemplate(once, examPrep, '2026-12-01', () => crypto.randomUUID())
    expect(twice.lanes).toHaveLength(6)
    expect(appDataSchema.safeParse(twice).success).toBe(true)
  })
})
