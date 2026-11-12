import type { AppData, ISODate } from './schema'

/** 日历文件的 PRODID 和 UID 后缀 */
const PRODID = '-//personal-OS//ICS export//ZH'
const UID_DOMAIN = 'personal-os'
const LINE_MAX_OCTETS = 75

const encoder = new TextEncoder()

/** RFC 5545 §3.3.11：反斜杠、分号、逗号和换行要转义；其余控制字符直接丢掉。 */
export function escapeText(value: string): string {
  return (
    value
      .replace(/\r\n|\r|\n/g, '\n')
      // eslint-disable-next-line no-control-regex -- 就是要去掉控制字符
      .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
  )
}

/** RFC 5545 §3.1：一行最多 75 个字节（不含换行），超出的部分折到下一行并以一个空格开头。不拆开一个字符。 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= LINE_MAX_OCTETS) return line
  const parts: string[] = []
  let current = ''
  let size = 0
  for (const char of line) {
    const width = encoder.encode(char).length
    // 续行开头的空格也算一个字节
    const limit = parts.length === 0 ? LINE_MAX_OCTETS : LINE_MAX_OCTETS - 1
    if (size + width > limit) {
      parts.push(current)
      current = ''
      size = 0
    }
    current += char
    size += width
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** 'YYYY-MM-DD' → 'YYYYMMDD' */
function dateValue(date: ISODate): string {
  return date.replaceAll('-', '')
}

/** 后一天（全天事件的结束日期不含当天） */
function nextDay(date: ISODate): ISODate {
  const time = Date.parse(`${date}T00:00:00Z`) + 86_400_000
  return new Date(time).toISOString().slice(0, 10)
}

function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
}

interface EventFields {
  id: string
  summary: string
  start: ISODate
  /** 不含当天 */
  end: ISODate
  category?: string
  description?: string
  status?: 'TENTATIVE'
}

function eventLines(fields: EventFields, dtstamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${fields.id}@${UID_DOMAIN}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateValue(fields.start)}`,
    `DTEND;VALUE=DATE:${dateValue(fields.end)}`,
    `SUMMARY:${escapeText(fields.summary)}`,
  ]
  if (fields.category) lines.push(`CATEGORIES:${escapeText(fields.category)}`)
  if (fields.description) lines.push(`DESCRIPTION:${escapeText(fields.description)}`)
  if (fields.status) lines.push(`STATUS:${fields.status}`)
  // 全天事件不占用时间
  lines.push('TRANSP:TRANSPARENT', 'END:VEVENT')
  return lines
}

/**
 * 把数据导出为 iCalendar（.ics）文本。
 * 阶段是多日全天事件（结束日期不含当天，和应用里的半开区间一致），节点和有日期的待办是单日全天事件；
 * 没有日期的待办跳过。已完成的待办在标题前加“✓ ”。UID 由条目 id 推出，重复导入时日历会更新而不是重复。
 * 行尾一律是 CRLF。
 */
export function buildIcs(data: AppData, now: Date): string {
  const dtstamp = stamp(now)
  const laneName = new Map(data.lanes.map((lane) => [lane.id, lane.name]))
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const phase of data.phases) {
    lines.push(
      ...eventLines(
        {
          id: phase.id,
          summary: phase.name,
          start: phase.start,
          end: phase.end,
          category: laneName.get(phase.laneId),
          description: phase.note,
          status: phase.tentative ? 'TENTATIVE' : undefined,
        },
        dtstamp,
      ),
    )
  }
  for (const milestone of data.milestones) {
    lines.push(
      ...eventLines(
        {
          id: milestone.id,
          summary: milestone.name,
          start: milestone.date,
          end: nextDay(milestone.date),
          category: laneName.get(milestone.laneId),
          description: milestone.note,
        },
        dtstamp,
      ),
    )
  }
  for (const todo of data.todos) {
    if (todo.date === null) continue
    lines.push(
      ...eventLines(
        {
          id: todo.id,
          summary: todo.done ? `✓ ${todo.title}` : todo.title,
          start: todo.date,
          end: nextDay(todo.date),
          category: todo.laneId === null ? undefined : laneName.get(todo.laneId),
        },
        dtstamp,
      ),
    )
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** 导出的事件数，用来提示。 */
export function countIcsEvents(data: AppData): number {
  return (
    data.phases.length + data.milestones.length + data.todos.filter((t) => t.date !== null).length
  )
}

export function icsFileName(day: ISODate): string {
  return `personal-os-${day}.ics`
}
