import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LibraryToolbar from './LibraryToolbar'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <LibraryToolbar />
  </React.StrictMode>,
)