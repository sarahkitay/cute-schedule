import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs so the built app loads inside Capacitor’s WebView (file / app-hosted).
  base: './',
  publicDir: 'public',
  build: {
    chunkSizeWarningLimit: 900,
    sourcemap: true,
    esbuild: {
      keepNames: true, // avoid minifier renaming variables to same symbol (TDZ "vn" error)
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  }
})
