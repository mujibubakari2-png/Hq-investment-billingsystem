/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    host: '0.0.0.0',
    strictPort: true,
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
