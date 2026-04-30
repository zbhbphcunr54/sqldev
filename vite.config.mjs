import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFile, mkdir } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function copyLegacyAssetsPlugin() {
  let outDir = 'dist'
  const legacyFiles = [
    'app.js',
    'auth.js',
    'bootstrap.js',
    'feedback.js',
    'preferences-runtime.js',
    'rules.js',
    'runtime-config.js',
    'samples.js',
    'startup-view.js',
    'style.css',
    'modules/navigation-state.js',
    'modules/sql-editor-component.js',
    'modules/sql-conversion-actions.js',
    'modules/id-tool-actions.js',
    'modules/ziwei-ai-cooldown.js',
    'modules/ziwei-ai-suggestions.js',
    'modules/ziwei-ai-requests.js',
    'modules/ziwei-share-poster.js',
    'vendor/active-line.min.js',
    'vendor/codemirror.min.css',
    'vendor/codemirror.min.js',
    'vendor/placeholder.min.js',
    'vendor/sql.min.js',
    'vendor/supabase.js',
    'vendor/vue.global.prod.js'
  ]
  return {
    name: 'copy-legacy-assets',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    async closeBundle() {
      const sourceDir = path.resolve(__dirname, 'src/legacy')
      const targetDir = path.resolve(__dirname, outDir, 'src/legacy')
      await Promise.all(
        legacyFiles.map(async (file) => {
          const source = path.join(sourceDir, file)
          const target = path.join(targetDir, file)
          await mkdir(path.dirname(target), { recursive: true })
          await copyFile(source, target)
        })
      )
    }
  }
}

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
    plugins: [vue(), copyLegacyAssetsPlugin()],
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
          app: path.resolve(__dirname, 'index.html'),
          legacy: path.resolve(__dirname, 'legacy.html')
        }
      }
    }
  }
})
