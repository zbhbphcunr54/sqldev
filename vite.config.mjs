import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parsePort(value, fallback) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return fallback
  return port
}

function parseBoolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim())
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const devPort = parsePort(env.VITE_DEV_PORT, 4173)
  const previewPort = parsePort(env.VITE_PREVIEW_PORT, devPort)
  const sourcemap = mode === 'staging' || parseBoolean(env.VITE_BUILD_SOURCEMAP)

  return {
    base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: '127.0.0.1',
      port: devPort,
      open: '/index.html'
    },
    preview: {
      host: '127.0.0.1',
      port: previewPort
    },
    build: {
      target: 'es2022',
      sourcemap,
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, 'index.html')
        }
      }
    }
  }
})
