import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths so the build works wherever Bloxity serves it.
  base: './',
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 5000 },
})
