import { loadTsModule } from './helpers/load-ts-module.mjs'

const routines = loadTsModule('src/features/routines/function-parsers.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const oracleParsed = routines.parseOracleFunctionDefinition(`
CREATE OR REPLACE FUNCTION demo_sum(
  p_id IN NUMBER,
  p_name IN OUT VARCHAR2(30) DEFAULT NULL
) RETURN NUMBER IS
  v_total NUMBER := 0;
BEGIN
  RETURN v_total;
END;`)
assertEqual(oracleParsed.name, 'demo_sum', 'oracle function name must parse')
assertEqual(oracleParsed.returnType, 'NUMBER', 'oracle return type must parse')
assertEqual(oracleParsed.params.length, 2, 'oracle params must parse')
assertEqual(oracleParsed.vars[0], { name: 'v_total', type: 'NUMBER', defaultVal: '0' }, 'oracle vars must parse')
assert(oracleParsed.body.includes('RETURN v_total;'), 'oracle body must parse')

const mySqlParsed = routines.parseMySqlFunctionDefinition(`
CREATE FUNCTION calc_tax(IN p_amount DECIMAL(10,2))
RETURNS DECIMAL(10,2)
BEGIN
DECLARE v_rate DECIMAL(5,2) DEFAULT 0.13;
DECLARE CONTINUE HANDLER FOR NOT FOUND SET @done = 1;
RETURN p_amount * v_rate;
END;`)
assertEqual(mySqlParsed.name, 'calc_tax', 'mysql function name must parse')
assertEqual(mySqlParsed.returnType, 'DECIMAL(10,2)', 'mysql return type must parse')
assertEqual(mySqlParsed.vars, [{ name: 'v_rate', type: 'DECIMAL(5,2)', defaultVal: '0.13' }], 'mysql vars must parse')
assert(mySqlParsed.body.includes('DECLARE CONTINUE HANDLER'), 'mysql handler must stay in body')

const pgParsed = routines.parsePostgresFunctionDefinition(`
CREATE OR REPLACE FUNCTION public.demo_flag(p_id integer, OUT p_ok boolean)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer := 1;
BEGIN
  RETURN v_count > 0;
END;
$$;`)
assertEqual(pgParsed.name, 'public.demo_flag', 'postgres function name must preserve schema-qualified names')
assertEqual(pgParsed.returnType, 'boolean', 'postgres return type must parse')
assertEqual(pgParsed.params.length, 2, 'postgres params must parse')
assertEqual(pgParsed.vars[0], { name: 'v_count', type: 'integer', defaultVal: '1' }, 'postgres vars must parse')
assert(pgParsed.body.includes('RETURN v_count > 0;'), 'postgres body must parse')

console.log('Routine function parser tests passed')
