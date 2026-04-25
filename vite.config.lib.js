import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    // Injects compiled CSS into the JS bundle at runtime — consumers don't
    // need a separate stylesheet import.
    cssInjectedByJs(),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'EbbetsLineup',
      formats: ['es', 'cjs'],
      fileName: format => `index.${format}.js`,
    },
    rollupOptions: {
      // React must come from the host application; everything else is bundled.
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
        },
      },
    },
    sourcemap: true,
    emptyOutDir: true,
    outDir: 'dist',
  },
})
