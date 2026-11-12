import { z } from 'zod'
import { isHttpUrl } from './links'

export const CURRENT_SCHEMA_VERSION = 4

export const LANE_COLORS = [
  'iris',
  'tomato',
  'teal',
  'amber',
  'blue',
  'grass',
  'pink',
  'bronze',
] as const
export type LaneColor = (typeof LANE_COLORS)[number]

/** 'YYYY-MM-DD' */
export type ISODate = string

export const NAME_MAX = 40
export const NOTE_MAX = 2000
export const LINKS_MAX = 50
export const URL_MAX = 2048

export interface Link {
  id: string
  title: string
  /** 只允许 http: 和 https: */
  url: string
}

export interface Lane {
  id: string
  name: string
  color: LaneColor
  order: number
  /** 板块备注，纯文本 */
  note: string
  /** 资料链接 */
  links: Link[]
}

export interface Phase {
  id: string
  laneId: string
  name: string
  /** 含当天 */
  start: ISODate
  /** 不含当天（半开区间） */
  end: ISODate
  tentative: boolean
  /** 已完成 */
  done: boolean
  note: string
}

export interface Milestone {
  id: string
  laneId: string
  name: string
  date: ISODate
  /** 已完成 */
  done: boolean
  note: string
}

export interface Term {
  id: string
  name: string
  start: ISODate
  /** 不含当天 */
  end: ISODate
}

export interface Todo {
  id: string
  title: string
  /** null 表示未安排 */
  date: ISODate | null
  done: boolean
  /** null 表示不挂板块 */
  laneId: string | null
  /** ISO 时间，只用来稳定排序 */
  createdAt: string
}

export interface AppData {
  schemaVersion: 4
  lanes: Lane[]
  phases: Phase[]
  milestones: Milestone[]
  terms: Term[]
  todos: Todo[]
  lastExportAt: string | null
}

function isRealDate(value: string): boolean {
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
}

const idSchema = z.string().min(1)
const nameSchema = z.string().trim().min(1).max(NAME_MAX)
const noteSchema = z.string().max(NOTE_MAX)
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealDate, '日期不存在')

const linkSchema = z.object({
  id: idSchema,
  title: nameSchema,
  url: z.string().max(URL_MAX).refine(isHttpUrl, '网址必须以 http 或 https 开头'),
})

const laneSchema = z.object({
  id: idSchema,
  name: nameSchema,
  color: z.enum(LANE_COLORS),
  order: z.number().int(),
  note: noteSchema,
  links: z.array(linkSchema).max(LINKS_MAX),
})

const phaseSchema = z.object({
  id: idSchema,
  laneId: idSchema,
  name: nameSchema,
  start: dateSchema,
  end: dateSchema,
  tentative: z.boolean(),
  done: z.boolean().default(false),
  note: noteSchema,
})

const milestoneSchema = z.object({
  id: idSchema,
  laneId: idSchema,
  name: nameSchema,
  date: dateSchema,
  done: z.boolean().default(false),
  note: noteSchema,
})

const todoSchema = z.object({
  id: idSchema,
  title: nameSchema,
  date: dateSchema.nullable(),
  done: z.boolean(),
  laneId: idSchema.nullable(),
  createdAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), '时间不合法'),
})

const termSchema = z.object({
  id: idSchema,
  name: nameSchema,
  start: dateSchema,
  end: dateSchema,
})

export const appDataSchema: z.ZodType<AppData> = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    lanes: z.array(laneSchema),
    phases: z.array(phaseSchema),
    milestones: z.array(milestoneSchema),
    terms: z.array(termSchema),
    todos: z.array(todoSchema),
    lastExportAt: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message })

    const seen = new Set<string>()
    const links = data.lanes.flatMap((lane) => lane.links)
    for (const item of [
      ...data.lanes,
      ...links,
      ...data.phases,
      ...data.milestones,
      ...data.terms,
      ...data.todos,
    ]) {
      if (seen.has(item.id)) issue(`id 重复：${item.id}`)
      seen.add(item.id)
    }

    const laneIds = new Set(data.lanes.map((lane) => lane.id))
    for (const item of [...data.phases, ...data.milestones]) {
      if (!laneIds.has(item.laneId)) issue(`「${item.name}」指向不存在的板块`)
    }

    for (const todo of data.todos) {
      if (todo.laneId !== null && !laneIds.has(todo.laneId)) {
        issue(`待办「${todo.title}」指向不存在的板块`)
      }
    }

    for (const item of [...data.phases, ...data.terms]) {
      if (item.start >= item.end) issue(`「${item.name}」的开始必须早于结束`)
    }
  })

export function createEmptyData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    lanes: [],
    phases: [],
    milestones: [],
    terms: [],
    todos: [],
    lastExportAt: null,
  }
}
