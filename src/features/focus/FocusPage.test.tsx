import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData, type FocusSession } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { DEFAULT_PREFS, PREFS_KEY, RUN_KEY, useFocusStore } from './focusStore'
import { startRun } from './timer'

const MIN = 60_000
const NOW = new Date(2026, 10, 18, 10, 0, 0) // 周三 10:00（本地）
const f = () => useFocusStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  localStorage.clear()
  window.location.hash = '#/focus'
  document.title = 'Kairos OS · 个人 OS'
  resetEditor()
  useFocusStore.setState({ run: null, prefs: DEFAULT_PREFS })
})
afterEach(() => vi.useRealTimers())

function session(
  id: string,
  at: [number, number, number, number],
  minutes: number,
  tag = '学习',
  note = '',
): FocusSession {
  const start = new Date(2026, at[0] - 1, at[1], at[2], at[3])
  return {
    id,
    mode: 'pomodoro',
    tag,
    note,
    startAt: start.toISOString(),
    endAt: new Date(start.getTime() + minutes * MIN).toISOString(),
    focusMs: minutes * MIN,
    completed: true,
  }
}

function setup(data: Partial<AppData> = {}) {
  useStore.getState().hydrate({ ...createEmptyData(), ...data })
  render(<App />)
  return userEvent.setup()
}

/** 时间往后走（只有 Date 是假的），再让计时器重新算一次 */
function pass(ms: number) {
  vi.setSystemTime(Date.now() + ms)
  act(() => void f().tick())
}

describe('navigation', () => {
  it('has a 专注 link in the nav that opens the page', async () => {
    window.location.hash = '#/home'
    const user = setup()
    await user.click(screen.getByRole('link', { name: '专注' }))
    expect(screen.getByTestId('focus-page')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/focus')
    expect(screen.getByRole('link', { name: '专注' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('starting', () => {
  it('cannot start without a tag', () => {
    setup()
    expect(screen.getByRole('button', { name: '开始' })).toBeDisabled()
  })

  it('starts a pomodoro with a new tag and a note, and shows the countdown', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '45/10' }))
    await user.type(screen.getByLabelText('标签'), '数学')
    await user.type(screen.getByLabelText('备注'), '线代第三章')
    await user.click(screen.getByRole('button', { name: '开始' }))

    const view = within(screen.getByTestId('focus-timer')).getByTestId('run-view')
    expect(within(view).getByText('数学')).toBeInTheDocument()
    expect(within(view).getByRole('timer')).toHaveTextContent('45:00')
    expect(f().run).toMatchObject({
      mode: 'pomodoro',
      tag: '数学',
      note: '线代第三章',
      focusMs: 45 * MIN,
      breakMs: 10 * MIN,
    })
    expect(JSON.parse(localStorage.getItem(RUN_KEY)!)).toMatchObject({ tag: '数学' })
  })

  it('starts a stopwatch that counts up', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '正计时' }))
    // 正计时没有时长可选
    expect(screen.queryByRole('button', { name: '25/5' })).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('标签'), '阅读')
    await user.click(screen.getByRole('button', { name: '开始' }))
    expect(f().run).toMatchObject({ mode: 'stopwatch', focusMs: 0 })
    expect(screen.getByRole('timer')).toHaveTextContent('00:00')
    pass(90_000)
    await waitFor(() => expect(screen.getByRole('timer')).toHaveTextContent('01:30'))
  })

  it('takes custom lengths', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '自定义' }))
    await user.clear(screen.getByLabelText('专注'))
    await user.type(screen.getByLabelText('专注'), '30')
    await user.clear(screen.getByLabelText('休息'))
    await user.type(screen.getByLabelText('休息'), '7')
    await user.type(screen.getByLabelText('标签'), '写作')
    await user.click(screen.getByRole('button', { name: '开始' }))
    expect(f().run).toMatchObject({ focusMs: 30 * MIN, breakMs: 7 * MIN })
  })

  it('offers history tags, filters them as you type, and completes with Tab', async () => {
    const user = setup({
      focusSessions: [
        session('a', [11, 10, 9, 0], 25, '英语'),
        session('b', [11, 12, 9, 0], 25, '数学'),
        session('c', [11, 14, 9, 0], 25, '英语听力'),
      ],
    })
    const chips = () =>
      within(screen.getByRole('group', { name: '历史标签' }))
        .getAllByRole('button')
        .map((b) => b.textContent)
    // 最近用过的在前
    expect(chips()).toEqual(['英语听力', '数学', '英语'])
    await user.type(screen.getByLabelText('标签'), '英')
    expect(chips()).toEqual(['英语听力', '英语'])
    await user.tab()
    expect(screen.getByLabelText('标签')).toHaveValue('英语听力')
  })

  it('does not complete a tag that is already typed in full', async () => {
    const user = setup({
      focusSessions: [
        session('a', [11, 10, 9, 0], 25, '英语'),
        session('b', [11, 12, 9, 0], 25, '英语听力'),
      ],
    })
    await user.type(screen.getByLabelText('标签'), '英语')
    await user.tab()
    expect(screen.getByLabelText('标签')).toHaveValue('英语')
    // Tab 照常把焦点交给下一个控件，而不是留在输入框里补全
    expect(screen.getByLabelText('标签')).not.toHaveFocus()
  })

  it('fills the tag from a chip', async () => {
    const user = setup({ focusSessions: [session('a', [11, 10, 9, 0], 25, '数学')] })
    await user.click(screen.getByRole('button', { name: '数学' }))
    expect(screen.getByLabelText('标签')).toHaveValue('数学')
    expect(screen.getByRole('button', { name: '开始' })).toBeEnabled()
  })

  it('gives the same tag the same colour everywhere', async () => {
    setup({
      focusSessions: [
        session('a', [11, 18, 9, 0], 25, '数学'),
        session('b', [11, 17, 9, 0], 25, '数学'),
      ],
    })
    const colours = ['focus-a', 'focus-b']
      .map((id) => screen.queryByTestId(id)?.getAttribute('data-lane-color'))
      .filter(Boolean)
    expect(colours).toHaveLength(1) // 只有今天的记录在列表里
    const row = screen.getByTestId('week-tag-数学')
    expect(row.getAttribute('data-lane-color')).toBe(colours[0])
  })
})

describe('while running', () => {
  const run = () =>
    startRun({ mode: 'pomodoro', tag: '学习', note: '', focusMin: 25, breakMin: 5 }, Date.now())

  it('pauses and resumes', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    await user.click(screen.getByRole('button', { name: '暂停' }))
    expect(f().run?.pausedAt).not.toBeNull()
    expect(screen.getByText(/已暂停/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '继续' }))
    expect(f().run?.pausedAt).toBeNull()
  })

  it('finishes early, saves the record, and lists it under today', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    pass(12 * MIN)
    await user.click(screen.getByRole('button', { name: '提前完成' }))
    expect(f().run).toBeNull()
    const today = screen.getByTestId('focus-today')
    expect(within(today).getByText('学习')).toBeInTheDocument()
    expect(within(today).getByText('12 分')).toBeInTheDocument()
    expect(useStore.getState().data.focusSessions[0]).toMatchObject({ completed: false })
    expect(screen.getByTestId('focus-summary')).toHaveTextContent('今天 12 分 · 1 次')
    // 回到可以开始新一轮的表单
    expect(screen.getByRole('button', { name: '开始' })).toBeInTheDocument()
  })

  it('tells you when a round is too short to save', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    pass(30_000)
    await user.click(screen.getByRole('button', { name: '提前完成' }))
    expect(useStore.getState().data.focusSessions).toEqual([])
    expect(await screen.findByText('不足 1 分钟，没有保存')).toBeInTheDocument()
  })

  it('needs a second click to give up, and records nothing', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    pass(10 * MIN)
    await user.click(screen.getByRole('button', { name: '放弃' }))
    expect(f().run).not.toBeNull()
    await user.click(screen.getByRole('button', { name: '确认放弃' }))
    expect(f().run).toBeNull()
    expect(useStore.getState().data.focusSessions).toEqual([])
  })

  it('goes into the break by itself when the focus time is up', async () => {
    useFocusStore.setState({ run: run() })
    setup()
    pass(25 * MIN)
    await waitFor(() =>
      expect(screen.getByTestId('run-view')).toHaveAttribute('data-phase', 'break'),
    )
    expect(useStore.getState().data.focusSessions).toMatchObject([
      { focusMs: 25 * MIN, completed: true },
    ])
    expect(screen.getByRole('timer')).toHaveTextContent('05:00')
    pass(5 * MIN)
    await waitFor(() =>
      expect(screen.getByTestId('run-view')).toHaveAttribute('data-phase', 'ready'),
    )
    expect(screen.getByRole('button', { name: '开始下一轮' })).toBeInTheDocument()
  })

  it('starts the next round after the break, keeping the settings', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    pass(31 * MIN)
    await user.click(await screen.findByRole('button', { name: '开始下一轮' }))
    expect(f().run).toMatchObject({ phase: 'focus', tag: '学习', focusMs: 25 * MIN })
    expect(useStore.getState().data.focusSessions).toHaveLength(1)
  })

  it('shows the time in the browser tab title, and puts the title back when idle', async () => {
    useFocusStore.setState({ run: run() })
    const user = setup()
    await waitFor(() => expect(document.title).toBe('25:00 · 专注 · Kairos OS'))
    pass(60_000)
    await waitFor(() => expect(document.title).toBe('24:00 · 专注 · Kairos OS'))
    await user.click(screen.getByRole('button', { name: '暂停' }))
    await waitFor(() => expect(document.title).toBe('⏸ 24:00 · 专注 · Kairos OS'))
    await user.click(screen.getByRole('button', { name: '放弃' }))
    await user.click(screen.getByRole('button', { name: '确认放弃' }))
    await waitFor(() => expect(document.title).toBe('Kairos OS · 个人 OS'))
  })

  it('picks up a round that was running when the page was closed', async () => {
    localStorage.setItem(
      RUN_KEY,
      JSON.stringify(
        startRun(
          { mode: 'pomodoro', tag: '学习', note: '读书', focusMin: 25, breakMin: 5 },
          Date.now() - 27 * MIN,
        ),
      ),
    )
    useFocusStore.getState().reload()
    setup()
    // 关着页面的时候专注已经到点：记录补上了，现在在休息里
    await waitFor(() =>
      expect(screen.getByTestId('run-view')).toHaveAttribute('data-phase', 'break'),
    )
    expect(useStore.getState().data.focusSessions).toMatchObject([
      { tag: '学习', note: '读书', focusMs: 25 * MIN },
    ])
  })
})

describe('today records', () => {
  const data = () => ({
    focusSessions: [
      session('a', [11, 18, 9, 5], 25, '学习', '整理错题'),
      session('b', [11, 18, 7, 0], 50, '英语'),
      session('c', [11, 17, 9, 0], 25, '学习'),
    ],
  })

  it('lists today’s records newest first, with time range, tag, note and length', () => {
    setup(data())
    const rows = within(screen.getByTestId('focus-today')).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('09:05–09:30')
    expect(rows[0]).toHaveTextContent('学习')
    expect(rows[0]).toHaveTextContent('整理错题')
    expect(rows[0]).toHaveTextContent('25 分')
    expect(rows[1]).toHaveTextContent('07:00–07:50')
    expect(screen.getByTestId('focus-summary')).toHaveTextContent('今天 1 时 15 分 · 2 次')
  })

  it('says so when there is nothing today', () => {
    setup()
    expect(screen.getByText('今天还没有专注记录')).toBeInTheDocument()
    expect(screen.queryByTestId('focus-summary')).not.toBeInTheDocument()
  })

  it('edits the tag and note of a record', async () => {
    const user = setup(data())
    await user.click(screen.getByRole('button', { name: '修改「学习」' }))
    const row = screen.getByTestId('focus-a')
    const tag = within(row).getByLabelText('标签')
    await user.clear(tag)
    await user.type(tag, '写作')
    const note = within(row).getByLabelText('备注')
    await user.clear(note)
    await user.type(note, '第二节')
    await user.click(within(row).getByRole('button', { name: '保存' }))
    expect(useStore.getState().data.focusSessions.find((s) => s.id === 'a')).toMatchObject({
      tag: '写作',
      note: '第二节',
    })
    expect(within(screen.getByTestId('focus-a')).getByText('写作')).toBeInTheDocument()
    expect(within(screen.getByTestId('week-tag-写作')).getByText('25 分')).toBeInTheDocument()
  })

  it('cancels an edit with Escape and keeps the record as it was', async () => {
    const user = setup(data())
    await user.click(screen.getByRole('button', { name: '修改「学习」' }))
    await user.type(within(screen.getByTestId('focus-a')).getByLabelText('标签'), '乱写')
    await user.keyboard('{Escape}')
    expect(useStore.getState().data.focusSessions.find((s) => s.id === 'a')?.tag).toBe('学习')
    expect(screen.getByRole('button', { name: '修改「学习」' })).toBeInTheDocument()
  })

  it('cannot save an empty tag', async () => {
    const user = setup(data())
    await user.click(screen.getByRole('button', { name: '修改「学习」' }))
    await user.clear(within(screen.getByTestId('focus-a')).getByLabelText('标签'))
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })

  it('deletes a record and brings it back with undo', async () => {
    const user = setup(data())
    await user.click(screen.getByRole('button', { name: '删除「学习」' }))
    expect(screen.queryByTestId('focus-a')).not.toBeInTheDocument()
    expect(useStore.getState().data.focusSessions.map((s) => s.id)).toEqual(['b', 'c'])
    await user.click(await screen.findByRole('button', { name: '撤销' }))
    expect(screen.getByTestId('focus-a')).toBeInTheDocument()
  })
})

describe('statistics', () => {
  it('adds up this week per tag and leaves last week out', () => {
    setup({
      focusSessions: [
        session('a', [11, 16, 9, 0], 60, '英语'),
        session('b', [11, 18, 9, 0], 25, '学习'),
        session('c', [11, 18, 14, 0], 25, '学习'),
        session('d', [11, 15, 22, 0], 90, '上周的'),
      ],
    })
    const week = screen.getByTestId('focus-week')
    expect(
      within(week)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['英语1 时', '学习50 分'])
    expect(within(week).queryByText('上周的')).not.toBeInTheDocument()
  })

  it('says so when this week is empty', () => {
    setup()
    expect(screen.getByText('本周还没有专注记录')).toBeInTheDocument()
  })

  it('draws 26 weeks with the minutes of each day', () => {
    setup({
      focusSessions: [
        session('a', [11, 18, 9, 0], 25, '学习'),
        session('b', [11, 18, 14, 0], 50, '学习'),
        session('c', [11, 17, 9, 0], 130, '英语'),
      ],
    })
    const grid = within(screen.getByTestId('focus-heatmap')).getByRole('group', {
      name: '最近 26 周的专注热力图',
    })
    const cells = within(grid).getAllByRole('img')
    expect(cells).toHaveLength(26 * 7)
    const today = within(grid).getByRole('img', { name: '11月18日 周三 · 75 分钟' })
    expect(today).toHaveAttribute('data-level', '3')
    const yesterday = within(grid).getByRole('img', { name: '11月17日 周二 · 130 分钟' })
    expect(yesterday).toHaveAttribute('data-level', '4')
    expect(within(grid).getByRole('img', { name: '11月16日 周一 · 0 分钟' })).toHaveAttribute(
      'data-level',
      '0',
    )
    // 今天之后的格子不画
    expect(within(grid).getByRole('img', { name: '11月19日 周四 · 0 分钟' })).toHaveAttribute(
      'data-future',
      'true',
    )
  })
})

describe('home corner widget', () => {
  beforeEach(() => {
    window.location.hash = '#/home'
  })

  it('opens the start form from the corner when nothing has been started before', async () => {
    const user = setup()
    const widget = screen.getByTestId('focus-widget')
    await user.click(within(widget).getByRole('button', { name: '专注' }))
    expect(screen.getByLabelText('标签')).toBeInTheDocument()
    await user.type(screen.getByLabelText('标签'), '学习')
    await user.click(screen.getByRole('button', { name: '开始' }))
    expect(f().run).toMatchObject({ tag: '学习', mode: 'pomodoro' })
    expect(within(screen.getByTestId('focus-widget')).getByRole('timer')).toHaveTextContent('25:00')
  })

  it('starts with one tap using the last settings', async () => {
    useFocusStore.setState({
      prefs: {
        ...DEFAULT_PREFS,
        last: { mode: 'pomodoro', focusMin: 50, breakMin: 10, tag: '英语' },
      },
    })
    const user = setup()
    await user.click(screen.getByRole('button', { name: '开始 50/10 · 英语' }))
    expect(f().run).toMatchObject({ tag: '英语', focusMs: 50 * MIN, breakMs: 10 * MIN })
  })

  it('shows the running round with controls and a link to the focus page', async () => {
    useFocusStore.setState({
      run: startRun(
        { mode: 'stopwatch', tag: '阅读', note: '', focusMin: 25, breakMin: 5 },
        Date.now(),
      ),
    })
    const user = setup()
    const widget = screen.getByTestId('focus-widget')
    expect(within(widget).getByText('阅读')).toBeInTheDocument()
    expect(within(widget).getByRole('link', { name: '去专注页' })).toHaveAttribute(
      'href',
      '#/focus',
    )
    await user.click(within(widget).getByRole('button', { name: '暂停' }))
    expect(f().run?.pausedAt).not.toBeNull()
  })

  it('is also there when there are no lanes yet', () => {
    setup({ lanes: [] })
    expect(screen.getByTestId('focus-widget')).toBeInTheDocument()
  })

  it('is not on the other pages', () => {
    window.location.hash = '#/today'
    setup()
    expect(screen.queryByTestId('focus-widget')).not.toBeInTheDocument()
  })
})

describe('settings', () => {
  it('turns the system notification and the sound off, and remembers it', async () => {
    const user = setup()
    await user.click(screen.getByRole('button', { name: '专注设置' }))
    const notify = screen.getByRole('switch', { name: '系统通知' })
    const sound = screen.getByRole('switch', { name: '提示音' })
    expect(notify).toBeChecked()
    expect(sound).toBeChecked()
    await user.click(notify)
    await user.click(sound)
    expect(f().prefs).toMatchObject({ notify: false, sound: false })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY)!)).toMatchObject({
      notify: false,
      sound: false,
    })
  })
})
