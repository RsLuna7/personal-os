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
  ['newer-version', JSON.stringify({ ...sample, schemaVersion: 2 })],
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
