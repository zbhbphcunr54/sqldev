import { loadTsModule } from './helpers/load-ts-module.mjs'

const {
  decodeEscapedSqlText,
  extractConvertedSqlPreview,
  diffSqlPreview
} = loadTsModule('supabase/functions/sql-convert/stream-parser.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`)
  }
}

function assertDeepEqual(actual, expected, message) {
  const actualJson = JSON.stringify(actual)
  const expectedJson = JSON.stringify(expected)
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nexpected: ${expectedJson}\nactual: ${actualJson}`)
  }
}

assertEqual(
  decodeEscapedSqlText('SELECT 1\\\\nFROM dual'),
  'SELECT 1\nFROM dual',
  'decodeEscapedSqlText must fully decode double-escaped newlines without leaving stray backslashes'
)

assertEqual(
  decodeEscapedSqlText('SELECT \\\\\\"name\\\\\\" FROM dual'),
  'SELECT "name" FROM dual',
  'decodeEscapedSqlText must decode double-escaped quotes'
)

assertEqual(
  extractConvertedSqlPreview('{"converted_sql":"SELECT 1\\\\\\\\nFROM dual","ai_ratio":100}'),
  'SELECT 1\\\\nFROM dual',
  'extractConvertedSqlPreview must preserve partial SQL string content before final decoding'
)

assertDeepEqual(
  diffSqlPreview('SELECT \\', 'SELECT \n'),
  { text: 'SELECT \n', replace: true },
  'diffSqlPreview must request replacement when escape decoding rewrites existing preview text'
)

assertDeepEqual(
  diffSqlPreview('SELECT 1', 'SELECT 1\nFROM dual'),
  { text: '\nFROM dual', replace: false },
  'diffSqlPreview must keep append mode for monotonic preview growth'
)

assert(diffSqlPreview('SELECT 1', 'SELECT 1') === null, 'diffSqlPreview must ignore unchanged preview text')

console.log('SQL convert stream tests passed')
