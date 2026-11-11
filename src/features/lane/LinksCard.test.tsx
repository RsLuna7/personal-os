import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Toaster } from '@/components/ui/sonner'
import { createEmptyData, LINKS_MAX, NAME_MAX, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { LinksCard } from './LinksCard'

const s = () => useStore.getState()
const links = () => s().data.lanes[0]!.links

const data: AppData = {
  ...createEmptyData(),
  lanes: [
    {
      id: 'l1',
      name: '考研',
      color: 'iris',
      order: 0,
      note: '',
      links: [{ id: 'k1', title: '真题库', url: 'https://example.org/papers' }],
    },
    { id: 'l2', name: '实习', color: 'teal', order: 1, note: '', links: [] },
  ],
}

// 和板块页一样，从 store 里取最新的板块，并用 key 区分板块
function Connected({ laneId = 'l1' }: { laneId?: string }) {
  const lane = useStore((state) => state.data.lanes.find((item) => item.id === laneId)!)
  return <LinksCard key={lane.id} lane={lane} />
}

function setup(initial: AppData = data, laneId = 'l1') {
  s().hydrate(initial)
  const user = userEvent.setup()
  const view = render(
    <>
      <Connected laneId={laneId} />
      <Toaster />
    </>,
  )
  return { user, ...view }
}

const openAdd = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '添加链接' }))
const titleBox = () => screen.getByRole('textbox', { name: '标题' })
const urlBox = () => screen.getByRole('textbox', { name: '网址' })

it('lists a link with its title and host, opening in a new tab safely', () => {
  setup()
  const link = screen.getByRole('link', { name: /真题库/ })
  expect(link).toHaveAttribute('href', 'https://example.org/papers')
  expect(link).toHaveAttribute('target', '_blank')
  expect(link.getAttribute('rel')).toContain('noopener')
  expect(link.getAttribute('rel')).toContain('noreferrer')
  expect(link).toHaveTextContent('example.org')
})

it('adds a link and fills in the missing protocol', async () => {
  const { user } = setup()
  await openAdd(user)
  await user.type(titleBox(), '官网')
  await user.type(urlBox(), 'example.com/a')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(links().map((link) => link.title)).toEqual(['真题库', '官网'])
  const added = screen.getByRole('link', { name: /官网/ })
  expect(added).toHaveAttribute('href', 'https://example.com/a')
  expect(added).toHaveAttribute('target', '_blank')
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument()
})

it('submits with Enter and cancels with Escape', async () => {
  const { user } = setup()
  await openAdd(user)
  await user.type(titleBox(), '官网')
  await user.type(urlBox(), 'example.com{Enter}')
  expect(links()).toHaveLength(2)

  await openAdd(user)
  await user.type(titleBox(), '不要')
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument()
  expect(links()).toHaveLength(2)
})

it('refuses a javascript: address and keeps the data untouched', async () => {
  const { user } = setup()
  const before = s().data
  await openAdd(user)
  await user.type(titleBox(), '坏链接')
  await user.type(urlBox(), 'javascript:alert(1)')
  await user.click(screen.getByRole('button', { name: '保存' }))
  expect(screen.getByText('请输入以 http 或 https 开头的网址')).toBeInTheDocument()
  expect(s().data).toBe(before)
  expect(titleBox()).toHaveValue('坏链接')
})

it('asks for a title when it is blank', async () => {
  const { user } = setup()
  const before = s().data
  await openAdd(user)
  await user.type(titleBox(), '   ')
  await user.type(urlBox(), 'example.com')
  await user.click(screen.getByRole('button', { name: '保存' }))
  expect(screen.getByText('请填写标题')).toBeInTheDocument()
  expect(s().data).toBe(before)
})

it('limits the title input to the name length', async () => {
  const { user } = setup()
  await openAdd(user)
  expect(titleBox()).toHaveAttribute('maxLength', String(NAME_MAX))
})

it('edits a link in place and saves the new values', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '修改「真题库」' }))
  expect(titleBox()).toHaveValue('真题库')
  expect(urlBox()).toHaveValue('https://example.org/papers')
  await user.clear(titleBox())
  await user.type(titleBox(), '历年真题')
  await user.clear(urlBox())
  await user.type(urlBox(), 'example.net/x')
  await user.click(screen.getByRole('button', { name: '保存' }))

  expect(links()).toEqual([{ id: 'k1', title: '历年真题', url: 'https://example.net/x' }])
  expect(screen.getByRole('link', { name: /历年真题/ })).toHaveAttribute(
    'href',
    'https://example.net/x',
  )
})

it('leaves the link alone when the edit is cancelled with Escape', async () => {
  const { user } = setup()
  const before = s().data
  await user.click(screen.getByRole('button', { name: '修改「真题库」' }))
  await user.type(titleBox(), '改了')
  await user.keyboard('{Escape}')
  expect(s().data).toBe(before)
  expect(screen.getByRole('link', { name: /真题库/ })).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument()
})

it('deletes a link, offers undo and brings it back', async () => {
  const { user } = setup()
  await user.click(screen.getByRole('button', { name: '删除「真题库」' }))
  expect(links()).toEqual([])
  expect(screen.queryByRole('link', { name: /真题库/ })).not.toBeInTheDocument()
  expect(await screen.findByText('已删除「真题库」')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(links().map((link) => link.id)).toEqual(['k1'])
  expect(screen.getByRole('link', { name: /真题库/ })).toBeInTheDocument()
})

it('shows an empty state when there are no links', () => {
  setup(data, 'l2')
  expect(screen.getByText('还没有资料链接')).toBeInTheDocument()
})

it('hides the add button once the limit is reached', () => {
  const full: AppData = {
    ...data,
    lanes: [
      {
        ...data.lanes[0]!,
        links: Array.from({ length: LINKS_MAX }, (_, i) => ({
          id: `k${i}`,
          title: `链接${i}`,
          url: `https://example.com/${i}`,
        })),
      },
    ],
  }
  setup(full)
  expect(screen.queryByRole('button', { name: '添加链接' })).not.toBeInTheDocument()
  expect(screen.getByText(`最多 ${LINKS_MAX} 条`)).toBeInTheDocument()
})

it('does not carry an open form over to another lane', async () => {
  const { user, rerender } = setup()
  await openAdd(user)
  await user.type(titleBox(), '半截')
  rerender(
    <>
      <Connected laneId="l2" />
      <Toaster />
    </>,
  )
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument()
  expect(within(document.body).getByText('还没有资料链接')).toBeInTheDocument()
})
