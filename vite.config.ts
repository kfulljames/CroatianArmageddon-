import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built bundle works inside a Capacitor webview,
  // where the app is served from a file-ish origin rather than a domain root.
  base: './',
  build: { outDir: 'dist' },
})
