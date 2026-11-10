import { IMPORT_MAX_BYTES, parseImport, type ImportResult } from '@/data/backup'

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

/** 读取并校验使用者选择的备份文件。太大的文件不读内容直接拒绝。 */
export async function readBackupFile(file: File): Promise<ImportResult> {
  if (file.size > IMPORT_MAX_BYTES) return { ok: false, reason: 'too-large' }
  try {
    return parseImport(await readText(file))
  } catch {
    return { ok: false, reason: 'not-json' }
  }
}
