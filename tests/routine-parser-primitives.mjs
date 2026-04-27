import { loadTsModule } from './helpers/load-ts-module.mjs'

const routines = loadTsModule('src/features/routines/parser-primitives.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assertEqual(
  routines.splitRoutineParamList('p_id NUMBER(10,0), p_name VARCHAR2(50), p_flag NUMBER(1) DEFAULT 0'),
  ['p_id NUMBER(10,0)', 'p_name VARCHAR2(50)', 'p_flag NUMBER(1) DEFAULT 0'],
  'routine param list splitting must ignore commas inside type precision'
)

assertEqual(
  routines.parseOracleRoutineParam('p_name IN OUT VARCHAR2(30) DEFAULT NULL'),
  { name: 'p_name', direction: 'IN OUT', type: 'VARCHAR2(30)', defaultVal: 'NULL' },
  'oracle param parsing must support direction and default'
)

assertEqual(
  routines.parseMySqlRoutineParam('INOUT p_amount DECIMAL(10,2) DEFAULT 0'),
  { name: 'p_amount', direction: 'IN OUT', type: 'DECIMAL(10,2)', defaultVal: '0' },
  'mysql param parsing must normalize INOUT'
)

assertEqual(
  routines.parsePostgresRoutineParam('p_result OUT TEXT DEFAULT NULL'),
  { name: 'p_result', direction: 'OUT', type: 'TEXT', defaultVal: 'NULL' },
  'postgres param parsing must support name-first direction format'
)

const oracleVars = routines.parseOracleVariableDeclarations(`
  v_total NUMBER := 0;
  CURSOR cur_demo IS SELECT * FROM dual;
  -- note
`)
assertEqual(
  oracleVars,
  [
    { name: 'v_total', type: 'NUMBER', defaultVal: '0' },
    { cursor: true, name: 'cur_demo', query: 'SELECT * FROM dual' },
    { raw: '-- note;' }
  ],
  'oracle declaration parsing must support vars, cursors, and raw comments'
)

const mySqlDecl = routines.extractMySqlRoutineDeclarations(`
DECLARE v_count INT DEFAULT 0;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;
SET v_count = v_count + 1;`.trim())
assertEqual(
  mySqlDecl,
  {
    vars: [{ name: 'v_count', type: 'INT', defaultVal: '0' }],
    body: 'DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;\nSET v_count = v_count + 1;'
  },
  'mysql declaration extraction must keep handlers in body'
)

const pgDecl = routines.extractPostgresRoutineDeclarations(`
DECLARE
  v_total NUMERIC := 0;
  cur_demo CURSOR FOR SELECT 1;
BEGIN
  RETURN v_total;
END;`.trim())
assertEqual(
  pgDecl,
  {
    vars: [
      { name: 'v_total', type: 'NUMERIC', defaultVal: '0' },
      { name: 'cur_demo', cursor: true, query: 'SELECT 1', type: 'CURSOR' }
    ],
    body: '\n  RETURN v_total;\n'
  },
  'postgres declaration extraction must parse DECLARE block and body'
)

assert(routines.parseOracleRoutineParam('') === null, 'empty oracle param must return null')

console.log('Routine parser primitive tests passed')
