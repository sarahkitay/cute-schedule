import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Local `npm run dev` has no serverless API — forward `/api/*` to `vercel dev` (default :3000) so coach/push routes return JSON instead of index.html (which caused blank coach replies).
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
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
