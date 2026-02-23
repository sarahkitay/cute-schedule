import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-tokens.css'
import './App.css'
import App from './app.jsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <div className="app-bg">
      <App />
    </div>
  </StrictMode>,
)
