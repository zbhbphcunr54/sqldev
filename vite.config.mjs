import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    open: '/index.vite.html'
  },
  preview: {
    host: '127.0.0.1',
    port: 4173
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.vite.html')
      }
    }
  }
})
