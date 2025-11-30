import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import LandingPage from './pages/LandingPage'
import EditorPage from './pages/EditorPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Using HashRouter for GitHub Pages compatibility */}
    <HashRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/editor" element={<EditorPage />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
