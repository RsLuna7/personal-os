import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData, NOTE_MAX, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { NOTE_WARN_AT, NoteCard } from './NoteCard'

const s = () => useStore.getState()
const note = () => s().data.lanes[0]!.note

const data: AppData = {
  ...createEmptyData(),
  lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '旧备注', links: [] }],
}

// 和板块页一样，从 store 里取最新的板块
function Connected() {
  const lane = useStore((state) => state.data.lanes[0]!)
  return <NoteCard lane={lane} />
}

function setup() {
  s().hydrate(data)
  const user = userEvent.setup()
  render(<Connected />)
  return user
}

// 用 fireEvent 一次性塞进长文本，userEvent 逐字敲 2000 字太慢
const box = () => screen.getByRole('textbox', { name: '板块备注' })
const type = (value: string) => fireEvent.change(box(), { target: { value } })

it('shows the saved note without a character count far from the limit', () => {
  setup()
  expect(box()).toHaveValue('旧备注')
  expect(screen.queryByText(`3 / ${NOTE_MAX}`)).not.toBeInTheDocument()
})

it('shows the character count once the note nears the limit', () => {
  setup()
  type('字'.repeat(NOTE_WARN_AT))
  expect(screen.getByText(`${NOTE_WARN_AT} / ${NOTE_MAX}`)).toBeInTheDocument()
})

it('shows a hint when the note is empty', () => {
  s().hydrate({ ...data, lanes: [{ ...data.lanes[0]!, note: '' }] })
  render(<Connected />)
  expect(box()).toHaveAttribute('placeholder', '写点什么：目标、注意事项……')
})

it('saves on blur', async () => {
  const user = setup()
  await user.clear(box())
  await user.type(box(), '新备注内容')
  expect(note()).toBe('旧备注')
  await user.tab()
  expect(note()).toBe('新备注内容')
})

it('does not create an undo step when nothing changed', async () => {
  const user = setup()
  const before = s().data
  await user.click(box())
  await user.tab()
  expect(s().data).toBe(before)
})

it('restores the old note in the box after undo', async () => {
  const user = setup()
  await user.clear(box())
  await user.type(box(), '改过')
  await user.tab()
  expect(note()).toBe('改过')
  act(() => s().undo())
  expect(note()).toBe('旧备注')
  expect(box()).toHaveValue('旧备注')
})

it('keeps an over-long note in the box, warns and refuses to save it', async () => {
  const user = setup()
  const tooLong = 'a'.repeat(NOTE_MAX + 1)
  const before = s().data
  type(tooLong)
  await user.tab()
  expect(s().data).toBe(before)
  expect(note()).toBe('旧备注')
  expect(box()).toHaveValue(tooLong)
  expect(screen.getByText('超出 1 字，缩短后才能保存')).toBeInTheDocument()
})

it('saves once the note is shortened back to the limit', async () => {
  const user = setup()
  type('a'.repeat(NOTE_MAX + 1))
  await user.tab()
  type('a'.repeat(NOTE_MAX))
  expect(screen.queryByText(/超出/)).not.toBeInTheDocument()
  await user.click(box())
  await user.tab()
  expect(note()).toBe('a'.repeat(NOTE_MAX))
})

it('saves a pending draft when the page is hidden or closed without a blur', () => {
  setup()
  type('刷新前写的')
  expect(note()).toBe('旧备注')
  act(() => {
    window.dispatchEvent(new Event('pagehide'))
  })
  expect(note()).toBe('刷新前写的')
})

it('saves a pending draft when the card goes away without a blur', () => {
  s().hydrate(data)
  const { unmount } = render(<Connected />)
  type('切走前写的')
  unmount()
  expect(note()).toBe('切走前写的')
})

it('does not write anything when the card goes away because its lane was deleted', () => {
  s().hydrate(data)
  function Gone() {
    const lane = useStore((state) => state.data.lanes[0])
    return lane ? <NoteCard lane={lane} /> : null
  }
  render(<Gone />)
  type('没人要了')
  let writes = 0
  const stop = useStore.subscribe(() => writes++)
  act(() => s().removeLane('l1'))
  stop()
  // 只有删除板块这一次写入，卸载时的保存不能再写一次
  expect(writes).toBe(1)
  expect(s().data.lanes).toEqual([])
})

it('grows with the note, from two lines up to twelve', () => {
  setup()
  expect(box()).toHaveAttribute('rows', '2')
  type('一\n二\n三')
  expect(box()).toHaveAttribute('rows', '3')
  type(Array.from({ length: 20 }, (_, i) => `第${i}行`).join('\n'))
  expect(box()).toHaveAttribute('rows', '12')
})
