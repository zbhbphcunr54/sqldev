import {
  parseMySqlColumnDefinition,
  parseOracleColumnDefinition,
  parsePostgresColumnDefinition
} from './column-parsers'
import { convertDdlOrchestrated, convertDdlOrchestratedResult } from './conversion-orchestrator'
import {
  convertExtraColumnType,
  createEmptyExtraDdlParseResult,
  generateExtraDdlStatements,
  parseExtraDdlStatements
} from './extra-ddl'
import {
  parseMySqlTableConstraintDefinition,
  parseOracleTableConstraintDefinition,
  parsePostgresTableConstraintDefinition
} from './table-constraint-parsers'
import { mapDdlTypeByRules } from './type-mapping'
import {
  generateMySqlViewStatements,
  generateOracleViewStatements,
  generatePostgresViewStatements
} from './view-generators'
import { parseViewStatements, transformViewQueryText } from './view-parsing'

export const ddlFacade = Object.freeze({
  columns: Object.freeze({
    parseOracleColumnDefinition,
    parseMySqlColumnDefinition,
    parsePostgresColumnDefinition
  }),
  constraints: Object.freeze({
    parseOracleTableConstraintDefinition,
    parseMySqlTableConstraintDefinition,
    parsePostgresTableConstraintDefinition
  }),
  conversion: Object.freeze({
    convertDdlOrchestrated,
    convertDdlOrchestratedResult,
    mapDdlTypeByRules
  }),
  extra: Object.freeze({
    convertExtraColumnType,
    createEmptyExtraDdlParseResult,
    generateExtraDdlStatements,
    parseExtraDdlStatements
  }),
  views: Object.freeze({
    generateOracleViewStatements,
    generateMySqlViewStatements,
    generatePostgresViewStatements,
    parseViewStatements,
    transformViewQueryText
  })
})

export type DdlFacade = typeof ddlFacade
