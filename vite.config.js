// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          db: ['idb'],
        },
      },
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
    host: true,
  },
})
