import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { downloadText, serialize } from '@/data/backup'
import { DATA_KEY, startPersistence, UI_KEY, type Persistence } from '@/data/persistence'
import { createSampleData } from '@/data/sample'
import { createEmptyData, type AppData } from '@/data/schema'
import { useStore } from '@/data/store'
import { resetEditor } from '@/features/editor/editorStore'
import { resetViewport } from '@/features/timeline/useViewport'
import { memStorage } from '@/test/memStorage'
import { App } from './App'

vi.mock('@/data/backup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/backup')>()),
  downloadText: vi.fn(),
}))

const s = () => useStore.getState()
const sample = createSampleData('2026-11-10')
const mine: AppData = {
  ...createEmptyData(),
  lanes: [{ id: 'l1', name: '考研', color: 'iris', order: 0, note: '', links: [] }],
}
const jsonFile = (text: string) => new File([text], 'backup.json', { type: 'application/json' })

let persistence: Persistence | undefined

function setup(initial: AppData = mine) {
  s().hydrate(initial)
  render(<App />)
  return userEvent.setup()
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^更多/ }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0))
  vi.mocked(downloadText).mockClear()
  localStorage.clear()
  window.location.hash = ''
  resetViewport()
  resetEditor()
})
afterEach(() => {
  persistence?.stop()
  persistence = undefined
  vi.useRealTimers()
})

it('lists the menu items in order', async () => {
  const user = setup()
  await openMenu(user)
  expect((await screen.findAllByRole('menuitem')).map((item) => item.textContent)).toEqual([
    '导出备份',
    '导出日历 (.ics)',
    '导入备份',
    '从模板添加',
    '编辑学期',
    '载入示例',
    '清空数据',
  ])
})

it('exports the current data and records the export time', async () => {
  const user = setup()
  await openMenu(user)
  await user.click(await screen.findByRole('menuitem', { name: '导出备份' }))
  expect(downloadText).toHaveBeenCalledWith('personal-os-2026-11-10.json', serialize(mine))
  expect(s().data.lastExportAt).toBe(new Date(2026, 10, 10, 12, 0).toISOString())
})

it('exports an .ics calendar without touching the backup time', async () => {
  const user = setup({
    ...mine,
    milestones: [
      { id: 'm1', laneId: 'l1', name: '初试', date: '2026-12-19', done: false, note: '' },
    ],
  })
  await openMenu(user)
  await user.click(await screen.findByRole('menuitem', { name: '导出日历 (.ics)' }))
  expect(downloadText).toHaveBeenCalledTimes(1)
  const [name, text, type] = vi.mocked(downloadText).mock.calls[0]
  expect(name).toBe('personal-os-2026-11-10.ics')
  expect(type).toBe('text/calendar;charset=utf-8')
  expect(text).toContain('BEGIN:VCALENDAR\r\n')
  expect(text).toContain('SUMMARY:初试')
  expect(await screen.findByText('已导出日历，共 1 项')).toBeInTheDocument()
  expect(s().data.lastExportAt).toBeNull()
})

it('imports a valid file, replaces the data and offers undo', async () => {
  const user = setup()
  await user.upload(screen.getByTestId('import-input'), jsonFile(serialize(sample)))
  expect(await screen.findByText('已导入备份')).toBeInTheDocument()
  expect(s().data).toEqual(sample)
  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(s().data).toEqual(mine)
})

it('shows the reason and keeps the data when the import is invalid', async () => {
  const user = setup()
  await user.upload(screen.getByTestId('import-input'), jsonFile('hello'))
  expect(await screen.findByText('这不是有效的备份文件。')).toBeInTheDocument()
  expect(s().data).toEqual(mine)
})

it('opens the terms dialog from the menu', async () => {
  const user = setup()
  await openMenu(user)
  await user.click(await screen.findByRole('menuitem', { name: '编辑学期' }))
  expect(await screen.findByRole('dialog', { name: '编辑学期' })).toBeInTheDocument()
})

it('shows a dot on the menu button when a backup is overdue', () => {
  localStorage.setItem(
    UI_KEY,
    JSON.stringify({ zoomPreset: 'year', pxPerDay: null, firstUsedAt: '2026-10-01T00:00:00.000Z' }),
  )
  setup()
  const button = screen.getByRole('button', { name: '更多，建议导出备份' })
  expect(button.querySelector('[data-testid="backup-dot"]')).toBeInTheDocument()
})

it('shows no dot when a backup is recent', () => {
  localStorage.setItem(
    UI_KEY,
    JSON.stringify({ zoomPreset: 'year', pxPerDay: null, firstUsedAt: '2026-10-01T00:00:00.000Z' }),
  )
  setup({ ...mine, lastExportAt: '2026-11-01T00:00:00.000Z' })
  expect(screen.getByRole('button', { name: '更多' })).toBeInTheDocument()
  expect(screen.queryByTestId('backup-dot')).not.toBeInTheDocument()
})

it('loads the sample with undo available', async () => {
  const user = setup()
  await openMenu(user)
  await user.click(await screen.findByRole('menuitem', { name: '载入示例' }))
  expect(s().data.lanes.length).toBeGreaterThanOrEqual(3)
  expect(await screen.findByText('已载入示例')).toBeInTheDocument()
})

it('clears all data with undo available', async () => {
  const user = setup()
  await openMenu(user)
  await user.click(await screen.findByRole('menuitem', { name: '清空数据' }))
  expect(s().data.lanes).toEqual([])
  expect(await screen.findByText('已清空数据')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '撤销' }))
  expect(s().data).toEqual(mine)
})

it('shows the error screen instead of the app when stored data is corrupt', async () => {
  const storage = memStorage({ [DATA_KEY]: '{oops' })
  persistence = startPersistence(storage, window)
  render(<App persistence={persistence} />)
  expect(screen.getByRole('heading', { name: '数据读取失败' })).toBeInTheDocument()
  expect(
    screen.getByText(
      '浏览器里保存的数据无法读取。原数据没有被改动，可以先下载下来，再从备份恢复。',
    ),
  ).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '全局' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '导入备份' })).toBeInTheDocument()

  await userEvent.setup().click(screen.getByRole('button', { name: '下载原始数据' }))
  expect(downloadText).toHaveBeenCalledWith('personal-os-corrupt-2026-11-10.txt', '{oops')
  expect(storage.getItem(DATA_KEY)).toBe('{oops')
})

it('recovers from the error screen by importing a backup', async () => {
  const storage = memStorage({ [DATA_KEY]: '{oops' })
  persistence = startPersistence(storage, window)
  render(<App persistence={persistence} />)
  const user = userEvent.setup()

  await user.upload(screen.getByTestId('import-input'), jsonFile('hello'))
  expect(await screen.findByRole('alert')).toHaveTextContent('这不是有效的备份文件。')
  expect(storage.getItem(DATA_KEY)).toBe('{oops')

  await user.upload(screen.getByTestId('import-input'), jsonFile(serialize(sample)))
  expect(await screen.findByRole('link', { name: '全局' })).toBeInTheDocument()
  expect(s().data).toEqual(sample)
  expect(JSON.parse(storage.getItem(DATA_KEY)!)).toEqual(sample)

  act(() => void s().addLane('恢复之后'))
  await waitFor(
    () =>
      expect(JSON.parse(storage.getItem(DATA_KEY)!).lanes).toHaveLength(sample.lanes.length + 1),
    { timeout: 2000 },
  )
})

it('shows a warning banner when saving fails', async () => {
  const storage: Storage = {
    ...memStorage(),
    setItem: () => {
      throw new DOMException('full', 'QuotaExceededError')
    },
  }
  persistence = startPersistence(storage, window)
  render(<App persistence={persistence} />)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  act(() => void s().addLane())
  expect(
    await screen.findByText(
      '浏览器存储不可用或已满，修改可能无法保存。请立即导出备份。',
      {},
      { timeout: 2000 },
    ),
  ).toBeInTheDocument()
})
