import { LANE_COLORS, type FocusSession } from '@/data/schema'
import { toDay } from '@/features/timeline/days'
import {
  clockTime,
  dayTotals,
  formatDuration,
  heatLevel,
  heatmap,
  recentTags,
  sessionDay,
  sessionsOn,
  tagColor,
  totalMs,
  weekByTag,
} from './stats'

const MIN = 60_000
const TODAY = toDay('2026-11-18') // 周三
const MONDAY = toDay('2026-11-16')

/** 本地时间 month 是 1–12；不依赖运行测试的机器在哪个时区 */
function session(
  id: string,
  [month, day, hour = 9, minute = 0]: number[],
  minutes: number,
  tag = '学习',
): FocusSession {
  const start = new Date(2026, month - 1, day, hour, minute)
  return {
    id,
    mode: 'pomodoro',
    tag,
    note: '',
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + minutes * MIN).toISOString(),
    focusMs: minutes * MIN,
    completed: true,
  }
}

describe('days', () => {
  it('puts a session on the local day it started', () => {
    expect(sessionDay(session('a', [11, 18, 23, 50], 10))).toBe(TODAY)
    expect(sessionDay(session('a', [11, 18, 0, 5], 10))).toBe(TODAY)
  })
  it('does not split a session that crosses midnight', () => {
    const late = session('a', [11, 17, 23, 30], 60)
    expect(sessionDay(late)).toBe(TODAY - 1)
    expect(dayTotals([late]).get(TODAY)).toBeUndefined()
    expect(dayTotals([late]).get(TODAY - 1)).toBe(60 * MIN)
  })
  it('sums the focus time per day', () => {
    const totals = dayTotals([
      session('a', [11, 18], 25),
      session('b', [11, 18, 14], 50),
      session('c', [11, 17], 30),
    ])
    expect(totals.get(TODAY)).toBe(75 * MIN)
    expect(totals.get(TODAY - 1)).toBe(30 * MIN)
  })
  it("lists one day's sessions newest first", () => {
    const list = sessionsOn(
      [session('a', [11, 18, 9], 25), session('b', [11, 18, 14], 25), session('c', [11, 17], 25)],
      TODAY,
    )
    expect(list.map((item) => item.id)).toEqual(['b', 'a'])
  })
  it('adds up the focus time', () => {
    expect(totalMs([session('a', [11, 18], 25), session('b', [11, 18], 20)])).toBe(45 * MIN)
    expect(totalMs([])).toBe(0)
  })
})

describe('heatLevel', () => {
  it.each([
    [0, 0],
    [1, 1],
    [29, 1],
    [30, 2],
    [59, 2],
    [60, 3],
    [119, 3],
    [120, 4],
    [600, 4],
  ])('puts %i minutes at level %i', (minutes, level) => expect(heatLevel(minutes)).toBe(level))
})

describe('heatmap', () => {
  const sessions = [
    session('a', [11, 18, 9], 25),
    session('b', [11, 18, 14], 50),
    session('c', [11, 16], 130),
    session('d', [11, 9], 30),
  ]
  const map = heatmap(sessions, TODAY)

  it('has 26 columns of 7 days, Monday on top, the last column being this week', () => {
    expect(map.columns).toHaveLength(26)
    expect(map.columns.every((column) => column.length === 7)).toBe(true)
    expect(map.columns.at(-1)![0].day).toBe(MONDAY)
    expect(map.columns[0][0].day).toBe(MONDAY - 25 * 7)
    for (const column of map.columns)
      expect(new Date(column[0].day * 86_400_000).getUTCDay()).toBe(1)
  })
  it('shows the minutes and level of each day', () => {
    const thisWeek = map.columns.at(-1)!
    expect(thisWeek[0]).toMatchObject({ minutes: 130, level: 4, future: false })
    expect(thisWeek[2]).toMatchObject({ minutes: 75, level: 3, future: false })
    expect(thisWeek[1]).toMatchObject({ minutes: 0, level: 0, future: false })
    expect(map.columns.at(-2)![0]).toMatchObject({ minutes: 30, level: 2 })
  })
  it('does not draw the days after today', () => {
    const thisWeek = map.columns.at(-1)!
    expect(thisWeek.map((cell) => cell.future)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true,
    ])
  })
  it('leaves out sessions older than the window', () => {
    const old = session('o', [3, 1], 60)
    const total = heatmap([old], TODAY)
      .columns.flat()
      .reduce((sum, cell) => sum + cell.minutes, 0)
    expect(total).toBe(0)
  })
  it('rounds each day to whole minutes', () => {
    const odd = { ...session('a', [11, 18], 1), focusMs: 90_000 }
    expect(heatmap([odd], TODAY).columns.at(-1)![2].minutes).toBe(2)
  })
  it('puts month labels on the columns where the month changes', () => {
    const labelled = map.months.map((m) => m.month)
    expect(labelled.at(-1)).toBe(11)
    expect(new Set(labelled).size).toBe(labelled.length)
    // 一个月至少隔两列，标签不会挤在一起
    for (let i = 1; i < map.months.length; i++)
      expect(map.months[i].column - map.months[i - 1].column).toBeGreaterThanOrEqual(2)
  })
  it('works for other lengths', () => {
    expect(heatmap([], TODAY, 4).columns).toHaveLength(4)
  })
})

describe('weekByTag', () => {
  it('adds up this week per tag, biggest first, with bar ratios', () => {
    const rows = weekByTag(
      [
        session('a', [11, 16], 60, '英语'),
        session('b', [11, 18], 25, '学习'),
        session('c', [11, 18, 14], 25, '学习'),
        session('d', [11, 17], 15, '写作'),
      ],
      TODAY,
    )
    expect(rows).toEqual([
      { tag: '英语', ms: 60 * MIN, ratio: 1 },
      { tag: '学习', ms: 50 * MIN, ratio: 50 / 60 },
      { tag: '写作', ms: 15 * MIN, ratio: 15 / 60 },
    ])
  })
  it('counts Monday and Sunday, but not the day before or after the week', () => {
    const rows = weekByTag(
      [
        session('sun-before', [11, 15, 23], 10, '上周'),
        session('mon', [11, 16, 0, 1], 10, '周一'),
        session('sun', [11, 22, 23, 0], 10, '周日'),
        session('mon-after', [11, 23, 0, 1], 10, '下周'),
      ],
      TODAY,
    )
    expect(rows.map((row) => row.tag).sort()).toEqual(['周一', '周日'].sort())
  })
  it('also counts days after today when they are still this week', () => {
    expect(weekByTag([session('a', [11, 21], 30, '周六')], TODAY)).toHaveLength(1)
  })
  it('breaks ties by tag name so the order is stable', () => {
    const rows = weekByTag(
      [session('a', [11, 18], 30, 'b'), session('b', [11, 18], 30, 'a')],
      TODAY,
    )
    expect(rows.map((row) => row.tag)).toEqual(['a', 'b'])
  })
  it('is empty when nothing was done this week', () => {
    expect(weekByTag([session('a', [11, 10], 30)], TODAY)).toEqual([])
    expect(weekByTag([], TODAY)).toEqual([])
  })
})

describe('recentTags', () => {
  it('lists each tag once, the most recently used first', () => {
    const tags = recentTags([
      session('a', [11, 10], 25, '英语'),
      session('b', [11, 12], 25, '学习'),
      session('c', [11, 14], 25, '英语'),
      session('d', [11, 11], 25, '写作'),
    ])
    expect(tags).toEqual(['英语', '学习', '写作'])
  })
  it('limits the list', () => {
    const many = Array.from({ length: 12 }, (_, i) => session(`s${i}`, [11, i + 1], 25, `标签${i}`))
    expect(recentTags(many)).toHaveLength(8)
    expect(recentTags(many, 3)).toHaveLength(3)
    expect(recentTags(many)[0]).toBe('标签11')
  })
})

describe('tagColor', () => {
  it('always gives the same lane colour for the same tag', () => {
    expect(tagColor('学习')).toBe(tagColor('学习'))
    expect(tagColor('English')).toBe(tagColor('English'))
  })
  it('stays inside the lane palette', () => {
    for (const tag of ['学习', '英语', '写作', 'a', 'b', '😀', 'x'.repeat(20)])
      expect(LANE_COLORS).toContain(tagColor(tag))
  })
  it('spreads different tags over several colours', () => {
    const colours = new Set(
      ['学习', '英语', '写作', '数学', '阅读', '运动', '编程', '复习'].map(tagColor),
    )
    expect(colours.size).toBeGreaterThanOrEqual(4)
  })
})

describe('formatting', () => {
  it.each([
    [0, '不足 1 分'],
    [59_999, '不足 1 分'],
    [25 * MIN, '25 分'],
    [60 * MIN, '1 时'],
    [85 * MIN, '1 时 25 分'],
    [26 * 60 * MIN + 3 * MIN, '26 时 3 分'],
  ])('writes %i ms as %s', (ms, text) => expect(formatDuration(ms)).toBe(text))
  it('writes a local clock time', () => {
    expect(clockTime(new Date(2026, 10, 18, 9, 5).toISOString())).toBe('09:05')
    expect(clockTime(new Date(2026, 10, 18, 14, 30).toISOString())).toBe('14:30')
  })
})
