import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.js'],
    css: false,
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
  },
})
