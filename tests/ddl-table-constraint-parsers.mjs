import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/table-constraint-parsers.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  ddl.parseOracleTableConstraintDefinition('PRIMARY KEY (ID, CODE)', 'ORDERS'),
  {
    primaryKey: {
      name: 'PK_ORDERS',
      columns: ['ID', 'CODE']
    }
  },
  'oracle parser must normalize unnamed primary keys'
)

assertEqual(
  ddl.parseOracleTableConstraintDefinition(
    'CONSTRAINT FK_ORDER_USER FOREIGN KEY (USER_ID) REFERENCES USERS(ID) ON DELETE CASCADE',
    'ORDERS'
  ),
  {
    foreignKey: {
      name: 'FK_ORDER_USER',
      columns: ['USER_ID'],
      refTable: 'USERS',
      refColumns: ['ID'],
      onDelete: 'CASCADE',
      onUpdate: null
    }
  },
  'oracle parser must read named foreign keys'
)

assertEqual(
  ddl.parseMySqlTableConstraintDefinition('UNIQUE KEY `uk_demo` (`code`,`tenant_id`)', 'demo'),
  {
    uniqueKey: {
      name: 'uk_demo',
      columns: ['code', 'tenant_id']
    }
  },
  'mysql parser must read unique keys'
)

assertEqual(
  ddl.parseMySqlTableConstraintDefinition(
    'CONSTRAINT `fk_demo_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE',
    'demo'
  ),
  {
    foreignKey: {
      name: 'fk_demo_user',
      columns: ['user_id'],
      refTable: 'users',
      refColumns: ['id'],
      onDelete: null,
      onUpdate: 'CASCADE'
    }
  },
  'mysql parser must read foreign keys with quoted identifiers'
)

assertEqual(
  ddl.parsePostgresTableConstraintDefinition('UNIQUE ("code", "tenant_id")', 'orders'),
  {
    uniqueKey: {
      name: 'uq_orders',
      columns: ['code', 'tenant_id']
    }
  },
  'postgres parser must synthesize unnamed unique key names'
)

assertEqual(
  ddl.parsePostgresTableConstraintDefinition('EXCLUDE USING gist (period WITH &&)', 'orders'),
  { ignore: true },
  'postgres parser must mark EXCLUDE constraints as ignorable'
)

console.log('DDL table constraint parsers tests passed')
