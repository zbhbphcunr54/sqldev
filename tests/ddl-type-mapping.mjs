import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/type-mapping.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  ddl.parseDdlRuleSource('NUMBER(p,s) [p>=10]'),
  {
    types: ['NUMBER'],
    hasN: false,
    hasP: false,
    hasPS: true,
    specificVal: null,
    cond: { op: '>=', val: 10 }
  },
  'rule source parser must keep numeric precision conditions'
)

assertEqual(
  ddl.matchesDdlRuleSource(
    { type: 'NUMBER', precision: 12, scale: 2, length: null },
    ddl.parseDdlRuleSource('NUMBER(p,s) [p>=10]')
  ),
  true,
  'rule matcher must honor precision and scale conditions'
)

assertEqual(
  ddl.applyDdlRuleTarget({ type: 'NUMBER', precision: 12, scale: 2 }, 'NUMERIC(p,s)'),
  'NUMERIC(12,2)',
  'rule target applier must project precision and scale placeholders'
)

assertEqual(
  ddl.mapDdlTypeByRules(
    { type: 'VARCHAR2', rawType: 'VARCHAR2(32)', length: 32 },
    [{ source: 'VARCHAR2(n)', target: 'VARCHAR(n)' }]
  ),
  'VARCHAR(32)',
  'type mapper must apply matching source-target rules'
)

assertEqual(
  ddl.convertDdlDefaultValue('SYSTIMESTAMP', 'oracle', 'mysql'),
  'CURRENT_TIMESTAMP(6)',
  'default value converter must map Oracle timestamps to MySQL'
)

assertEqual(
  ddl.convertDdlDefaultValue('gen_random_uuid()', 'postgresql', 'oracle'),
  'SYS_GUID()',
  'default value converter must map PostgreSQL UUID generation to Oracle'
)

console.log('DDL type mapping tests passed')
