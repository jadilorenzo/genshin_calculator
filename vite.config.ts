/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { vercelApiDev } from './vite.apiDev.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiDev()],
  test: {
    globals: false,
  },
})
