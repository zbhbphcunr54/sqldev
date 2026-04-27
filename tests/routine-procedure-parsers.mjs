import { loadTsModule } from './helpers/load-ts-module.mjs'

const routines = loadTsModule('src/features/routines/procedure-parsers.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const oracleParsed = routines.parseOracleProcedureDefinition(`
CREATE OR REPLACE PROCEDURE demo_proc(
  p_id IN NUMBER
) IS
  v_total NUMBER := 0;
BEGIN
  NULL;
END;`)
assertEqual(oracleParsed.name, 'demo_proc', 'oracle procedure name must parse')
assertEqual(oracleParsed.params.length, 1, 'oracle procedure params must parse')
assertEqual(oracleParsed.vars[0], { name: 'v_total', type: 'NUMBER', defaultVal: '0' }, 'oracle procedure vars must parse')

const mySqlParsed = routines.parseMySqlProcedureDefinition(`
CREATE PROCEDURE calc_proc(IN p_amount DECIMAL(10,2))
BEGIN
DECLARE v_rate DECIMAL(5,2) DEFAULT 0.13;
SET p_amount = p_amount * v_rate;
END;`)
assertEqual(mySqlParsed.name, 'calc_proc', 'mysql procedure name must parse')
assertEqual(mySqlParsed.vars, [{ name: 'v_rate', type: 'DECIMAL(5,2)', defaultVal: '0.13' }], 'mysql procedure vars must parse')
assert(mySqlParsed.body.includes('SET p_amount'), 'mysql procedure body must parse')

const pgParsed = routines.parsePostgresProcedureDefinition(`
CREATE OR REPLACE PROCEDURE public.demo_proc(IN p_id integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 1;
BEGIN
  RAISE NOTICE 'ok';
END;
$$;`)
assertEqual(pgParsed.name, 'public.demo_proc', 'postgres procedure name must preserve schema-qualified names')
assertEqual(pgParsed.params.length, 1, 'postgres procedure params must parse')
assertEqual(pgParsed.vars[0], { name: 'v_count', type: 'integer', defaultVal: '1' }, 'postgres procedure vars must parse')
assert(pgParsed.body.includes("RAISE NOTICE 'ok';"), 'postgres procedure body must parse')

console.log('Routine procedure parser tests passed')
