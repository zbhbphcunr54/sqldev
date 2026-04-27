type TableRecord = {
  name: string
  comment?: string
  columns: Array<{ name: string; comment?: string }>
  uniqueKeys: unknown[]
  indexes: unknown[]
  foreignKeys: unknown[]
  primaryKey?: unknown
  partition?: { partitions?: unknown[]; hashCount?: number | null } | null
}

function upper(value: unknown): string {
  return String(value || '').toUpperCase()
}

function lower(value: unknown): string {
  return String(value || '').toLowerCase()
}

export function applyOracleCommentStatements(tables: TableRecord[], statements: unknown[]): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const tableComment = sql.match(
      /^COMMENT\s+ON\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i
    )
    if (tableComment) {
      const table = tables.find((item) => upper(item.name) === upper(tableComment[1]))
      if (table) table.comment = tableComment[2].replace(/''/g, "'")
      continue
    }

    const columnComment = sql.match(
      /^COMMENT\s+ON\s+COLUMN\s+(?:[\w"]+\.)?["']?(\w+)["']?\.["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i
    )
    if (!columnComment) continue

    const table = tables.find((item) => upper(item.name) === upper(columnComment[1]))
    if (!table) continue
    const column = table.columns.find((item) => upper(item.name) === upper(columnComment[2]))
    if (column) column.comment = columnComment[3].replace(/''/g, "'")
  }
}

export function applyOracleIndexStatements(tables: TableRecord[], statements: unknown[]): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const indexMatch = sql.match(
      /^CREATE\s+(UNIQUE\s+)?INDEX\s+(\w+)\s+ON\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)/i
    )
    if (!indexMatch) continue

    const table = tables.find((item) => upper(item.name) === upper(indexMatch[3]))
    if (!table) continue
    const columns = indexMatch[4].split(',').map((item) => item.trim())
    if (indexMatch[1]) table.uniqueKeys.push({ name: indexMatch[2], columns })
    else table.indexes.push({ name: indexMatch[2], columns })
  }
}

export function applyOraclePrimaryKeyStatements(
  tables: TableRecord[],
  statements: unknown[]
): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const match = sql.match(
      /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+(\w+)\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
    )
    if (!match) continue

    const table = tables.find((item) => upper(item.name) === upper(match[1]))
    if (table && !table.primaryKey) {
      table.primaryKey = {
        name: match[2] || `PK_${table.name}`,
        columns: match[3].split(',').map((item) => item.trim())
      }
    }
  }
}

export function applyOracleForeignKeyStatements(
  tables: TableRecord[],
  statements: unknown[]
): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const match = sql.match(
      /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+(\w+)\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
    )
    if (!match) continue

    const table = tables.find((item) => upper(item.name) === upper(match[1]))
    if (!table) continue
    table.foreignKeys.push({
      name: match[2] || `FK_${table.name}`,
      columns: match[3].split(',').map((item) => item.trim()),
      refTable: match[4],
      refColumns: match[5].split(',').map((item) => item.trim()),
      onDelete: match[6] || null,
      onUpdate: match[7] || null
    })
  }
}

export function applyPostgresCommentStatements(tables: TableRecord[], statements: unknown[]): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const tableComment = sql.match(
      /^COMMENT\s+ON\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i
    )
    if (tableComment) {
      const table = tables.find((item) => lower(item.name) === lower(tableComment[1]))
      if (table) table.comment = tableComment[2].replace(/''/g, "'")
      continue
    }

    const columnComment = sql.match(
      /^COMMENT\s+ON\s+COLUMN\s+(?:[\w"]+\.)?["']?(\w+)["']?\.["']?(\w+)["']?\s+IS\s+'((?:''|[^'])*)'/i
    )
    if (!columnComment) continue

    const table = tables.find((item) => lower(item.name) === lower(columnComment[1]))
    if (!table) continue
    const column = table.columns.find((item) => lower(item.name) === lower(columnComment[2]))
    if (column) column.comment = columnComment[3].replace(/''/g, "'")
  }
}

export function applyPostgresIndexStatements(tables: TableRecord[], statements: unknown[]): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const match = sql.match(
      /^CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?(\w+)["']?\s+ON\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)/i
    )
    if (!match) continue

    const table = tables.find((item) => lower(item.name) === lower(match[3]))
    if (!table) continue
    const columns = match[4].split(',').map((item) => item.trim().replace(/["']/g, ''))
    if (match[1]) table.uniqueKeys.push({ name: match[2], columns })
    else table.indexes.push({ name: match[2], columns })
  }
}

export function applyPostgresForeignKeyStatements(
  tables: TableRecord[],
  statements: unknown[]
): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    const match = sql.match(
      /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?(\w+)["']?\s+ADD\s+(?:CONSTRAINT\s+["']?(\w+)["']?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+(?:[\w"]+\.)?["']?(\w+)["']?\s*\(([^)]+)\)(?:\s+ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?(?:\s+ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION))?/i
    )
    if (!match) continue

    const table = tables.find((item) => lower(item.name) === lower(match[1]))
    if (!table) continue
    table.foreignKeys.push({
      name: match[2] || `fk_${table.name}`,
      columns: match[3].split(',').map((item) => item.trim().replace(/["']/g, '')),
      refTable: match[4],
      refColumns: match[5].split(',').map((item) => item.trim().replace(/["']/g, '')),
      onDelete: match[6] || null,
      onUpdate: match[7] || null
    })
  }
}

export function applyPostgresPartitionStatements(
  tables: TableRecord[],
  statements: unknown[],
  splitListValues: (value: unknown) => string[]
): void {
  for (const statement of statements) {
    const sql = String(statement || '').trim()
    if (!/^CREATE\s+TABLE\s+\w+\s+PARTITION\s+OF\b/i.test(sql)) continue

    const rangeMatch = sql.match(
      /^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+FROM\s+\((?:'([^']*)'|(\w+))\)\s+TO\s+\((?:'([^']*)'|(\w+))\)/i
    )
    if (rangeMatch) {
      const parent = tables.find((item) => lower(item.name) === lower(rangeMatch[2]))
      if (parent?.partition?.partitions) {
        parent.partition.partitions.push({
          name: rangeMatch[1],
          valueFrom: rangeMatch[3] || rangeMatch[4],
          valueTo: rangeMatch[5] || rangeMatch[6]
        })
      }
      continue
    }

    const listMatch = sql.match(
      /^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+IN\s*\(([^)]+)\)/i
    )
    if (listMatch) {
      const parent = tables.find((item) => lower(item.name) === lower(listMatch[2]))
      if (parent?.partition?.partitions) {
        parent.partition.partitions.push({
          name: listMatch[1],
          values: splitListValues(listMatch[3])
        })
      }
      continue
    }

    const hashMatch = sql.match(
      /^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+FOR\s+VALUES\s+WITH\s*\(\s*modulus\s+(\d+)\s*,\s*remainder\s+(\d+)\s*\)/i
    )
    if (hashMatch) {
      const parent = tables.find((item) => lower(item.name) === lower(hashMatch[2]))
      if (parent?.partition?.partitions) {
        parent.partition.partitions.push({
          name: hashMatch[1],
          modulus: parseInt(hashMatch[3], 10),
          remainder: parseInt(hashMatch[4], 10)
        })
        if (
          !parent.partition.hashCount ||
          parseInt(hashMatch[3], 10) > parent.partition.hashCount
        ) {
          parent.partition.hashCount = parseInt(hashMatch[3], 10)
        }
      }
      continue
    }

    const defaultMatch = sql.match(
      /^CREATE\s+TABLE\s+[`"']?(\w+)[`"']?\s+PARTITION\s+OF\s+[`"']?(\w+)[`"']?\s+DEFAULT/i
    )
    if (defaultMatch) {
      const parent = tables.find((item) => lower(item.name) === lower(defaultMatch[2]))
      if (parent?.partition?.partitions) {
        parent.partition.partitions.push({
          name: defaultMatch[1],
          isDefault: true
        })
      }
    }
  }
}
