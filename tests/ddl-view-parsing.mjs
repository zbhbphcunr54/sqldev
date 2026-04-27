import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/view-parsing.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function splitStatements(sql) {
  return String(sql)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
}

function createViewModel() {
  return {
    name: '',
    columns: [],
    query: '',
    comment: '',
    withCheckOption: false,
    checkOptionType: null,
    readOnly: false,
    orReplace: true,
    force: false,
    algorithm: null
  }
}

assertEqual(
  ddl.parseViewStatements(
    [
      'CREATE OR REPLACE FORCE VIEW demo_view (id, name) AS select * from dual WITH LOCAL CHECK OPTION',
      "COMMENT ON VIEW demo_view IS 'test view'"
    ].join(';'),
    splitStatements,
    createViewModel
  ),
  [
    {
      name: 'demo_view',
      columns: ['id', 'name'],
      query: 'select * from dual',
      comment: 'test view',
      withCheckOption: true,
      checkOptionType: 'LOCAL',
      readOnly: false,
      orReplace: true,
      force: true,
      algorithm: null
    }
  ],
  'view parser must collect column aliases, check option, force flag and comments'
)

assertEqual(
  ddl.transformViewQueryText('select 1 from dual', 'oracle', 'postgresql', (query) => query),
  'select 1',
  'view query transformer must remove FROM DUAL for Oracle-to-PostgreSQL'
)

assertEqual(
  ddl.transformViewQueryText('select 1', 'mysql', 'mysql', (query) => `x:${query}`),
  'select 1',
  'view query transformer must return original query when source and target are equal'
)

console.log('DDL view parsing tests passed')
