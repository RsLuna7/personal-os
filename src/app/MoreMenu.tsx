import { useRef } from 'react'
import { EllipsisIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  downloadText,
  exportFileName,
  IMPORT_ERROR_TEXT,
  needsBackupReminder,
  serialize,
} from '@/data/backup'
import { countIcsEvents, buildIcs, icsFileName } from '@/data/ics'
import { getStorage, loadUiPrefs } from '@/data/persistence'
import { createShowcaseData } from '@/data/showcase'
import { createEmptyData } from '@/data/schema'
import { useStore } from '@/data/store'
import { showUndoToast } from '@/features/editor/deleteToast'
import { setTemplateOpen, setTermsOpen } from '@/features/editor/editorStore'
import { todayISO } from '@/features/timeline/days'
import { readBackupFile } from './importFile'

function exportBackup(): void {
  const store = useStore.getState()
  downloadText(exportFileName(todayISO()), serialize(store.data))
  store.markExported(new Date().toISOString())
}

/** 导出日历文件。不算备份，不更新“上次导出”时间。 */
function exportCalendar(): void {
  const { data } = useStore.getState()
  downloadText(icsFileName(todayISO()), buildIcs(data, new Date()), 'text/calendar;charset=utf-8')
  toast.success(`已导出日历，共 ${countIcsEvents(data)} 项`)
}

async function importBackup(file: File): Promise<void> {
  const result = await readBackupFile(file)
  if (!result.ok) {
    toast.error(IMPORT_ERROR_TEXT[result.reason])
    return
  }
  useStore.getState().replaceData(result.data)
  showUndoToast('已导入备份')
}

function loadSample(): void {
  useStore.getState().replaceData(createShowcaseData(todayISO()))
  showUndoToast('已载入示例')
}

function clearAll(): void {
  useStore.getState().replaceData(createEmptyData())
  showUndoToast('已清空数据')
}

/** 顶栏右侧的“⋯”菜单：备份、日历导出、模板、学期、示例、清空。 */
export function MoreMenu() {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const hasData = useStore((state) => state.data.lanes.length > 0)
  const lastExportAt = useStore((state) => state.data.lastExportAt)
  const overdue =
    hasData &&
    needsBackupReminder(
      lastExportAt,
      loadUiPrefs(getStorage(window), new Date()).firstUsedAt,
      new Date(),
    )

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label={overdue ? '更多，建议导出备份' : '更多'}
          >
            <EllipsisIcon aria-hidden />
            {overdue && (
              <span
                data-testid="backup-dot"
                className="absolute top-0.5 right-0.5 size-1.5 rounded-full bg-(--today)"
              />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={exportBackup}>导出备份</DropdownMenuItem>
          <DropdownMenuItem onSelect={exportCalendar}>导出日历 (.ics)</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>导入备份</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setTemplateOpen(true)}>从模板添加</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTermsOpen(true)}>编辑学期</DropdownMenuItem>
          <DropdownMenuItem onSelect={loadSample}>载入示例</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={clearAll}>
            清空数据
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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
    </>
  )
}
