import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Super Admin runs on a dedicated subdomain (e.g., admin.platform.com)
  // No base path needed — it runs at the root of its subdomain
  base: '/',
  server: {
    port: 5174, // Different port from main tenant app (5173)
    proxy: {
      // Proxy API calls to the existing backend during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
})
