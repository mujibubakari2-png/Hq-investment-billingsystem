import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5175,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    sourcemap: false,          // disable source maps to save RAM
    minify: 'esbuild',         // esbuild is much lighter than terser
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      maxParallelFileOps: 2,   // limit parallel I/O to reduce peak memory
      output: {
        manualChunks(id) {
          // Split large deps into separate chunks so Rollup never
          // holds the entire bundle in memory at once.
          if (id.includes('node_modules/@mui/icons-material')) {
            return 'mui-icons'
          }
          if (id.includes('node_modules/@mui/material') ||
              id.includes('node_modules/@emotion')) {
            return 'mui'
          }
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3')) {
            return 'charts'
          }
          if (id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/react-router')) {
            return 'router'
          }
          if (id.includes('node_modules/react-hook-form') ||
              id.includes('node_modules/@hookform') ||
              id.includes('node_modules/zod')) {
            return 'forms'
          }

          if (id.includes('node_modules/date-fns')) return 'date-fns'
          if (id.includes('node_modules/zustand')) return 'zustand'
          if (id.includes('node_modules/jszip') ||
              id.includes('node_modules/file-saver')) {
            return 'files'
          }
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
        }
      }
    }
  }
})
