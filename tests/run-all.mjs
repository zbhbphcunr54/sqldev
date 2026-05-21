import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const testFiles = [
  'tests/smoke.mjs',
  'tests/workbench-ziwei-cache.mjs',
  'tests/sql-format.mjs',
  'tests/sql-convert-stream.mjs',
  'tests/browser-file-actions.mjs',
  'tests/preferences-storage.mjs',
  'tests/id-tools.mjs',
  'tests/ziwei-city-longitude.mjs',
  'tests/ziwei-compute.mjs',
  'tests/navigation-route.mjs',
  'tests/navigation-workbench-sections.mjs',
  'tests/navigation-redirect.mjs'
]

const startedAt = Date.now()

for (const file of testFiles) {
  console.log(`\n[tests] ${file}`)
  const result = spawnSync(process.execPath, [file], {
    cwd: root,
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1)
console.log(`\n[tests] ${testFiles.length} suites passed in ${durationSeconds}s`)
