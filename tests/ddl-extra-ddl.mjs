import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/extra-ddl.ts')

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

assertEqual(
  ddl.parseAlterColumnTypeDefinition('orders', 'amount', 'number(10,2)', 'modify'),
  {
    table: 'orders',
    column: 'amount',
    newType: 'NUMBER',
    newLength: null,
    newPrecision: 10,
    newScale: 2,
    action: 'modify'
  },
  'alter-column parser must read precision and scale'
)

assertEqual(
  ddl.parseAddColumnDefinition('orders', 'memo', 'varchar2(32)', ' default \'x\' not null'),
  {
    table: 'orders',
    column: 'memo',
    type: 'VARCHAR2',
    length: 32,
    precision: null,
    scale: null,
    nullable: false,
    defaultValue: "'x'"
  },
  'add-column parser must read length, nullable and default value'
)

assertEqual(
  ddl.parseExtraDdlStatements(
    [
      "CREATE SEQUENCE seq_demo START WITH 10 INCREMENT BY 2 CACHE 20 NOCYCLE",
      "ALTER TABLE orders MODIFY amount NUMBER(10,2)",
      "ALTER TABLE orders ADD memo VARCHAR2(32) DEFAULT 'x' NOT NULL"
    ].join(';'),
    'oracle',
    splitStatements
  ),
  {
    sequences: [
      {
        name: 'seq_demo',
        startWith: 10,
        incrementBy: 2,
        minValue: null,
        maxValue: null,
        cache: 20,
        cycle: false
      }
    ],
    alterSequences: [],
    alterColumns: [
      {
        table: 'orders',
        column: 'amount',
        newType: 'NUMBER',
        newLength: null,
        newPrecision: 10,
        newScale: 2,
        action: 'modify'
      }
    ],
    addColumns: [
      {
        table: 'orders',
        column: 'memo',
        type: 'VARCHAR2',
        length: 32,
        precision: null,
        scale: null,
        nullable: false,
        defaultValue: "'x'"
      }
    ]
  },
  'extra DDL parser must collect sequences and alter-table operations'
)

assertEqual(
  ddl.convertExtraColumnType('NUMBER', null, 10, 2, 'oracle', 'mysql', (type, length, precision, scale) => {
    if (precision && scale != null) return `DECIMAL(${precision},${scale})`
    return type
  }),
  'DECIMAL(10,2)',
  'extra type converter must delegate to injected type mapping callback'
)

assertEqual(
  ddl.generateExtraDdlStatements(
    {
      sequences: [],
      alterSequences: [],
      alterColumns: [
        {
          table: 'orders',
          column: 'amount',
          newType: 'NUMBER',
          newLength: null,
          newPrecision: 10,
          newScale: 2,
          action: 'modify'
        }
      ],
      addColumns: [
        {
          table: 'orders',
          column: 'memo',
          type: 'VARCHAR2',
          length: 32,
          precision: null,
          scale: null,
          nullable: false,
          defaultValue: "'x'"
        }
      ]
    },
    'oracle',
    'mysql',
    (type, length, precision, scale) => {
      if (length) return `VARCHAR(${length})`
      if (precision && scale != null) return `DECIMAL(${precision},${scale})`
      return type
    }
  ),
  [
    '-- ========== ALTER COLUMN TYPE ==========\nALTER TABLE orders MODIFY COLUMN amount DECIMAL(10,2);\n',
    '-- ========== ADD COLUMN ==========\nALTER TABLE orders ADD COLUMN memo VARCHAR(32) DEFAULT \'x\' NOT NULL;\n'
  ].join('\n'),
  'extra DDL generator must render alter/add statements through injected type converter'
)

console.log('DDL extra DDL tests passed')
