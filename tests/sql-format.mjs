import { loadTsModule } from './helpers/load-ts-module.mjs'

const { formatSqlForDisplay, formatSqlText, splitSqlStatements } = loadTsModule('src/features/sql/sql-format.ts')

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

assert(
  formatSqlForDisplay(
    "CREATE TABLE t(a NUMBER NOT NULL, b VARCHAR2(20), CONSTRAINT pk_t PRIMARY KEY (a)) ORGANIZATION INDEX NOCOMPRESS PCTFREE 10;"
  ) ===
    "CREATE TABLE t (\n  a NUMBER NOT NULL,\n  b VARCHAR2(20),\n  CONSTRAINT pk_t PRIMARY KEY (a)\n)\nORGANIZATION INDEX\nNOCOMPRESS\nPCTFREE 10;",
  'formatSqlForDisplay must expand single-line CREATE TABLE output into readable multi-line DDL'
)

assert(
  formatSqlForDisplay('[CREATE TABLE t(a NUMBER, b VARCHAR2(20));]') ===
    "CREATE TABLE t (\n  a NUMBER,\n  b VARCHAR2(20)\n);",
  'formatSqlForDisplay must unwrap accidental list-like wrappers around SQL output'
)

assert(
  formatSqlForDisplay('begin dbms_output.put_line(\'ok\'); end;', { sqlType: 'procedure' }) ===
    "begin dbms_output.put_line('ok');\nend;",
  'formatSqlForDisplay must keep routine output stable while still separating terminal statements'
)

console.log('SQL format tests passed')
