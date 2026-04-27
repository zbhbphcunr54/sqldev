import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/output-builders.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  ddl.escapeDdlSqlLiteral("O'Brien"),
  "O''Brien",
  'sql literal escaper must double single quotes'
)

assertEqual(
  ddl.buildOracleCommentLines('orders', "Order's note", [{ name: 'memo', comment: "Memo's text" }]),
  [
    "COMMENT ON TABLE ORDERS IS 'Order''s note';",
    "COMMENT ON COLUMN ORDERS.MEMO IS 'Memo''s text';"
  ],
  'oracle comment builder must emit escaped table and column comment lines'
)

assertEqual(
  ddl.buildPostgresIndexLines(
    'orders',
    [{ name: 'UK_ORDERS_CODE', columns: ['CODE'] }],
    [{ name: 'IDX_ORDERS_USER', columns: ['USER_ID'] }]
  ),
  [
    'CREATE UNIQUE INDEX uk_orders_code ON orders(code);',
    'CREATE INDEX idx_orders_user ON orders(user_id);'
  ],
  'postgres index builder must normalize identifiers to lowercase'
)

assertEqual(
  ddl.buildOracleForeignKeyLines('orders', [
    {
      name: 'fk_order_user',
      columns: ['user_id'],
      refTable: 'users',
      refColumns: ['id'],
      onDelete: 'cascade',
      onUpdate: 'restrict'
    }
  ]),
  [
    'ALTER TABLE ORDERS ADD CONSTRAINT FK_ORDER_USER FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE /* [注意: Oracle 不支持 ON UPDATE RESTRICT, 需通过触发器实现] */;'
  ],
  'oracle foreign key builder must append ON UPDATE warning comment'
)

assertEqual(
  ddl.buildMySqlInlineConstraintLines({
    primaryKey: { name: 'pk_orders', columns: ['id'] },
    uniqueKeys: [{ name: 'uk_orders_code', columns: ['code'] }],
    indexes: [{ name: 'idx_orders_user', columns: ['user_id'] }],
    foreignKeys: [
      {
        name: 'fk_orders_user',
        columns: ['user_id'],
        refTable: 'users',
        refColumns: ['id'],
        onDelete: 'cascade',
        onUpdate: 'restrict'
      }
    ],
    partition: { columns: ['tenant_id'] }
  }),
  [
    '    PRIMARY KEY (`id`, `tenant_id`)',
    '    UNIQUE KEY `uk_orders_code` (`code`)',
    '    KEY `idx_orders_user` (`user_id`)',
    '    CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE RESTRICT'
  ],
  'mysql inline constraint builder must append partition columns into primary key and render inline keys'
)

console.log('DDL output builders tests passed')
