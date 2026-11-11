import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createEmptyData, NOTE_MAX, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { NoteCard } from './NoteCard'

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

it('shows the saved note and the character count', () => {
  setup()
  expect(box()).toHaveValue('旧备注')
  expect(screen.getByText(`3 / ${NOTE_MAX}`)).toBeInTheDocument()
})

it('shows a hint when the note is empty', () => {
  s().hydrate({ ...data, lanes: [{ ...data.lanes[0]!, note: '' }] })
  render(<Connected />)
  expect(box()).toHaveAttribute('placeholder', '写点什么：目标、注意事项……')
})

it('saves on blur and counts the characters as you type', async () => {
  const user = setup()
  await user.clear(box())
  await user.type(box(), '新备注内容')
  expect(screen.getByText(`5 / ${NOTE_MAX}`)).toBeInTheDocument()
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
