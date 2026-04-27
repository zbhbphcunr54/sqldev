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

function splitAndNormalizeColumns(value: unknown, stripQuotesPattern: RegExp): string[] {
  return String(value || '')
    .split(',')
    .map((item) => item.trim().replace(stripQuotesPattern, ''))
}

export function parseOracleTableConstraintDefinition(
  definitionValue: unknown,
  tableNameValue: unknown
): DdlTableConstraintParseResult | null {
  const definition = String(definitionValue || '').trim()
  const tableName = String(tableNameValue || '')

  const namedPrimaryKey = definition.match(/^CONSTRAINT\s+(\w+)\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (namedPrimaryKey) {
    return {
      primaryKey: {
        name: namedPrimaryKey[1],
        columns: splitAndNormalizeColumns(namedPrimaryKey[2], /["']/g)
      }
    }
  }

  const primaryKey = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (primaryKey) {
    return {
      primaryKey: {
        name: `PK_${tableName}`,
        columns: splitAndNormalizeColumns(primaryKey[1], /["']/g)
      }
    }
  }

  const uniqueKey = definition.match(/^(?:CONSTRAINT\s+(\w+)\s+)?UNIQUE\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return {
      uniqueKey: {
        name: uniqueKey[1] || `UQ_${tableName}`,
        columns: splitAndNormalizeColumns(uniqueKey[2], /["']/g)
      }
    }
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+(\w+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return {
      foreignKey: {
        name: foreignKey[1] || `FK_${tableName}`,
        columns: splitAndNormalizeColumns(foreignKey[2], /["']/g),
        refTable: foreignKey[3],
        refColumns: splitAndNormalizeColumns(foreignKey[4], /["']/g),
        onDelete: foreignKey[5] || null,
        onUpdate: foreignKey[6] || null
      }
    }
  }

  if (/^(CHECK)\b/i.test(definition)) return { ignore: true }
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
    return {
      primaryKey: {
        name: `PK_${tableName}`,
        columns: splitAndNormalizeColumns(primaryKey[1], /[`"']/g)
      }
    }
  }

  const uniqueKey = definition.match(/^UNIQUE\s+(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return {
      uniqueKey: {
        name: uniqueKey[1],
        columns: splitAndNormalizeColumns(uniqueKey[2], /[`"']/g)
      }
    }
  }

  const index = definition.match(/^(?:KEY|INDEX)\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)/i)
  if (index) {
    return {
      index: {
        name: index[1],
        columns: splitAndNormalizeColumns(index[2], /[`"']/g)
      }
    }
  }

  const namedPrimaryKey = definition.match(
    /^CONSTRAINT\s+[`"']?(\w+)[`"']?\s+PRIMARY\s+KEY\s*\(([^)]+)\)/i
  )
  if (namedPrimaryKey) {
    return {
      primaryKey: {
        name: namedPrimaryKey[1],
        columns: splitAndNormalizeColumns(namedPrimaryKey[2], /[`"']/g)
      }
    }
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+[`"']?(\w+)[`"']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+[`"']?(\w+)[`"']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return {
      foreignKey: {
        name: foreignKey[1] || `FK_${tableName}`,
        columns: splitAndNormalizeColumns(foreignKey[2], /[`"']/g),
        refTable: foreignKey[3],
        refColumns: splitAndNormalizeColumns(foreignKey[4], /[`"']/g),
        onDelete: foreignKey[5] || null,
        onUpdate: foreignKey[6] || null
      }
    }
  }

  if (/^(CHECK)\b/i.test(definition)) return { ignore: true }
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
    return {
      primaryKey: {
        name: namedPrimaryKey[1],
        columns: splitAndNormalizeColumns(namedPrimaryKey[2], /["']/g)
      }
    }
  }

  const primaryKey = definition.match(/^PRIMARY\s+KEY\s*\(([^)]+)\)/i)
  if (primaryKey) {
    return {
      primaryKey: {
        name: `pk_${tableName}`,
        columns: splitAndNormalizeColumns(primaryKey[1], /["']/g)
      }
    }
  }

  const uniqueKey = definition.match(/^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?UNIQUE\s*\(([^)]+)\)/i)
  if (uniqueKey) {
    return {
      uniqueKey: {
        name: uniqueKey[1] || `uq_${tableName}`,
        columns: splitAndNormalizeColumns(uniqueKey[2], /["']/g)
      }
    }
  }

  const foreignKey = definition.match(
    /^(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
  )
  if (foreignKey) {
    return {
      foreignKey: {
        name: foreignKey[1] || `fk_${tableName}`,
        columns: splitAndNormalizeColumns(foreignKey[2], /["']/g),
        refTable: foreignKey[3],
        refColumns: splitAndNormalizeColumns(foreignKey[4], /["']/g),
        onDelete: foreignKey[5] || null,
        onUpdate: foreignKey[6] || null
      }
    }
  }

  if (/^(CHECK|EXCLUDE)\b/i.test(definition)) return { ignore: true }
  return null
}
