import {
  LANE_COLORS,
  NAME_MAX,
  type AppData,
  type ISODate,
  type Lane,
  type LaneColor,
  type Milestone,
  type Phase,
} from './schema'

/** 模板里的日期都写成“距开始日期第几天”，开始日期当天是第 0 天。 */
export interface TemplatePhase {
  /** 所属板块在 lanes 里的位置 */
  lane: number
  name: string
  /** 含当天 */
  startDay: number
  /** 不含当天，和应用里阶段的半开区间一致 */
  endDay: number
}

export interface TemplateMilestone {
  lane: number
  name: string
  day: number
}

export interface Template {
  id: string
  name: string
  description: string
  lanes: { name: string }[]
  phases: TemplatePhase[]
  milestones: TemplateMilestone[]
}

const WEEK = 7

/** 一个学期，18 周：开学适应、正课、期中和期末复习。 */
const SEMESTER: Template = {
  id: 'semester',
  name: '学期',
  description: '18 周：开学适应、期中复习、期末冲刺，以及课程、考试、作业三条线。',
  lanes: [{ name: '课程' }, { name: '考试' }, { name: '作业' }],
  phases: [
    { lane: 0, name: '开学适应', startDay: 0, endDay: 2 * WEEK },
    { lane: 0, name: '正课', startDay: 2 * WEEK, endDay: 14 * WEEK },
    { lane: 0, name: '期末冲刺', startDay: 14 * WEEK, endDay: 17 * WEEK },
    { lane: 1, name: '期中复习', startDay: 8 * WEEK, endDay: 10 * WEEK },
    { lane: 1, name: '期末复习', startDay: 14 * WEEK, endDay: 17 * WEEK },
    { lane: 2, name: '平时作业', startDay: WEEK, endDay: 14 * WEEK },
    { lane: 2, name: '大作业', startDay: 11 * WEEK, endDay: 16 * WEEK },
  ],
  milestones: [
    { lane: 0, name: '开学', day: 0 },
    { lane: 1, name: '期中考试', day: 10 * WEEK },
    { lane: 1, name: '期末考试', day: 17 * WEEK },
    { lane: 2, name: '大作业提交', day: 16 * WEEK },
  ],
}

/** 一次备考，24 周：基础、强化、冲刺三个阶段。 */
const EXAM_PREP: Template = {
  id: 'exam-prep',
  name: '备考',
  description: '24 周：基础、强化、冲刺三个阶段，每个阶段一条线，含模拟考和正式考试。',
  lanes: [{ name: '基础' }, { name: '强化' }, { name: '冲刺' }],
  phases: [
    { lane: 0, name: '基础阶段', startDay: 0, endDay: 12 * WEEK },
    { lane: 1, name: '强化阶段', startDay: 12 * WEEK, endDay: 20 * WEEK },
    { lane: 2, name: '冲刺阶段', startDay: 20 * WEEK, endDay: 24 * WEEK },
  ],
  milestones: [
    { lane: 0, name: '基础摸底', day: 12 * WEEK - 1 },
    { lane: 1, name: '第一次模拟考', day: 19 * WEEK },
    { lane: 2, name: '第二次模拟考', day: 22 * WEEK },
    { lane: 2, name: '正式考试', day: 24 * WEEK },
  ],
}

export const TEMPLATES: readonly Template[] = [SEMESTER, EXAM_PREP]

function shiftDate(date: ISODate, days: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

/** 先用没人用过的颜色，用完了再按板块数循环，和手动新建板块的规则一致。 */
function nextColor(lanes: Lane[]): LaneColor {
  const used = new Set(lanes.map((lane) => lane.color))
  return (
    LANE_COLORS.find((color) => !used.has(color)) ?? LANE_COLORS[lanes.length % LANE_COLORS.length]
  )
}

const clip = (name: string) => name.trim().slice(0, NAME_MAX)

/**
 * 把模板按开始日期铺开，追加到现有数据后面，返回新数据；现有内容一概不动。
 * 新板块排在现有板块之后，新条目都用新 id。纯函数，不改传入的数据。
 */
export function applyTemplate(
  data: AppData,
  template: Template,
  startDate: ISODate,
  newId: () => string,
): AppData {
  let order = data.lanes.reduce((max, lane) => Math.max(max, lane.order + 1), 0)
  const lanes = [...data.lanes]
  const laneIds: string[] = []
  for (const { name } of template.lanes) {
    const lane: Lane = {
      id: newId(),
      name: clip(name),
      color: nextColor(lanes),
      order: order++,
      note: '',
      links: [],
    }
    lanes.push(lane)
    laneIds.push(lane.id)
  }

  const phases: Phase[] = template.phases.map((phase) => ({
    id: newId(),
    laneId: laneIds[phase.lane],
    name: clip(phase.name),
    start: shiftDate(startDate, phase.startDay),
    end: shiftDate(startDate, phase.endDay),
    tentative: false,
    done: false,
    note: '',
  }))
  const milestones: Milestone[] = template.milestones.map((milestone) => ({
    id: newId(),
    laneId: laneIds[milestone.lane],
    name: clip(milestone.name),
    date: shiftDate(startDate, milestone.day),
    done: false,
    note: '',
  }))

  return {
    ...data,
    lanes,
    phases: [...data.phases, ...phases],
    milestones: [...data.milestones, ...milestones],
  }
}

/** 一个模板会添加多少东西，给界面提示用。 */
export function templateCounts(template: Template): {
  lanes: number
  phases: number
  milestones: number
} {
  return {
    lanes: template.lanes.length,
    phases: template.phases.length,
    milestones: template.milestones.length,
  }
}
