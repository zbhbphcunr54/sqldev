import { loadTsModule } from './helpers/load-ts-module.mjs'

const ddl = loadTsModule('src/features/ddl/column-parsers.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const oracleColumn = ddl.parseOracleColumnDefinition("ID NUMBER(10,0) GENERATED ALWAYS AS IDENTITY DEFAULT 1 NOT NULL PRIMARY KEY")
assert(oracleColumn, 'oracle column must parse')
assertEqual(oracleColumn.type, 'NUMBER', 'oracle type must parse')
assertEqual(oracleColumn.autoIncrement, true, 'oracle identity must be detected')
assertEqual(oracleColumn._inlinePK, true, 'oracle inline primary key must be detected')

const mySqlColumn = ddl.parseMySqlColumnDefinition("amount DECIMAL(12,2) UNSIGNED DEFAULT 0.00 NOT NULL COMMENT '金额'")
assert(mySqlColumn, 'mysql column must parse')
assertEqual(mySqlColumn.extra.unsigned, true, 'mysql unsigned must be detected')
assertEqual(mySqlColumn.comment, '金额', 'mysql comment must parse')

const postgresColumn = ddl.parsePostgresColumnDefinition("created_at TIMESTAMP WITH TIME ZONE(6) DEFAULT now() NOT NULL")
assert(postgresColumn, 'postgres column must parse')
assertEqual(postgresColumn.type, 'TIMESTAMP WITH TIME ZONE', 'postgres timestamp type must parse')
assertEqual(postgresColumn.precision, 6, 'postgres timestamp precision must parse')
assertEqual(postgresColumn.nullable, false, 'postgres nullable must parse')

console.log('DDL column parsers tests passed')
