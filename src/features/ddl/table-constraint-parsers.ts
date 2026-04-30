export interface DdlTablePrimaryKey {
  name: string
  columns: string[]
}

export interface DdlTableUniqueKey {
  name: string
  columns: string[]
}

export interface DdlTableIndex {
  name: string
  columns: string[]
}

export interface DdlTableForeignKey {
  name: string
  columns: string[]
  refTable: string
  refColumns: string[]
  onDelete: string | null
  onUpdate: string | null
}

export interface DdlTableConstraintParseResult {
  primaryKey?: DdlTablePrimaryKey
  uniqueKey?: DdlTableUniqueKey
  index?: DdlTableIndex
  foreignKey?: DdlTableForeignKey
  ignore?: boolean
}

const ORACLE_QUOTE_RE = /["']/g
const MYSQL_QUOTE_RE = /[`"']/g
const CHECK_CONSTRAINT_RE = /^(CHECK)\b/i
const POSTGRES_IGNORED_CONSTRAINT_RE = /^(CHECK|EXCLUDE)\b/i

function splitAndNormalizeColumns(value: unknown, stripQuotesPattern: RegExp): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(stripQuotesPattern, ''))
}

function primaryKeyResult(name: string, columnsValue: unknown, quotePattern: RegExp) {
  return {
    primaryKey: {
      name,
      columns: splitAndNormalizeColumns(columnsValue, quotePattern)
    }
  }
}

function uniqueKeyResult(name: string, columnsValue: unknown, quotePattern: RegExp) {
  return {
    uniqueKey: {
      name,
      columns: splitAndNormalizeColumns(columnsValue, quotePattern)
    }
  }
}

function foreignKeyResult(
  match: RegExpMatchArray,
  fallbackName: string,
  quotePattern: RegExp
): DdlTableConstraintParseResult {
  return {
    foreignKey: {
      name: match[1] || fallbackName,
      columns: splitAndNormalizeColumns(match[2], quotePattern),
      refTable: match[3],
      refColumns: splitAndNormalizeColumns(match[4], quotePattern),
      onDelete: match[5] || null,
      onUpdate: match[6] || null
    }
  }
}

export function parseOracleTableConstraintDefinition(
  definitionValue: unknown,
  tableNameValue: unknown
): DdlTableConstraintParseResult | null {
  const definition = String(definitionValue || '').trim()
  const tableName = String(tableNameValue || '')

  const namedPrimaryKey = definition.match(/^CONSTRAINT\s+(\w+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (namedPrimaryKey) {
    return primaryKeyResult(namedPrimaryKey[1], namedPrimaryKey[2], ORACLE_QUOTE_RE)
  }

  const primaryKey = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (primaryKey) {
    return primaryKeyResult(`PK_${tableName}`, primaryKey[1], ORACLE_QUOTE_RE)
  }

  const uniqueKey = definition.match(/^(?:CONSTRAINT\s+(\w+)\s+)?UNIQUE\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return uniqueKeyResult(uniqueKey[1] || `UQ_${tableName}`, uniqueKey[2], ORACLE_QUOTE_RE)
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+(\w+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return foreignKeyResult(foreignKey, `FK_${tableName}`, ORACLE_QUOTE_RE)
  }

  if (CHECK_CONSTRAINT_RE.test(definition)) return { ignore: true }
  return null
}

export function parseMySqlTableConstraintDefinition(
  definitionValue: unknown,
  tableNameValue: unknown
): DdlTableConstraintParseResult | null {
  const definition = String(definitionValue || '').trim()
  const tableName = String(tableNameValue || '')

  const primaryKey = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (primaryKey) {
    return primaryKeyResult(`PK_${tableName}`, primaryKey[1], MYSQL_QUOTE_RE)
  }

  const uniqueKey = definition.match(/^UNIQUE\s+(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return uniqueKeyResult(uniqueKey[1], uniqueKey[2], MYSQL_QUOTE_RE)
  }

  const index = definition.match(/^(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i)
  if (index) {
    return {
      index: {
        name: index[1],
        columns: splitAndNormalizeColumns(index[2], MYSQL_QUOTE_RE)
      }
    }
  }

  const namedPrimaryKey = definition.match(
    /^CONSTRAINT\s+[`"']?(\w+)[`"']?\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i
  )
  if (namedPrimaryKey) {
    return primaryKeyResult(namedPrimaryKey[1], namedPrimaryKey[2], MYSQL_QUOTE_RE)
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+[`"']?(\w+)[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return foreignKeyResult(foreignKey, `FK_${tableName}`, MYSQL_QUOTE_RE)
  }

  if (CHECK_CONSTRAINT_RE.test(definition)) return { ignore: true }
  return null
}

export function parsePostgresTableConstraintDefinition(
  definitionValue: unknown,
  tableNameValue: unknown
): DdlTableConstraintParseResult | null {
  const definition = String(definitionValue || '').trim()
  const tableName = String(tableNameValue || '')

  const namedPrimaryKey = definition.match(
    /^CONSTRAINT\s+["']?(\w+)["']?\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i
  )
  if (namedPrimaryKey) {
    return primaryKeyResult(namedPrimaryKey[1], namedPrimaryKey[2], ORACLE_QUOTE_RE)
  }

  const primaryKey = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (primaryKey) {
    return primaryKeyResult(`pk_${tableName}`, primaryKey[1], ORACLE_QUOTE_RE)
  }

  const uniqueKey = definition.match(/^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?UNIQUE\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return uniqueKeyResult(uniqueKey[1] || `uq_${tableName}`, uniqueKey[2], ORACLE_QUOTE_RE)
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return foreignKeyResult(foreignKey, `fk_${tableName}`, ORACLE_QUOTE_RE)
  }

  if (POSTGRES_IGNORED_CONSTRAINT_RE.test(definition)) return { ignore: true }
  return null
}
