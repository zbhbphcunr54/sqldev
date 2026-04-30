import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

const testFiles = [
  'tests/smoke.mjs',
  'tests/sql-format.mjs',
  'tests/ddl-parser-utils.mjs',
  'tests/ddl-column-parsers.mjs',
  'tests/ddl-conversion-orchestrator.mjs',
  'tests/ddl-table-constraint-parsers.mjs',
  'tests/ddl-extra-ddl.mjs',
  'tests/ddl-output-builders.mjs',
  'tests/ddl-postprocess.mjs',
  'tests/ddl-type-mapping.mjs',
  'tests/ddl-view-parsing.mjs',
  'tests/ddl-view-generators.mjs',
  'tests/convert-error-map.mjs',
  'tests/browser-file-actions.mjs',
  'tests/body-transform.mjs',
  'tests/routine-parser-primitives.mjs',
  'tests/routine-function-parsers.mjs',
  'tests/routine-procedure-parsers.mjs',
  'tests/preferences-storage.mjs',
  'tests/rules-persistence.mjs',
  'tests/id-tools.mjs',
  'tests/navigation-route.mjs',
  'tests/navigation-workbench-sections.mjs',
  'tests/navigation-redirect.mjs',
  'tests/ziwei-history.mjs',
  'tests/ziwei-presentation.mjs',
  'tests/ziwei-share.mjs',
  'tests/ziwei-ai-utils.mjs',
  'tests/routine-generators.mjs'
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
