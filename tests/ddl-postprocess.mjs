import { loadTsModule } from './helpers/load-ts-module.mjs'

const postprocess = loadTsModule('src/features/ddl/postprocess.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const oracleTables = [
  { name: 'USERS', columns: [{ name: 'ID' }], uniqueKeys: [], indexes: [], foreignKeys: [] }
]
postprocess.applyOracleCommentStatements(oracleTables, [
  "COMMENT ON TABLE USERS IS '用户表'",
  "COMMENT ON COLUMN USERS.ID IS '主键'"
])
postprocess.applyOracleIndexStatements(oracleTables, [
  'CREATE UNIQUE INDEX IDX_USERS_ID ON USERS (ID)'
])
postprocess.applyOraclePrimaryKeyStatements(oracleTables, [
  'ALTER TABLE USERS ADD CONSTRAINT PK_USERS PRIMARY KEY (ID)'
])
postprocess.applyOracleForeignKeyStatements(oracleTables, [
  'ALTER TABLE USERS ADD CONSTRAINT FK_USERS_DEPT FOREIGN KEY (DEPT_ID) REFERENCES DEPT (ID) ON DELETE CASCADE'
])
assertEqual(oracleTables[0].comment, '用户表', 'oracle table comment must be applied')
assertEqual(oracleTables[0].columns[0].comment, '主键', 'oracle column comment must be applied')
assertEqual(oracleTables[0].uniqueKeys[0].name, 'IDX_USERS_ID', 'oracle index must be applied')
assertEqual(oracleTables[0].primaryKey.name, 'PK_USERS', 'oracle primary key must be applied')
assertEqual(oracleTables[0].foreignKeys[0].name, 'FK_USERS_DEPT', 'oracle foreign key must be applied')

const pgTables = [
  {
    name: 'orders',
    columns: [{ name: 'id' }],
    uniqueKeys: [],
    indexes: [],
    foreignKeys: [],
    partition: { partitions: [], hashCount: null }
  }
]
postprocess.applyPostgresCommentStatements(pgTables, [
  "COMMENT ON TABLE orders IS '订单表'",
  "COMMENT ON COLUMN orders.id IS '编号'"
])
postprocess.applyPostgresIndexStatements(pgTables, [
  'CREATE INDEX idx_orders_id ON orders (id)'
])
postprocess.applyPostgresForeignKeyStatements(pgTables, [
  'ALTER TABLE orders ADD CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)'
])
postprocess.applyPostgresPartitionStatements(
  pgTables,
  ['CREATE TABLE orders_2026 PARTITION OF orders FOR VALUES IN (1,2,3)'],
  (value) => String(value).split(',').map((item) => item.trim())
)
assertEqual(pgTables[0].comment, '订单表', 'postgres table comment must be applied')
assertEqual(pgTables[0].columns[0].comment, '编号', 'postgres column comment must be applied')
assertEqual(pgTables[0].indexes[0].name, 'idx_orders_id', 'postgres index must be applied')
assertEqual(pgTables[0].foreignKeys[0].name, 'fk_orders_user', 'postgres foreign key must be applied')
assertEqual(pgTables[0].partition.partitions[0].name, 'orders_2026', 'postgres partition must be applied')

console.log('DDL postprocess tests passed')
