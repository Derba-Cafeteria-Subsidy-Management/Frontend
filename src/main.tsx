import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProvider } from './context/AppContext'
import { LanguageProvider } from './context/LanguageContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </AppProvider>
  </StrictMode>,
)

