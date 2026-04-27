import { loadTsModule } from './helpers/load-ts-module.mjs'

const rules = loadTsModule('src/features/rules/body-transform.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  rules.getBodyRuleCategories('oracle', 'postgresql'),
  [{ name: 'oraclePg', forward: true }],
  'body rule categories must resolve Oracle -> PostgreSQL pair'
)

assertEqual(
  rules.mapParamTypeByRules('%ROWTYPE', 'oracle', 'postgresql', {}),
  'RECORD',
  'param type mapper must turn %ROWTYPE into RECORD for PostgreSQL'
)

assertEqual(
  rules.mapParamTypeByRules('NUMBER', 'oracle', 'mysql', {
    oracleMysql: [
      {
        typeFwd: (value) => value.replace('NUMBER', 'DECIMAL')
      }
    ]
  }),
  'DECIMAL',
  'param type mapper must apply forward rule functions'
)

assertEqual(
  rules.transformBodyByRules('select NVL(a, 1) from dual', 'oracle', 'postgresql', {
    oraclePg: [
      {
        fwd: (value) => value.replace('NVL', 'COALESCE')
      },
      {
        fwd: (value) => value.replace('dual', 'demo_table')
      }
    ]
  }),
  'select COALESCE(a, 1) from demo_table',
  'body transformer must apply all forward body rules in order'
)

assertEqual(
  rules.transformBodyByRules('select 1', 'mysql', 'mysql', {
    mysqlPg: [{ fwd: (value) => `${value} changed` }]
  }),
  'select 1',
  'body transformer must keep original body when source and target are equal'
)

console.log('Body transform rule tests passed')
