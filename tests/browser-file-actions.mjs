import { loadTsModule } from './helpers/load-ts-module.mjs'

const { buildSqlDownloadFileName, resolveSqlFileExtension } = loadTsModule('src/features/browser/file-actions.ts')
const fixedDate = new Date('2026-04-23T12:00:00.000Z')

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

assertEqual(resolveSqlFileExtension('mysql'), 'mysql', 'mysql extension must be mysql')
assertEqual(resolveSqlFileExtension('postgresql'), 'pgsql', 'postgresql extension must be pgsql')
assertEqual(resolveSqlFileExtension('oracle'), 'oracle', 'default extension must be oracle')
assertEqual(
  buildSqlDownloadFileName('ddl', 'postgresql', fixedDate),
  'ddl_pgsql_2026-04-23.sql',
  'filename must include prefix, dialect and date'
)
assertEqual(
  buildSqlDownloadFileName('', 'unknown', fixedDate),
  'sql_oracle_2026-04-23.sql',
  'empty prefix must fall back to sql'
)

console.log('Browser file action tests passed')
