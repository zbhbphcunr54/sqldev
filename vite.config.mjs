import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cp } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function copyLegacyAssetsPlugin() {
  let outDir = 'dist'
  return {
    name: 'copy-legacy-assets',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    async closeBundle() {
      const sourceDir = path.resolve(__dirname, 'src/legacy')
      const targetDir = path.resolve(__dirname, outDir, 'src/legacy')
      await cp(sourceDir, targetDir, { recursive: true, force: true })
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [vue(), copyLegacyAssetsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    open: '/index.html'
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
        app: path.resolve(__dirname, 'index.html'),
        legacy: path.resolve(__dirname, 'legacy.html')
      }
    }
  }
})
