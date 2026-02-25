import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './design-tokens.css'
import './App.css'
import App from './app.jsx'

// Error boundary so a runtime error shows a message instead of a blank page
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 480, margin: '40px auto' }}>
          <h2 style={{ margin: '0 0 12px' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>{String(this.state.error.message)}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const rootElement = document.getElementById('root')
if (!rootElement) {
  document.body.innerHTML = '<p style="padding:24px;font-family:system-ui">Root element not found.</p>'
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <ErrorBoundary>
          <div className="app-bg">
            <App />
          </div>
        </ErrorBoundary>
      </StrictMode>,
    )
  } catch (err) {
    console.error('Failed to mount app:', err)
    rootElement.innerHTML = `<p style="padding:24px;font-family:system-ui">Failed to load: ${err.message}. <a href="">Reload</a></p>`
  }
}
