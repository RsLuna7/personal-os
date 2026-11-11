import { useState, useSyncExternalStore } from 'react'
import { Toaster } from '@/components/ui/sonner'
import type { Persistence } from '@/data/persistence'
import { setTermsOpen, useEditorStore } from '@/features/editor/editorStore'
import { TermsDialog } from '@/features/editor/TermsDialog'
import { Home } from '@/features/home/Home'
import { Timeline } from '@/features/timeline/Timeline'
import { DataErrorScreen } from './DataErrorScreen'
import { PlaceholderPage } from './PlaceholderPage'
import { TopBar } from './TopBar'
import { useHashRoute } from './useHashRoute'

interface AppProps {
  /** 本地存储的状态；测试里可以不传 */
  persistence?: Persistence
}

const noSubscription = () => () => {}
const noSaveError = () => null

export function App({ persistence }: AppProps) {
  const [route, setRoute] = useHashRoute()
  const termsOpen = useEditorStore((state) => state.termsOpen)
  const [corruptRaw, setCorruptRaw] = useState<string | null>(() =>
    persistence?.status.status === 'corrupt' ? persistence.status.raw : null,
  )
  const saveError = useSyncExternalStore(
    persistence?.subscribe ?? noSubscription,
    persistence?.saveError ?? noSaveError,
  )

  if (corruptRaw !== null && persistence) {
    return (
      <DataErrorScreen
        raw={corruptRaw}
        onRecover={(data) => {
          persistence.recover(data)
          setCorruptRaw(null)
        }}
      />
    )
  }

  return (
    <div className="flex h-full min-w-[1024px] flex-col bg-(--bg-page) text-(--text)">
      {saveError && (
        <div
          role="alert"
          className="shrink-0 border-b border-(--border) bg-(--bg-panel) px-6 py-2 text-[14px] text-(--danger)"
        >
          浏览器存储不可用或已满，修改可能无法保存。请立即导出备份。
        </div>
      )}
      <TopBar route={route} onNavigate={setRoute} />
      <main className="flex min-h-0 flex-1 flex-col">
        {route === 'home' ? <Home /> : route === 'timeline' ? <Timeline /> : <PlaceholderPage />}
      </main>
      <TermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <Toaster position="bottom-center" />
    </div>
  )
}
