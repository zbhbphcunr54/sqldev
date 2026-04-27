import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/parser-utils.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(ddl.createDdlTableModel().primaryKey, null, 'table model must expose default primaryKey')
assertEqual(ddl.createDdlColumnModel().nullable, true, 'column model must default nullable')
assertEqual(ddl.createDdlViewModel().orReplace, true, 'view model must default orReplace')
assertEqual(
  ddl.splitColumnDefinitions("a NUMBER(10,2), b VARCHAR2(20), c DEFAULT 'x,y'"),
  ['a NUMBER(10,2)', 'b VARCHAR2(20)', "c DEFAULT 'x,y'"],
  'column definition splitter must respect commas in parens and quotes'
)
assertEqual(
  ddl.extractParenthesizedBody('PARTITION BY LIST (region, code)'),
  'region, code',
  'parenthesized body extractor must return inner content'
)
assertEqual(
  ddl.extractCreateTableSections(
    "CREATE TABLE demo (id NUMBER, note VARCHAR2(20) DEFAULT 'a)b', amount NUMBER(10,2)) PARTITION BY HASH (id)",
    'CREATE TABLE demo '.length
  ),
  {
    openIndex: 18,
    bodyEndIndex: 82,
    body: "id NUMBER, note VARCHAR2(20) DEFAULT 'a)b', amount NUMBER(10,2)",
    trailing: 'PARTITION BY HASH (id)'
  },
  'create table section extractor must stop at the balanced closing paren outside quoted text'
)
assertEqual(
  ddl.splitListValues("'A','B,C',MAXVALUE"),
  ["'A'", "'B,C'", 'MAXVALUE'],
  'list splitter must respect quoted commas'
)
assertEqual(ddl.padText('ab', 4), 'ab  ', 'pad text must right-pad with spaces')

console.log('DDL parser utils tests passed')
