import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/view-generators.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const sampleViews = [
  {
    name: 'vw_orders',
    columns: ['order_id', 'user_name'],
    query: 'select * from dual',
    comment: "Order's view",
    withCheckOption: true,
    checkOptionType: 'local',
    readOnly: false,
    algorithm: 'merge'
  }
]

assertEqual(
  ddl.generateOracleViewStatements(sampleViews, 'mysql', (query, fromDb, toDb) => `${toDb}:${query}`),
  [
    "-- Order's view",
    'CREATE OR REPLACE VIEW VW_ORDERS (ORDER_ID, USER_NAME) AS',
    'oracle:select * from dual\nWITH CHECK OPTION',
    ';',
    '',
    "COMMENT ON TABLE VW_ORDERS IS 'Order''s view';"
  ].join('\n'),
  'oracle view generator must format uppercase identifiers and table comments'
)

assertEqual(
  ddl.generateMySqlViewStatements(sampleViews, 'oracle', (query, fromDb, toDb) => `${toDb}:${query}`),
  [
    "-- Order's view",
    'CREATE OR REPLACE ALGORITHM = MERGE VIEW `vw_orders` (`order_id`, `user_name`) AS',
    'mysql:select * from dual\nWITH LOCAL CHECK OPTION',
    ';'
  ].join('\n'),
  'mysql view generator must format algorithm and quoted identifiers'
)

assertEqual(
  ddl.generatePostgresViewStatements(
    [{ ...sampleViews[0], withCheckOption: false, readOnly: true }],
    'oracle',
    (query, fromDb, toDb) => `${toDb}:${query}`
  ),
  [
    "-- Order's view",
    'CREATE OR REPLACE VIEW vw_orders (order_id, user_name) AS',
    'postgresql:select * from dual',
    '/* [注意: PostgreSQL 不支持 WITH READ ONLY，可通过 security_barrier 或 GRANT 控制] */',
    ';',
    '',
    "COMMENT ON VIEW vw_orders IS 'Order''s view';"
  ].join('\n'),
  'postgres view generator must emit readable warning and comment line'
)

console.log('DDL view generators tests passed')
