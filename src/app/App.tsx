import { Toaster } from '@/components/ui/sonner'
import type { Persistence } from '@/data/persistence'
import { Timeline } from '@/features/timeline/Timeline'
import { PlaceholderPage } from './PlaceholderPage'
import { TopBar } from './TopBar'
import { useHashRoute } from './useHashRoute'

interface AppProps {
  /** 测试里可以不传；Task 11 用它显示出错界面 */
  persistence?: Persistence
}

export function App(_props: AppProps) {
  const [route, setRoute] = useHashRoute()

  return (
    <div className="flex h-full min-w-[1024px] flex-col bg-(--bg-page) text-(--text)">
      <TopBar route={route} onNavigate={setRoute} />
      <main className="flex min-h-0 flex-1 flex-col">
        {route === 'timeline' ? <Timeline /> : <PlaceholderPage />}
      </main>
      <Toaster position="bottom-center" />
    </div>
  )
}
