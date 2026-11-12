import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '@/app/App'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor, useEditorStore } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { calendarData as data, makeTodo } from '@/test/calendarFixtures'

const s = () => useStore.getState()

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  localStorage.clear()
  window.location.hash = '#/calendar'
  resetViewport()
  resetEditor()
})
afterEach(() => vi.useRealTimers())

function setup(hash = '#/calendar', initial: AppData = data) {
  window.location.hash = hash
  s().hydrate(initial)
  const user = userEvent.setup()
  render(<App />)
  return user
}

const grid = () => screen.getByTestId('month-grid')
const dayCells = () => within(grid()).getAllByTestId(/^day-/)
const heading = () => screen.getByRole('heading', { level: 1 })
const cell = (iso: string) => screen.getByTestId(`day-${iso}`)

describe('month and header', () => {
  it('shows November 2026 with a Monday-first header and six weeks', () => {
    setup()
    expect(heading()).toHaveTextContent('2026年11月')
    expect(screen.getByTestId('weekdays').textContent).toBe('一二三四五六日')
    expect(dayCells()).toHaveLength(42)
    expect(screen.getByTestId('day-2026-11-10')).toHaveAttribute('data-today', 'true')
    expect(screen.getByTestId('day-2026-11-09')).toHaveAttribute('data-today', 'false')
    expect(screen.getByTestId('day-2026-10-26')).toHaveAttribute('data-outside', 'true')
    expect(screen.getByTestId('day-2026-11-01')).toHaveAttribute('data-outside', 'false')
  })

  it('shows four weeks for February 2027', () => {
    setup('#/calendar/2027-02')
    expect(heading()).toHaveTextContent('2027年2月')
    expect(dayCells()).toHaveLength(28)
  })

  it.each(['#/calendar/2026-13', '#/calendar/x'])('falls back to this month for %s', (hash) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    setup(hash)
    expect(heading()).toHaveTextContent('2026年11月')
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('links to the neighbouring months and back to today', async () => {
    const user = setup('#/calendar/2027-02')
    expect(screen.getByRole('link', { name: '上个月' })).toHaveAttribute(
      'href',
      '#/calendar/2027-01',
    )
    expect(screen.getByRole('link', { name: '下个月' })).toHaveAttribute(
      'href',
      '#/calendar/2027-03',
    )
    expect(screen.getByRole('link', { name: '今天' })).toHaveAttribute('href', '#/calendar')
    await user.click(screen.getByRole('link', { name: '下个月' }))
    expect(window.location.hash).toBe('#/calendar/2027-03')
    expect(heading()).toHaveTextContent('2027年3月')
    await user.click(screen.getByRole('link', { name: '今天' }))
    expect(heading()).toHaveTextContent('2026年11月')
  })

  it('moves forward one month from the current month', async () => {
    const user = setup()
    await user.click(screen.getByRole('link', { name: '下个月' }))
    expect(window.location.hash).toBe('#/calendar/2026-12')
  })

  it('disables the previous arrow in January 1900', () => {
    setup('#/calendar/1900-01')
    expect(screen.getByRole('button', { name: '上个月' })).toBeDisabled()
    expect(screen.getByRole('link', { name: '下个月' })).toBeInTheDocument()
  })

  it('disables the next arrow in December 2100', () => {
    setup('#/calendar/2100-12')
    expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled()
  })

  it('highlights the calendar item in the top bar', () => {
    setup()
    expect(screen.getByRole('link', { name: '日历' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('items on the cards', () => {
  it('shows a todo as a bar and a title, coloured by its lane', () => {
    setup()
    const item = within(cell('2026-11-12')).getByTestId('todo-t1')
    expect(item).toHaveTextContent('写周报')
    expect(item).toHaveAttribute('data-lane-color', 'iris')
    expect(item).toHaveAttribute('data-done', 'false')
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('写周报'))
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('2026年11月12日'))
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('未完成'))
    expect(item.querySelector('.todo-bar')).not.toBeNull()
  })

  it('shows a todo without a lane in the neutral colour', () => {
    setup()
    expect(screen.getByTestId('todo-t2')).toHaveAttribute('data-lane-color', 'neutral')
  })

  it('keeps a finished todo in its cell, marked as done', () => {
    setup()
    const item = within(cell('2026-11-13')).getByTestId('todo-t3')
    expect(item).toHaveAttribute('data-done', 'true')
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('已完成'))
    expect(
      within(cell('2026-11-13')).getByRole('checkbox', { name: '完成「交作业」' }),
    ).toBeChecked()
  })

  it('draws a milestone differently from a todo, with its lane colour', () => {
    setup()
    const item = within(cell('2026-11-20')).getByTestId('milestone-m1')
    expect(item).toHaveTextContent('面试')
    expect(item).toHaveAttribute('data-lane-color', 'teal')
    expect(item).toHaveAttribute('data-item', 'milestone')
    expect(item.querySelector('.todo-bar')).toBeNull()
    expect(item).toHaveAttribute('aria-label', expect.stringContaining('面试'))
  })

  it('does not draw phase bars or term bands any more', () => {
    setup('#/calendar', {
      ...data,
      phases: [
        {
          id: 'p1',
          laneId: 'l1',
          name: '强化',
          start: '2026-11-04',
          end: '2026-11-12',
          tentative: false,
          done: false,
          note: '',
        },
      ],
      terms: [{ id: 'tm1', name: '秋季学期', start: '2026-09-01', end: '2027-01-15' }],
    })
    expect(screen.queryByText('强化')).not.toBeInTheDocument()
    expect(screen.queryByText('秋季学期')).not.toBeInTheDocument()
    expect(document.querySelector('[data-item="phase"]')).toBeNull()
  })

  it('shows todos on days outside the month too, faded', () => {
    setup('#/calendar', {
      ...data,
      todos: [makeTodo('o1', { title: '上月的事', date: '2026-10-28' })],
    })
    expect(cell('2026-10-28')).toHaveAttribute('data-outside', 'true')
    expect(within(cell('2026-10-28')).getByTestId('todo-o1')).toBeInTheDocument()
  })

  it('shows the grid even without lanes, so todos can be used on their own', () => {
    setup('#/calendar', {
      ...createEmptyData(),
      todos: [makeTodo('a', { title: '孤零零', date: '2026-11-12' })],
    })
    expect(screen.queryByText('开始规划你的时间线')).not.toBeInTheDocument()
    expect(dayCells()).toHaveLength(42)
    expect(within(cell('2026-11-12')).getByTestId('todo-a')).toHaveAttribute(
      'data-lane-color',
      'neutral',
    )
  })

  it('shows todos from other months when you go there', () => {
    setup('#/calendar/2026-12', {
      ...data,
      todos: [makeTodo('d', { title: '十二月', date: '2026-12-24' })],
    })
    expect(within(cell('2026-12-24')).getByTestId('todo-d')).toBeInTheDocument()
    expect(screen.queryByTestId('todo-t1')).not.toBeInTheDocument()
  })
})

describe('card colours', () => {
  it('keeps every cell neutral: the colour lives on the items, not on the card', () => {
    setup()
    for (const iso of ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-20']) {
      expect(cell(iso)).not.toHaveAttribute('data-tint')
      expect(cell(iso)).not.toHaveAttribute('data-lane-color')
    }
  })

  it('gives each item its own lane colour, neutral when it has no lane', () => {
    setup()
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-lane-color', 'iris')
    expect(screen.getByTestId('todo-t2')).toHaveAttribute('data-lane-color', 'neutral')
  })

  it('marks today and the days outside the month', () => {
    setup()
    expect(cell('2026-11-10')).toHaveAttribute('data-today', 'true')
    expect(cell('2026-11-11')).toHaveAttribute('data-today', 'false')
    expect(cell('2026-12-01')).toHaveAttribute('data-outside', 'true')
  })
})

describe('editing from the calendar', () => {
  it('opens the todo editor when a todo is clicked', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    expect(within(dialog).getByLabelText('标题')).toHaveValue('写周报')
    expect(within(dialog).getByLabelText('日期')).toHaveValue('2026-11-12')
    expect(within(dialog).getByLabelText('板块')).toHaveValue('l1')
    expect(useEditorStore.getState().editing).toMatchObject({ kind: 'todo', id: 't1' })
  })

  it('opens the milestone editor when a milestone is clicked', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
    expect(s().selection).toEqual({ kind: 'milestone', id: 'm1' })
  })

  it('edits the title, the lane, the date and the done state from the panel', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })

    const title = within(dialog).getByLabelText('标题')
    await user.clear(title)
    await user.type(title, '写月报{Enter}')
    expect(s().data.todos[0]!.title).toBe('写月报')

    await user.selectOptions(within(dialog).getByLabelText('板块'), '不挂板块')
    expect(s().data.todos[0]!.laneId).toBeNull()
    await user.selectOptions(within(dialog).getByLabelText('板块'), '实习')
    expect(s().data.todos[0]!.laneId).toBe('l2')

    await user.click(within(dialog).getByRole('switch', { name: '完成' }))
    expect(s().data.todos[0]!.done).toBe(true)
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-done', 'true')
    expect(screen.getByTestId('todo-t1')).toHaveAttribute('data-lane-color', 'teal')
  })

  it('deletes from the panel with an undo toast', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    await user.click(within(dialog).getByRole('button', { name: '删除' }))
    expect(s().data.todos.map((todo) => todo.id)).toEqual(['t2', 't3', 't4'])
    expect(await screen.findByText('已删除「写周报」')).toBeInTheDocument()
    await user.keyboard('{Control>}z{/Control}')
    expect(s().data.todos).toHaveLength(4)
  })

  it('keeps the editor open when the edited todo moves to another week', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    await screen.findByRole('dialog', { name: '编辑待办' })
    act(() => s().updateTodo('t1', { date: '2026-11-26' }))
    expect(within(cell('2026-11-26')).getByTestId('todo-t1')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
  })

  it('follows the todo to its new month when the date leaves the visible weeks', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    await screen.findByRole('dialog', { name: '编辑待办' })

    act(() => s().updateTodo('t1', { date: '2027-03-15' }))

    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2027-03'))
    expect(await screen.findByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
    expect(screen.getByTestId('todo-t1')).toBeInTheDocument()
  })

  it('moves the panel to the unscheduled list when the date is cleared', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    await user.click(within(dialog).getByRole('button', { name: '清除日期' }))
    expect(s().data.todos[0]!.date).toBeNull()
    expect(within(screen.getByTestId('unscheduled')).getByTestId('todo-t1')).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: '编辑待办' })).toBeInTheDocument()
    expect(within(cell('2026-11-12')).queryByTestId('todo-t1')).not.toBeInTheDocument()
  })

  it('puts an undated todo on a day when a date is typed in the panel', async () => {
    const user = setup()
    await user.click(within(screen.getByTestId('unscheduled')).getByTestId('todo-t4'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    const date = within(dialog).getByLabelText('日期')
    expect(date).toHaveValue('')
    await user.type(date, '2026-11-18')
    expect(s().data.todos.find((todo) => todo.id === 't4')!.date).toBe('2026-11-18')
    expect(within(cell('2026-11-18')).getByTestId('todo-t4')).toBeInTheDocument()
  })

  it('does not clear the date of a dated todo while its input is being retyped', async () => {
    const user = setup()
    await user.click(screen.getByTestId('todo-t1'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    const date = within(dialog).getByLabelText('日期')
    const before = s().past.length
    // 原生日期框删掉一段时会给出空值
    fireEvent.change(date, { target: { value: '' } })
    expect(s().data.todos[0]!.date).toBe('2026-11-12')
    expect(s().past.length).toBe(before)
    // 失焦后恢复成数据里的日期
    fireEvent.blur(date)
    expect(date).toHaveValue('2026-11-12')
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not nag about an empty date on an undated todo', async () => {
    const user = setup()
    await user.click(within(screen.getByTestId('unscheduled')).getByTestId('todo-t4'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    const date = within(dialog).getByLabelText('日期')
    await user.click(date)
    await user.tab()
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('undoes a change made on this page with Ctrl+Z', async () => {
    const user = setup()
    act(() => s().updateTodo('t1', { title: '改了' }))
    expect(screen.getByTestId('todo-t1')).toHaveTextContent('改了')
    await user.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('todo-t1')).toHaveTextContent('写周报')
  })

  it('closes the panel when leaving the page so it does not reappear elsewhere', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    await screen.findByRole('dialog', { name: '编辑节点' })

    window.location.hash = '#/timeline'
    await waitFor(() => expect(screen.queryByTestId('month-grid')).not.toBeInTheDocument())
    expect(useEditorStore.getState().editing).toBeNull()
  })

  it('follows a milestone to its new month, like before', async () => {
    const user = setup()
    await user.click(screen.getByTestId('milestone-m1'))
    await screen.findByRole('dialog', { name: '编辑节点' })
    act(() => s().updateMilestone('m1', { date: '2026-12-15' }))
    await waitFor(() => expect(window.location.hash).toBe('#/calendar/2026-12'))
    expect(await screen.findByRole('dialog', { name: '编辑节点' })).toBeInTheDocument()
    expect(screen.getByTestId('milestone-m1')).toBeInTheDocument()
  })
})

describe('a crowded day', () => {
  const crowded = (extra: AppData['todos'] = [], milestones: AppData['milestones'] = []) =>
    ({
      ...createEmptyData(),
      lanes: data.lanes,
      milestones,
      todos: [
        makeTodo('a', { title: '甲', date: '2026-11-09', laneId: 'l1' }),
        makeTodo('b', { title: '乙', date: '2026-11-09', laneId: 'l1' }),
        makeTodo('c', { title: '丙', date: '2026-11-09', laneId: 'l2' }),
        makeTodo('d', { title: '丁', date: '2026-11-09' }),
        ...extra,
      ],
    }) satisfies AppData

  const titles = (iso: string) =>
    within(cell(iso))
      .queryAllByTestId(/^(todo|milestone)-/)
      .map((item) => item.textContent)
  const focusTitles = () =>
    within(screen.getByTestId('day-focus-list'))
      .getAllByTestId(/^(todo|milestone)-/)
      .map((item) => item.textContent)
  const moreButton = () => screen.getByTestId('more-2026-11-09')

  it('shows the first three entries and a “+N” for the rest', () => {
    setup('#/calendar', crowded())
    expect(titles('2026-11-09')).toEqual(['甲', '乙', '丙'])
    expect(moreButton()).toHaveTextContent('+1')
    expect(moreButton()).toHaveAccessibleName(expect.stringContaining('全部 4 项'))
  })

  it('has no “+N” and no scrolling list when everything fits', () => {
    setup('#/calendar', { ...crowded(), todos: crowded().todos.slice(0, 3) })
    expect(titles('2026-11-09')).toEqual(['甲', '乙', '丙'])
    expect(screen.queryByTestId('more-2026-11-09')).not.toBeInTheDocument()
    expect(within(cell('2026-11-09')).getByTestId('entries-2026-11-09')).not.toHaveClass(
      'overflow-y-auto',
    )
  })

  it('opens a day view with every entry, milestones first', async () => {
    const user = setup(
      '#/calendar',
      crowded(
        [],
        [{ id: 'mm', laneId: 'l1', name: '节点mm', date: '2026-11-09', done: false, note: '' }],
      ),
    )
    await user.click(moreButton())
    const dialog = screen.getByRole('dialog', { name: /11月9日/ })
    expect(dialog).toHaveTextContent('4 个待办 · 1 个节点')
    expect(focusTitles()).toEqual(['节点mm', '甲', '乙', '丙', '丁'])
    // 同一批条目只画一份：这一格里不再重复
    expect(titles('2026-11-09')).toEqual([])
  })

  it('puts finished todos after the unfinished ones in the day view', async () => {
    const user = setup('#/calendar', {
      ...crowded(),
      todos: crowded().todos.map((todo) => (todo.id === 'a' ? { ...todo, done: true } : todo)),
    })
    await user.click(moreButton())
    expect(focusTitles()).toEqual(['乙', '丙', '丁', '甲'])
  })

  it('closes with Esc, the close button, or a click on the backdrop, and returns focus to “+N”', async () => {
    const user = setup('#/calendar', crowded())
    for (const close of [
      () => user.keyboard('{Escape}'),
      () => user.click(screen.getByRole('button', { name: '关闭' })),
      () => user.click(document.querySelector('.day-focus-backdrop')!),
    ]) {
      await user.click(moreButton())
      expect(screen.getByTestId('day-focus')).toBeInTheDocument()
      await close()
      expect(screen.queryByTestId('day-focus')).not.toBeInTheDocument()
      expect(moreButton()).toHaveFocus()
    }
  })

  it('edits an entry from the day view and stays in it; Esc closes only the editor', async () => {
    const user = setup('#/calendar', crowded())
    await user.click(moreButton())
    await user.click(screen.getByTestId('todo-d'))
    const editor = await screen.findByRole('dialog', { name: '编辑待办' })
    expect(within(editor).getByLabelText('标题')).toHaveValue('丁')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument()
    expect(screen.getByTestId('day-focus')).toBeInTheDocument()
  })

  it('a click on the backdrop while the editor is open closes only the editor', async () => {
    const user = setup('#/calendar', crowded())
    await user.click(moreButton())
    await user.click(screen.getByTestId('todo-d'))
    await screen.findByRole('dialog', { name: '编辑待办' })
    await user.click(document.querySelector('.day-focus-backdrop')!)
    expect(screen.queryByRole('dialog', { name: '编辑待办' })).not.toBeInTheDocument()
    expect(screen.getByTestId('day-focus')).toBeInTheDocument()
  })

  it('ticks a todo and adds a new one on that day from inside the view', async () => {
    const user = setup('#/calendar', crowded())
    await user.click(moreButton())
    await user.click(
      within(screen.getByTestId('day-focus')).getByRole('checkbox', { name: '完成「甲」' }),
    )
    expect(s().data.todos.find((todo) => todo.id === 'a')?.done).toBe(true)
    await user.click(screen.getByRole('button', { name: '添加待办' }))
    expect(
      s().data.todos.some((todo) => todo.title === '新待办' && todo.date === '2026-11-09'),
    ).toBe(true)
  })

  it('keeps a newly created todo visible on a full day while it is being edited', async () => {
    const user = setup('#/calendar', crowded())
    cell('2026-11-09').focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog', { name: '编辑待办' })
    // 新待办不挂板块，排在最后；正在编辑，所以必须显示出来，面板才有地方贴
    const mine = s().data.todos.find((todo) => todo.title === '新待办')!
    expect(within(cell('2026-11-09')).getByTestId(`todo-${mine.id}`)).toBeInTheDocument()
    expect(titles('2026-11-09')).toHaveLength(3)
    expect(moreButton()).toHaveTextContent('+2')
  })

  it('opens the editor for the last entry of a crowded day through the day view', async () => {
    const user = setup('#/calendar', crowded())
    await user.click(moreButton())
    await user.click(screen.getByTestId('todo-d'))
    const dialog = await screen.findByRole('dialog', { name: '编辑待办' })
    expect(within(dialog).getByLabelText('标题')).toHaveValue('丁')
  })
})
