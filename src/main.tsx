import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-sc'
import '@fontsource-variable/noto-serif-sc'
import './index.css'
import { App } from './app/App'
import { getStorage, startPersistence } from './data/persistence'

const persistence = startPersistence(getStorage(window), window)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App persistence={persistence} />
  </StrictMode>,
)
