import './styles.css'
import './lib/prefs.ts'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { moveBrowserTrees } from './data/browserTrees.ts'

void moveBrowserTrees()

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
