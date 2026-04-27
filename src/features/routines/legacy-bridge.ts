import {
  extractMySqlRoutineDeclarations,
  extractPostgresRoutineDeclarations,
  generateMySqlFunctionStatement,
  generateMySqlProcedureStatement,
  generateOracleFunctionStatement,
  generateOracleProcedureStatement,
  generatePostgresFunctionStatement,
  generatePostgresProcedureStatement,
  parseMySqlFunctionDefinition,
  parseMySqlProcedureDefinition,
  parseMySqlRoutineParam,
  parseOracleFunctionDefinition,
  parseOracleProcedureDefinition,
  parseOracleRoutineParam,
  parseOracleVariableDeclarations,
  parsePostgresFunctionDefinition,
  parsePostgresProcedureDefinition,
  parsePostgresRoutineParam,
  splitRoutineParamList
} from './index'

declare global {
  interface Window {
    SQLDEV_ROUTINE_UTILS?: {
      extractMySqlRoutineDeclarations: typeof extractMySqlRoutineDeclarations
      extractPostgresRoutineDeclarations: typeof extractPostgresRoutineDeclarations
      generateMySqlFunctionStatement: typeof generateMySqlFunctionStatement
      generateMySqlProcedureStatement: typeof generateMySqlProcedureStatement
      generateOracleFunctionStatement: typeof generateOracleFunctionStatement
      generateOracleProcedureStatement: typeof generateOracleProcedureStatement
      generatePostgresFunctionStatement: typeof generatePostgresFunctionStatement
      generatePostgresProcedureStatement: typeof generatePostgresProcedureStatement
      parseMySqlFunctionDefinition: typeof parseMySqlFunctionDefinition
      parseMySqlProcedureDefinition: typeof parseMySqlProcedureDefinition
      parseMySqlRoutineParam: typeof parseMySqlRoutineParam
      parseOracleFunctionDefinition: typeof parseOracleFunctionDefinition
      parseOracleProcedureDefinition: typeof parseOracleProcedureDefinition
      parseOracleRoutineParam: typeof parseOracleRoutineParam
      parseOracleVariableDeclarations: typeof parseOracleVariableDeclarations
      parsePostgresFunctionDefinition: typeof parsePostgresFunctionDefinition
      parsePostgresProcedureDefinition: typeof parsePostgresProcedureDefinition
      parsePostgresRoutineParam: typeof parsePostgresRoutineParam
      splitRoutineParamList: typeof splitRoutineParamList
    }
  }
}

window.SQLDEV_ROUTINE_UTILS = Object.freeze({
  extractMySqlRoutineDeclarations,
  extractPostgresRoutineDeclarations,
  generateMySqlFunctionStatement,
  generateMySqlProcedureStatement,
  generateOracleFunctionStatement,
  generateOracleProcedureStatement,
  generatePostgresFunctionStatement,
  generatePostgresProcedureStatement,
  parseMySqlFunctionDefinition,
  parseMySqlProcedureDefinition,
  parseMySqlRoutineParam,
  parseOracleFunctionDefinition,
  parseOracleProcedureDefinition,
  parseOracleRoutineParam,
  parseOracleVariableDeclarations,
  parsePostgresFunctionDefinition,
  parsePostgresProcedureDefinition,
  parsePostgresRoutineParam,
  splitRoutineParamList
})
