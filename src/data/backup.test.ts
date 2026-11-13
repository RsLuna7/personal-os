import {
  exportFileName,
  IMPORT_ERROR_TEXT,
  needsBackupReminder,
  parseImport,
  serialize,
} from './backup'
import { createSampleData } from './sample'

const sample = createSampleData('2026-11-10')

it('names the file by date', () =>
  expect(exportFileName('2026-11-10')).toBe('personal-os-2026-11-10.json'))

it('round-trips', () => expect(parseImport(serialize(sample))).toEqual({ ok: true, data: sample }))

it('serializes with two-space indentation', () =>
  expect(serialize(sample)).toBe(JSON.stringify(sample, null, 2)))

it.each([
  ['not-json', 'hello'],
  ['invalid-shape', JSON.stringify({ schemaVersion: 1, lanes: 'x' })],
  ['invalid-shape', JSON.stringify({ lanes: [] })],
  ['invalid-shape', JSON.stringify(null)],
  [
    'invalid-shape',
    JSON.stringify({ ...sample, phases: [{ ...sample.phases[0], laneId: 'missing' }] }),
  ],
  ['invalid-shape', JSON.stringify({ ...sample, phases: [sample.phases[0], sample.phases[0]] })],
  [
    'invalid-shape',
    JSON.stringify({
      ...sample,
      phases: [{ ...sample.phases[0], end: sample.phases[0].start }],
    }),
  ],
  ['newer-version', JSON.stringify({ ...sample, schemaVersion: 6 })],
  [
    'invalid-shape',
    JSON.stringify({ ...sample, todos: [{ ...sample.todos[0], laneId: 'missing' }] }),
  ],
  [
    'invalid-shape',
    JSON.stringify({
      ...sample,
      lanes: [
        {
          ...sample.lanes[0],
          links: [{ id: 'bad', title: '坏链接', url: 'javascript:alert(1)' }],
        },
        ...sample.lanes.slice(1),
      ],
    }),
  ],
  ['too-large', 'x'.repeat(5 * 1024 * 1024 + 1)],
])('rejects with %s', (reason, text) => expect(parseImport(text)).toEqual({ ok: false, reason }))

it('has a message for every rejection reason', () =>
  expect(IMPORT_ERROR_TEXT).toEqual({
    'too-large': '文件超过 5 MB，无法导入。',
    'not-json': '这不是有效的备份文件。',
    'invalid-shape': '备份文件内容不完整或已损坏，现有数据未改动。',
    'newer-version': '这个备份来自更新的版本。刷新页面后再试。',
  }))

it('reminds after 30 days without an export', () => {
  const now = new Date('2026-12-15T00:00:00Z')
  expect(needsBackupReminder(null, '2026-11-10T00:00:00Z', now)).toBe(true)
  expect(needsBackupReminder('2026-12-01T00:00:00Z', '2026-11-10T00:00:00Z', now)).toBe(false)
  expect(needsBackupReminder(null, '2026-12-01T00:00:00Z', now)).toBe(false)
})

it('round-trips todos', () => {
  const result = parseImport(serialize(sample))
  expect(sample.todos.length).toBeGreaterThan(0)
  expect(result.ok && result.data.todos).toEqual(sample.todos)
})

it('upgrades a version 2 backup on import: no todos', () => {
  const result = parseImport(
    JSON.stringify({
      ...sample,
      todos: undefined, // 旧版本没有待办（JSON 里整个字段不存在）
      schemaVersion: 2,
    }),
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.schemaVersion).toBe(5)
  expect(result.data.todos).toEqual([])
  expect(result.data.phases).toEqual(sample.phases)
})

it('upgrades a version 1 backup on import', () => {
  const v1 = {
    ...sample,
    todos: undefined, // 旧版本没有待办（JSON 里整个字段不存在）

    schemaVersion: 1,
    lanes: sample.lanes.map(({ note: _note, links: _links, ...lane }) => lane),
  }
  const result = parseImport(JSON.stringify(v1))
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data.schemaVersion).toBe(5)
  expect(result.data.todos).toEqual([])
  expect(result.data.lanes.every((lane) => lane.note === '' && lane.links.length === 0)).toBe(true)
  expect(result.data.phases).toEqual(sample.phases)
})

it('upgrades a version 3 backup on import: phases and milestones are not done', () => {
  const stripDone = <T extends { done: boolean }>({ done: _done, ...rest }: T) => rest
  const result = parseImport(
    JSON.stringify({
      ...sample,
      schemaVersion: 3,
      phases: sample.phases.map(stripDone),
      milestones: sample.milestones.map(stripDone),
    }),
  )
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.data).toEqual(sample)
})

it('round-trips done phases and milestones', () => {
  const data = {
    ...sample,
    phases: sample.phases.map((phase, index) => ({ ...phase, done: index === 0 })),
    milestones: sample.milestones.map((milestone) => ({ ...milestone, done: true })),
  }
  const result = parseImport(serialize(data))
  expect(result.ok && result.data).toEqual(data)
})

it('imports a version 4 file with no habits', () => {
  // JSON.stringify 会丢掉值为 undefined 的字段：等于一份没有 habits 的第 4 版文件
  const result = parseImport(JSON.stringify({ ...sample, schemaVersion: 4, habits: undefined }))
  expect(result).toEqual({ ok: true, data: { ...sample, habits: [] } })
})
