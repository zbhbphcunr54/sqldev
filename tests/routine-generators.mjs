import { strict as assert } from 'node:assert'
import { loadTsModule } from './helpers/load-ts-module.mjs'

const mod = loadTsModule('src/features/routines/generators.ts')
const {
  generateOracleFunctionStatement,
  generateMySqlFunctionStatement,
  generatePostgresFunctionStatement,
  generateOracleProcedureStatement,
  generateMySqlProcedureStatement,
  generatePostgresProcedureStatement
} = mod

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log('  ✓', name)
    passed++
  } catch (err) {
    console.error('  ✗', name)
    console.error('   ', err.message)
    failed++
  }
}

console.log('routine-generators')

// Oracle function
test('oracle function: basic structure', () => {
  const out = generateOracleFunctionStatement(
    'GET_NAME',
    [{ name: 'P_ID', direction: 'IN', type: 'NUMBER' }],
    'VARCHAR2',
    [],
    'BEGIN\n  RETURN \'test\';\nEND;'
  )
  assert.ok(out.includes('CREATE OR REPLACE FUNCTION GET_NAME'), 'header')
  assert.ok(out.includes('P_ID IN NUMBER'), 'param')
  assert.ok(out.includes('RETURN VARCHAR2'), 'return type')
  assert.ok(out.includes('IS\n'), 'IS section')
  assert.ok(out.endsWith('/'), 'trailing slash')
})

test('oracle function: strips VARCHAR2 size from params', () => {
  const out = generateOracleFunctionStatement(
    'F',
    [{ name: 'P', direction: 'IN', type: 'VARCHAR2(100)' }],
    'VARCHAR2',
    [],
    'BEGIN\n  RETURN P;\nEND;'
  )
  assert.ok(out.includes('P IN VARCHAR2'), 'size stripped')
})

test('oracle function: var declarations', () => {
  const out = generateOracleFunctionStatement(
    'F',
    [],
    'NUMBER',
    [{ name: 'V_COUNT', type: 'NUMBER', defaultVal: '0' }],
    'BEGIN\n  RETURN V_COUNT;\nEND;'
  )
  assert.ok(out.includes('V_COUNT NUMBER := 0;'), 'var with default')
})

// MySQL function
test('mysql function: DELIMITER wrapper', () => {
  const out = generateMySqlFunctionStatement(
    'get_val',
    [{ name: 'p_id', type: 'INT' }],
    'VARCHAR(100)',
    [],
    'BEGIN\n  RETURN \'x\';\nEND'
  )
  assert.ok(out.startsWith('DELIMITER $$'), 'starts with DELIMITER')
  assert.ok(out.includes('RETURNS VARCHAR(100)'), 'RETURNS')
  assert.ok(out.includes('DETERMINISTIC'), 'DETERMINISTIC')
  assert.ok(out.endsWith('DELIMITER ;'), 'ends with DELIMITER ;')
})

test('mysql function: OUT params removed with note', () => {
  const out = generateMySqlFunctionStatement(
    'f',
    [
      { name: 'p_in', direction: 'IN', type: 'INT' },
      { name: 'p_out', direction: 'OUT', type: 'INT' }
    ],
    'INT',
    [],
    'BEGIN\n  RETURN 1;\nEND'
  )
  assert.ok(out.includes('-- 注意: MySQL函数不支持OUT参数'), 'out note')
  assert.ok(!out.includes('p_out'), 'OUT param removed')
})

test('mysql function: DECLARE vars sorted (vars, cursors, handlers)', () => {
  const out = generateMySqlFunctionStatement(
    'f',
    [],
    'INT',
    [
      { name: 'v_x', type: 'INT', defaultVal: '0' },
      { cursor: true, name: 'c1', query: 'SELECT 1' }
    ],
    'BEGIN\n  RETURN 1;\nEND'
  )
  const declareVarPos = out.indexOf('DECLARE v_x')
  const declareCurPos = out.indexOf('DECLARE c1 CURSOR')
  assert.ok(declareVarPos < declareCurPos, 'var before cursor')
})

// PostgreSQL function
test('pg function: $$ wrapper', () => {
  const out = generatePostgresFunctionStatement(
    'get_val',
    [{ name: 'p_id', type: 'INT' }],
    'TEXT',
    [],
    'BEGIN\n  RETURN \'x\';\nEND;'
  )
  assert.ok(out.includes('LANGUAGE plpgsql'), 'language')
  assert.ok(out.includes('AS $$'), 'dollar quote open')
  assert.ok(out.endsWith('$$;'), 'dollar quote close')
})

test('pg function: DECLARE block for vars', () => {
  const out = generatePostgresFunctionStatement(
    'f',
    [],
    'INT',
    [{ name: 'v_x', type: 'INT', defaultVal: '0' }],
    'BEGIN\n  RETURN v_x;\nEND;'
  )
  assert.ok(out.includes('DECLARE\n'), 'DECLARE section')
  assert.ok(out.includes('v_x INT := 0;'), 'var with default')
})

test('pg function: FOR loop var gets RECORD declaration', () => {
  const out = generatePostgresFunctionStatement(
    'f',
    [],
    'VOID',
    [],
    'BEGIN\n  FOR rec IN SELECT * FROM t LOOP\n    NULL;\n  END LOOP;\nEND;'
  )
  assert.ok(out.includes('REC RECORD;'), 'RECORD for FOR loop var')
})

// Oracle procedure
test('oracle procedure: basic structure', () => {
  const out = generateOracleProcedureStatement(
    'DO_WORK',
    [{ name: 'P_ID', direction: 'IN', type: 'NUMBER' }],
    [],
    'BEGIN\n  NULL;\nEND;'
  )
  assert.ok(out.includes('CREATE OR REPLACE PROCEDURE DO_WORK'), 'header')
  assert.ok(out.includes('IS\n'), 'IS section')
  assert.ok(out.endsWith('/'), 'trailing slash')
})

test('oracle procedure: no params omits parens', () => {
  const out = generateOracleProcedureStatement('P', [], [], 'BEGIN\n  NULL;\nEND;')
  assert.ok(!out.includes('(\n'), 'no parens')
})

// MySQL procedure
test('mysql procedure: DELIMITER wrapper', () => {
  const out = generateMySqlProcedureStatement(
    'do_work',
    [{ name: 'p_id', direction: 'IN', type: 'INT' }],
    [],
    'BEGIN\n  SELECT 1;\nEND'
  )
  assert.ok(out.startsWith('DELIMITER $$'), 'starts with DELIMITER')
  assert.ok(out.endsWith('DELIMITER ;'), 'ends with DELIMITER ;')
})

test('mysql procedure: IN OUT becomes INOUT', () => {
  const out = generateMySqlProcedureStatement(
    'p',
    [{ name: 'v', direction: 'IN OUT', type: 'INT' }],
    [],
    'BEGIN\n  SET v = 1;\nEND'
  )
  assert.ok(out.includes('INOUT v INT'), 'INOUT direction')
})

// PostgreSQL procedure
test('pg procedure: $$ wrapper', () => {
  const out = generatePostgresProcedureStatement(
    'do_work',
    [{ name: 'p_id', type: 'INT' }],
    [],
    'BEGIN\n  NULL;\nEND;'
  )
  assert.ok(out.includes('LANGUAGE plpgsql'), 'language')
  assert.ok(out.endsWith('$$;'), 'dollar quote close')
})

test('pg procedure: OUT params sorted before IN with defaults', () => {
  const out = generatePostgresProcedureStatement(
    'p',
    [
      { name: 'p_in', direction: 'IN', type: 'INT', defaultVal: '0' },
      { name: 'p_out', direction: 'OUT', type: 'INT' }
    ],
    [],
    'BEGIN\n  p_out := 1;\nEND;'
  )
  const outPos = out.indexOf('p_out OUT')
  const inPos = out.indexOf('p_in IN')
  assert.ok(outPos < inPos, 'OUT before IN with default')
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
