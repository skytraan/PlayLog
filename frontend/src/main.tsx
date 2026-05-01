import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// React Query is initialized inside App (already wraps the tree). The old
// ConvexProvider is gone — every API call now goes through the typed client
// in src/lib/api against the Hono backend.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
