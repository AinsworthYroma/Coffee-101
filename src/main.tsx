import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LibraryToolbar from './LibraryToolbar'
import TastingDetailAppearance from './TastingDetailAppearance'
import './styles.css'
import './tasting-detail-background.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <LibraryToolbar />
    <TastingDetailAppearance />
  </React.StrictMode>,
)