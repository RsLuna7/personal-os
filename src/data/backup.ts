import { migrations, NewerVersionError, runMigrations } from './migrations'
import { appDataSchema, CURRENT_SCHEMA_VERSION, type AppData, type ISODate } from './schema'

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const REMINDER_DAYS = 30

export function exportFileName(day: ISODate): string {
  return `personal-os-${day}.json`
}

export function serialize(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export type ImportResult =
  | { ok: true; data: AppData }
  | { ok: false; reason: 'too-large' | 'not-json' | 'invalid-shape' | 'newer-version' }

export type ImportErrorReason = Exclude<ImportResult, { ok: true }>['reason']

export const IMPORT_ERROR_TEXT: Record<ImportErrorReason, string> = {
  'too-large': '文件超过 5 MB，无法导入。',
  'not-json': '这不是有效的备份文件。',
  'invalid-shape': '备份文件内容不完整或已损坏，现有数据未改动。',
  'newer-version': '这个备份来自更新的版本。刷新页面后再试。',
}

/** 校验备份文件内容。只要有一处不对就整体拒绝。 */
export function parseImport(text: string): ImportResult {
  if (text.length > IMPORT_MAX_BYTES || new Blob([text]).size > IMPORT_MAX_BYTES) {
    return { ok: false, reason: 'too-large' }
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'not-json' }
  }

  let migrated: unknown
  try {
    migrated = runMigrations(json, migrations, CURRENT_SCHEMA_VERSION).data
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof NewerVersionError ? 'newer-version' : 'invalid-shape',
    }
  }

  const parsed = appDataSchema.safeParse(migrated)
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, reason: 'invalid-shape' }
}

/** 距上次导出（从未导出则从第一次使用起）超过 30 天。 */
export function needsBackupReminder(
  lastExportAt: string | null,
  firstUsedAt: string,
  now: Date,
): boolean {
  const since = Date.parse(lastExportAt ?? firstUsedAt)
  if (Number.isNaN(since)) return false
  return now.getTime() - since > REMINDER_DAYS * 86_400_000
}

export function downloadText(
  filename: string,
  text: string,
  type = 'text/plain;charset=utf-8',
): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
