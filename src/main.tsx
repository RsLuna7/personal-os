import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { getStorage, startPersistence } from './data/persistence'

const persistence = startPersistence(getStorage(window), window)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App persistence={persistence} />
  </StrictMode>,
)
