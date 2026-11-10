import { PlaceholderPage } from './PlaceholderPage'
import { TopBar } from './TopBar'
import { useHashRoute } from './useHashRoute'

export function App() {
  const [route, setRoute] = useHashRoute()

  return (
    <div className="flex h-full min-w-[1024px] flex-col bg-(--bg-page) text-(--text)">
      <TopBar route={route} onNavigate={setRoute} />
      <main className="flex min-h-0 flex-1 flex-col">
        {route === 'timeline' ? null : <PlaceholderPage />}
      </main>
    </div>
  )
}
