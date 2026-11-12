import { buildIcs, countIcsEvents, escapeText, foldLine, icsFileName } from './ics'
import { createEmptyData, type AppData } from './schema'

const NOW = new Date('2026-11-10T12:34:56.789Z')

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    { id: 'l1', name: '考研, 英语', color: 'iris', order: 0, note: '', links: [] },
    { id: 'l2', name: '四级', color: 'tomato', order: 1, note: '', links: [] },
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
    {
      id: 'p2',
      laneId: 'l2',
      name: '冲刺',
      start: '2026-12-07',
      end: '2026-12-14',
      tentative: true,
      note: '第一行\n第二行',
    },
  ],
  milestones: [{ id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-31', note: '' }],
  todos: [
    {
      id: 't1',
      title: '背单词',
      date: '2026-11-11',
      done: false,
      laneId: 'l2',
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 't2',
      title: '做真题',
      date: '2026-11-12',
      done: true,
      laneId: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 't3',
      title: '还没安排',
      date: null,
      done: false,
      laneId: null,
      createdAt: '2026-11-01T00:00:00Z',
    },
  ],
}

const unfold = (text: string) => text.replace(/\r\n /g, '')
const events = (text: string) => unfold(text).split('BEGIN:VEVENT\r\n').slice(1)

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and newlines', () => {
    expect(escapeText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })

  it('drops other control characters', () => {
    expect(escapeText('a\u0000b\u0007c')).toBe('abc')
  })
})

describe('foldLine', () => {
  it('leaves a short line alone', () => {
    expect(foldLine('SUMMARY:短')).toBe('SUMMARY:短')
  })

  it('keeps every physical line within 75 octets', () => {
    const line = 'SUMMARY:' + '汉字abc'.repeat(40)
    const folded = foldLine(line)
    for (const part of folded.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
    expect(
      folded
        .split('\r\n')
        .slice(1)
        .every((part) => part.startsWith(' ')),
    ).toBe(true)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('never splits a multi-byte character', () => {
    const folded = foldLine('SUMMARY:' + '😀'.repeat(60))
    expect(folded.replace(/\r\n /g, '')).toBe('SUMMARY:' + '😀'.repeat(60))
    expect(folded).not.toContain('\ufffd')
  })
})

describe('buildIcs', () => {
  const text = buildIcs(data, NOW)

  it('uses CRLF everywhere and ends with a line break', () => {
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
  })

  it('has the calendar header', () => {
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true)
  })

  it('stamps every event in UTC', () => {
    expect(events(text).every((event) => event.includes('DTSTAMP:20261110T123456Z\r\n'))).toBe(true)
  })

  it('keeps the exclusive end of a phase as DTEND', () => {
    const [phase] = events(text)
    expect(phase).toContain('DTSTART;VALUE=DATE:20261109\r\n')
    expect(phase).toContain('DTEND;VALUE=DATE:20261207\r\n')
  })

  it('makes single-day events end on the next day, across month and year ends', () => {
    const [, , milestone, todo] = events(text)
    expect(milestone).toContain('DTSTART;VALUE=DATE:20261231\r\n')
    expect(milestone).toContain('DTEND;VALUE=DATE:20270101\r\n')
    expect(todo).toContain('DTSTART;VALUE=DATE:20261111\r\n')
    expect(todo).toContain('DTEND;VALUE=DATE:20261112\r\n')
  })

  it('derives UIDs from item ids and keeps them across exports', () => {
    const later = buildIcs(data, new Date('2027-01-01T00:00:00Z'))
    const uids = (value: string) => value.match(/^UID:.*$/gm)
    expect(uids(text)).toEqual([
      'UID:p1@personal-os',
      'UID:p2@personal-os',
      'UID:m1@personal-os',
      'UID:t1@personal-os',
      'UID:t2@personal-os',
    ])
    expect(uids(later)).toEqual(uids(text))
  })

  it('puts the lane name in CATEGORIES, escaped', () => {
    expect(events(text)[0]).toContain('CATEGORIES:考研\\, 英语\r\n')
  })

  it('skips unscheduled todos', () => {
    expect(text).not.toContain('还没安排')
    expect(events(text)).toHaveLength(5)
  })

  it('prefixes done todos and gives lane-less todos no category', () => {
    const done = events(text)[4]
    expect(done).toContain('SUMMARY:✓ 做真题\r\n')
    expect(done).not.toContain('CATEGORIES')
    expect(events(text)[3]).toContain('SUMMARY:背单词\r\n')
  })

  it('escapes notes into DESCRIPTION and marks tentative phases', () => {
    const tentative = events(text)[1]
    expect(tentative).toContain('DESCRIPTION:第一行\\n第二行\r\n')
    expect(tentative).toContain('STATUS:TENTATIVE\r\n')
    expect(events(text)[0]).not.toContain('DESCRIPTION')
  })

  it('folds long summaries', () => {
    const long: AppData = {
      ...data,
      phases: [{ ...data.phases[0], name: '长'.repeat(40) }],
      milestones: [],
      todos: [],
    }
    const out = buildIcs(long, NOW)
    for (const part of out.split('\r\n')) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    }
    expect(unfold(out)).toContain('SUMMARY:' + '长'.repeat(40))
  })

  it('produces a valid empty calendar for empty data', () => {
    const empty = buildIcs(createEmptyData(), NOW)
    expect(events(empty)).toHaveLength(0)
    expect(empty.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(empty.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
})

it('counts only events that are exported', () => {
  expect(countIcsEvents(data)).toBe(5)
  expect(countIcsEvents(createEmptyData())).toBe(0)
})

it('names the file after the day', () => {
  expect(icsFileName('2026-11-10')).toBe('personal-os-2026-11-10.ics')
})
