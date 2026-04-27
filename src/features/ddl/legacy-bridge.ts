import {
  applyOracleCommentStatements,
  applyOracleForeignKeyStatements,
  applyOracleIndexStatements,
  applyOraclePrimaryKeyStatements,
  applyPostgresCommentStatements,
  applyPostgresForeignKeyStatements,
  applyPostgresIndexStatements,
  applyPostgresPartitionStatements,
  buildMySqlInlineConstraintLines,
  buildOracleCommentLines,
  buildOracleForeignKeyLines,
  buildOracleIndexLines,
  buildPostgresCommentLines,
  buildPostgresForeignKeyLines,
  buildPostgresIndexLines,
  convertDdlOrchestrated,
  convertExtraColumnType,
  createEmptyExtraDdlParseResult,
  escapeDdlSqlLiteral,
  generateExtraDdlStatements,
  generateMySqlViewStatements,
  generateOracleViewStatements,
  generatePostgresViewStatements,
  parseViewStatements,
  createDdlColumnModel,
  extractCreateTableSections,
  createDdlTableModel,
  createDdlViewModel,
  extractParenthesizedBody,
  padText,
  parseMySqlColumnDefinition,
  parseMySqlTableConstraintDefinition,
  parseOracleColumnDefinition,
  parseOracleTableConstraintDefinition,
  parsePostgresColumnDefinition,
  parsePostgresTableConstraintDefinition,
  parseDdlRuleSource,
  parseAddColumnDefinition,
  parseAlterColumnTypeDefinition,
  parseExtraDdlStatements,
  transformViewQueryText,
  matchesDdlRuleSource,
  applyDdlRuleTarget,
  mapDdlTypeByRules,
  convertDdlDefaultValue,
  splitColumnDefinitions,
  splitListValues
} from './index'

declare global {
  interface Window {
    SQLDEV_DDL_UTILS?: {
      createDdlColumnModel: typeof createDdlColumnModel
      createDdlTableModel: typeof createDdlTableModel
      createDdlViewModel: typeof createDdlViewModel
      applyOracleCommentStatements: typeof applyOracleCommentStatements
      applyOracleForeignKeyStatements: typeof applyOracleForeignKeyStatements
      applyOracleIndexStatements: typeof applyOracleIndexStatements
      applyOraclePrimaryKeyStatements: typeof applyOraclePrimaryKeyStatements
      applyPostgresCommentStatements: typeof applyPostgresCommentStatements
      applyPostgresForeignKeyStatements: typeof applyPostgresForeignKeyStatements
      applyPostgresIndexStatements: typeof applyPostgresIndexStatements
      applyPostgresPartitionStatements: typeof applyPostgresPartitionStatements
      buildMySqlInlineConstraintLines: typeof buildMySqlInlineConstraintLines
      buildOracleCommentLines: typeof buildOracleCommentLines
      buildOracleForeignKeyLines: typeof buildOracleForeignKeyLines
      buildOracleIndexLines: typeof buildOracleIndexLines
      buildPostgresCommentLines: typeof buildPostgresCommentLines
      buildPostgresForeignKeyLines: typeof buildPostgresForeignKeyLines
      buildPostgresIndexLines: typeof buildPostgresIndexLines
      convertDdlOrchestrated: typeof convertDdlOrchestrated
      convertExtraColumnType: typeof convertExtraColumnType
      createEmptyExtraDdlParseResult: typeof createEmptyExtraDdlParseResult
      escapeDdlSqlLiteral: typeof escapeDdlSqlLiteral
      generateExtraDdlStatements: typeof generateExtraDdlStatements
      generateMySqlViewStatements: typeof generateMySqlViewStatements
      generateOracleViewStatements: typeof generateOracleViewStatements
      generatePostgresViewStatements: typeof generatePostgresViewStatements
      parseViewStatements: typeof parseViewStatements
      extractParenthesizedBody: typeof extractParenthesizedBody
      extractCreateTableSections: typeof extractCreateTableSections
      padText: typeof padText
      parseMySqlColumnDefinition: typeof parseMySqlColumnDefinition
      parseMySqlTableConstraintDefinition: typeof parseMySqlTableConstraintDefinition
      parseOracleColumnDefinition: typeof parseOracleColumnDefinition
      parseOracleTableConstraintDefinition: typeof parseOracleTableConstraintDefinition
      parsePostgresColumnDefinition: typeof parsePostgresColumnDefinition
      parsePostgresTableConstraintDefinition: typeof parsePostgresTableConstraintDefinition
      parseDdlRuleSource: typeof parseDdlRuleSource
      parseAddColumnDefinition: typeof parseAddColumnDefinition
      parseAlterColumnTypeDefinition: typeof parseAlterColumnTypeDefinition
      parseExtraDdlStatements: typeof parseExtraDdlStatements
      transformViewQueryText: typeof transformViewQueryText
      matchesDdlRuleSource: typeof matchesDdlRuleSource
      applyDdlRuleTarget: typeof applyDdlRuleTarget
      mapDdlTypeByRules: typeof mapDdlTypeByRules
      convertDdlDefaultValue: typeof convertDdlDefaultValue
      splitColumnDefinitions: typeof splitColumnDefinitions
      splitListValues: typeof splitListValues
    }
  }
}

window.SQLDEV_DDL_UTILS = Object.freeze({
  applyOracleCommentStatements,
  applyOracleForeignKeyStatements,
  applyOracleIndexStatements,
  applyOraclePrimaryKeyStatements,
  applyPostgresCommentStatements,
  applyPostgresForeignKeyStatements,
  applyPostgresIndexStatements,
  applyPostgresPartitionStatements,
  buildMySqlInlineConstraintLines,
  buildOracleCommentLines,
  buildOracleForeignKeyLines,
  buildOracleIndexLines,
  buildPostgresCommentLines,
  buildPostgresForeignKeyLines,
  buildPostgresIndexLines,
  convertDdlOrchestrated,
  convertExtraColumnType,
  createEmptyExtraDdlParseResult,
  escapeDdlSqlLiteral,
  generateExtraDdlStatements,
  generateMySqlViewStatements,
  generateOracleViewStatements,
  generatePostgresViewStatements,
  parseViewStatements,
  createDdlColumnModel,
  extractCreateTableSections,
  createDdlTableModel,
  createDdlViewModel,
  extractParenthesizedBody,
  padText,
  parseMySqlColumnDefinition,
  parseMySqlTableConstraintDefinition,
  parseOracleColumnDefinition,
  parseOracleTableConstraintDefinition,
  parsePostgresColumnDefinition,
  parsePostgresTableConstraintDefinition,
  parseDdlRuleSource,
  parseAddColumnDefinition,
  parseAlterColumnTypeDefinition,
  parseExtraDdlStatements,
  transformViewQueryText,
  matchesDdlRuleSource,
  applyDdlRuleTarget,
  mapDdlTypeByRules,
  convertDdlDefaultValue,
  splitColumnDefinitions,
  splitListValues
})
