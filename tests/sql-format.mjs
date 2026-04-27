import { loadTsModule } from './helpers/load-ts-module.mjs'

const { formatSqlText, splitSqlStatements } = loadTsModule('src/features/sql/sql-format.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assert(
  JSON.stringify(splitSqlStatements("select ';' as semi; select 2;")) ===
    JSON.stringify(["select ';' as semi", 'select 2']),
  'splitSqlStatements must ignore semicolons inside string literals'
)

assert(
  JSON.stringify(splitSqlStatements('select 1; /* ignored; */ select 2;')) === JSON.stringify(['select 1', 'select 2']),
  'splitSqlStatements must ignore semicolons inside block comments'
)

assert(
  formatSqlText(' select 1 ;\n\n\n select 2 ') === 'select 1;\n\nselect 2;',
  'formatSqlText must normalize multi-statement SQL'
)

assert(
  formatSqlText('begin\n\n\n  null;\nend;', { preserveBlocks: true }) === 'begin\n\n  null;\nend;',
  'formatSqlText must preserve PL/SQL blocks when requested'
)

console.log('SQL format tests passed')
