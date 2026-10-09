import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.jsx'
import BloxityProvider from './bloxity/BloxityProvider.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Slug comes from VITE_GAME_SLUG in client/.env — see .env.example. */}
    <BloxityProvider gameSlug={import.meta.env.VITE_GAME_SLUG}>
      <App />
    </BloxityProvider>
  </StrictMode>,
)

// Dev-only handle for automated play-testing (stripped from production builds).
if (import.meta.env.DEV) {
  Promise.all([import('./state/store'), import('./net/net')]).then(([store, net]) => {
    window.__sce = { runtime: store.runtime, useGame: store.useGame, send: net.send, serverNow: store.serverNow }
  })
}
