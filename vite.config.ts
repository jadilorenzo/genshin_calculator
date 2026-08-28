/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vercelApiDev } from './vite.apiDev.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDev()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@clerk')) return 'vendor-clerk'
            if (id.includes('tesseract')) return 'vendor-ocr'
            if (id.includes('react-router')) return 'vendor-router'
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'vendor-react'
            }
            return
          }

          if (id.includes('/src/data/characterKits.json')) return 'data-kits'
          if (id.includes('/src/data/characterMaterials.json')) {
            return 'data-materials'
          }
          if (id.includes('/src/data/characterAnimationTimings.json')) {
            return 'data-timings'
          }
          if (id.includes('/src/data/combatMechanics.json')) {
            return 'data-combat'
          }
        },
      },
    },
  },
  test: {
    globals: false,
  },
})
