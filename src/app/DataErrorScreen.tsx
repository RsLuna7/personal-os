import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { downloadText, IMPORT_ERROR_TEXT } from '@/data/backup'
import type { AppData } from '@/data/schema'
import { todayISO } from '@/features/timeline/days'
import { readBackupFile } from './importFile'

interface DataErrorScreenProps {
  /** 浏览器里存着的原始内容，原样提供下载 */
  raw: string
  onRecover: (data: AppData) => void
}

/** 本地数据读不出来时显示。不覆盖、不清空，只提供下载原始数据和从备份恢复。 */
export function DataErrorScreen({ raw, onRecover }: DataErrorScreenProps) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  const importBackup = async (file: File) => {
    const result = await readBackupFile(file)
    if (!result.ok) {
      setError(IMPORT_ERROR_TEXT[result.reason])
      return
    }
    onRecover(result.data)
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-(--bg-page) p-8 text-center text-(--text)">
      <h1 className="text-[20px] font-medium">数据读取失败</h1>
      <p className="max-w-md text-[14px] text-(--text-muted)">
        浏览器里保存的数据无法读取。原数据没有被改动，可以先下载下来，再从备份恢复。
      </p>
      <div className="mt-4 flex gap-2">
        <Button
          variant="outline"
          onClick={() => downloadText(`personal-os-corrupt-${todayISO()}.txt`, raw)}
        >
          下载原始数据
        </Button>
        <Button onClick={() => fileInput.current?.click()}>导入备份</Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[14px] text-(--danger)">
          {error}
        </p>
      )}
      <input
        ref={fileInput}
        data-testid="import-input"
        type="file"
        accept=".json,application/json"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importBackup(file)
        }}
      />
    </div>
  )
}
