interface DdlColumnLike {
  name: string
  comment?: string
}

interface DdlKeyLike {
  name: string
  columns: string[]
}

interface DdlForeignKeyLike {
  name: string
  columns: string[]
  refTable: string
  refColumns: string[]
  onDelete?: string | null
  onUpdate?: string | null
}

interface DdlPartitionLike {
  columns?: string[]
}

interface DdlMySqlTableLike {
  primaryKey?: DdlKeyLike | null
  uniqueKeys: DdlKeyLike[]
  indexes: DdlKeyLike[]
  foreignKeys: DdlForeignKeyLike[]
  partition?: DdlPartitionLike | null
}

function upper(value: unknown): string {
  return String(value || '').toUpperCase()
}

function lower(value: unknown): string {
  return String(value || '').toLowerCase()
}

export function escapeDdlSqlLiteral(value: unknown): string {
  return String(value || '').replace(/'/g, "''")
}

export function buildOracleCommentLines(
  tableNameValue: unknown,
  tableCommentValue: unknown,
  columnsValue: DdlColumnLike[]
): string[] {
  const lines: string[] = []
  const tableName = upper(tableNameValue)
  const tableComment = String(tableCommentValue || '')
  const columns = Array.isArray(columnsValue) ? columnsValue : []

  if (tableComment) {
    lines.push(`COMMENT ON TABLE ${tableName} IS '${escapeDdlSqlLiteral(tableComment)}';`)
  }
  for (const column of columns) {
    if (!column?.comment) continue
    lines.push(
      `COMMENT ON COLUMN ${tableName}.${upper(column.name)} IS '${escapeDdlSqlLiteral(column.comment)}';`
    )
  }
  return lines
}

export function buildPostgresCommentLines(
  tableNameValue: unknown,
  tableCommentValue: unknown,
  columnsValue: DdlColumnLike[]
): string[] {
  const lines: string[] = []
  const tableName = lower(tableNameValue)
  const tableComment = String(tableCommentValue || '')
  const columns = Array.isArray(columnsValue) ? columnsValue : []

  if (tableComment) {
    lines.push(`COMMENT ON TABLE ${tableName} IS '${escapeDdlSqlLiteral(tableComment)}';`)
  }
  for (const column of columns) {
    if (!column?.comment) continue
    lines.push(
      `COMMENT ON COLUMN ${tableName}.${lower(column.name)} IS '${escapeDdlSqlLiteral(column.comment)}';`
    )
  }
  return lines
}

export function buildOracleIndexLines(
  tableNameValue: unknown,
  uniqueKeysValue: DdlKeyLike[],
  indexesValue: DdlKeyLike[]
): string[] {
  const lines: string[] = []
  const tableName = upper(tableNameValue)
  const uniqueKeys = Array.isArray(uniqueKeysValue) ? uniqueKeysValue : []
  const indexes = Array.isArray(indexesValue) ? indexesValue : []

  for (const key of uniqueKeys) {
    lines.push(
      `CREATE UNIQUE INDEX ${upper(key.name)} ON ${tableName}(${key.columns.map(upper).join(', ')});`
    )
  }
  for (const index of indexes) {
    lines.push(
      `CREATE INDEX ${upper(index.name)} ON ${tableName}(${index.columns.map(upper).join(', ')});`
    )
  }
  return lines
}

export function buildPostgresIndexLines(
  tableNameValue: unknown,
  uniqueKeysValue: DdlKeyLike[],
  indexesValue: DdlKeyLike[]
): string[] {
  const lines: string[] = []
  const tableName = lower(tableNameValue)
  const uniqueKeys = Array.isArray(uniqueKeysValue) ? uniqueKeysValue : []
  const indexes = Array.isArray(indexesValue) ? indexesValue : []

  for (const key of uniqueKeys) {
    lines.push(
      `CREATE UNIQUE INDEX ${lower(key.name)} ON ${tableName}(${key.columns.map(lower).join(', ')});`
    )
  }
  for (const index of indexes) {
    lines.push(
      `CREATE INDEX ${lower(index.name)} ON ${tableName}(${index.columns.map(lower).join(', ')});`
    )
  }
  return lines
}

export function buildOracleForeignKeyLines(
  tableNameValue: unknown,
  foreignKeysValue: DdlForeignKeyLike[]
): string[] {
  const lines: string[] = []
  const tableName = upper(tableNameValue)
  const foreignKeys = Array.isArray(foreignKeysValue) ? foreignKeysValue : []

  for (const foreignKey of foreignKeys) {
    let line =
      `ALTER TABLE ${tableName} ADD CONSTRAINT ${upper(foreignKey.name)} FOREIGN KEY (` +
      `${foreignKey.columns.map(upper).join(', ')}) REFERENCES ${upper(foreignKey.refTable)}` +
      `(${foreignKey.refColumns.map(upper).join(', ')})`
    if (foreignKey.onDelete) line += ` ON DELETE ${upper(foreignKey.onDelete)}`
    if (foreignKey.onUpdate) {
      line += ` /* [注意: Oracle 不支持 ON UPDATE ${upper(foreignKey.onUpdate)}, 需通过触发器实现] */`
    }
    lines.push(`${line};`)
  }

  return lines
}

export function buildPostgresForeignKeyLines(
  tableNameValue: unknown,
  foreignKeysValue: DdlForeignKeyLike[]
): string[] {
  const lines: string[] = []
  const tableName = lower(tableNameValue)
  const foreignKeys = Array.isArray(foreignKeysValue) ? foreignKeysValue : []

  for (const foreignKey of foreignKeys) {
    let line =
      `ALTER TABLE ${tableName} ADD CONSTRAINT ${lower(foreignKey.name)} FOREIGN KEY (` +
      `${foreignKey.columns.map(lower).join(', ')}) REFERENCES ${lower(foreignKey.refTable)}` +
      `(${foreignKey.refColumns.map(lower).join(', ')})`
    if (foreignKey.onDelete) line += ` ON DELETE ${upper(foreignKey.onDelete)}`
    if (foreignKey.onUpdate) line += ` ON UPDATE ${upper(foreignKey.onUpdate)}`
    lines.push(`${line};`)
  }

  return lines
}

export function buildMySqlInlineConstraintLines(tableValue: DdlMySqlTableLike): string[] {
  const table = tableValue
  const lines: string[] = []

  if (table?.primaryKey) {
    const primaryKeyColumns = table.primaryKey.columns.map(lower)
    if (table.partition?.columns) {
      for (const partitionColumn of table.partition.columns) {
        const normalized = lower(partitionColumn)
        if (!primaryKeyColumns.includes(normalized)) primaryKeyColumns.push(normalized)
      }
    }
    lines.push(`    PRIMARY KEY (${primaryKeyColumns.map((item) => `\`${item}\``).join(', ')})`)
  }

  for (const uniqueKey of table?.uniqueKeys || []) {
    lines.push(
      `    UNIQUE KEY \`${lower(uniqueKey.name)}\` (${uniqueKey.columns.map((item) => `\`${lower(item)}\``).join(', ')})`
    )
  }

  for (const index of table?.indexes || []) {
    lines.push(
      `    KEY \`${lower(index.name)}\` (${index.columns.map((item) => `\`${lower(item)}\``).join(', ')})`
    )
  }

  for (const foreignKey of table?.foreignKeys || []) {
    let line =
      `    CONSTRAINT \`${lower(foreignKey.name)}\` FOREIGN KEY (` +
      `${foreignKey.columns.map((item) => `\`${lower(item)}\``).join(', ')}) REFERENCES ` +
      `\`${lower(foreignKey.refTable)}\`(${foreignKey.refColumns.map((item) => `\`${lower(item)}\``).join(', ')})`
    if (foreignKey.onDelete) line += ` ON DELETE ${upper(foreignKey.onDelete)}`
    if (foreignKey.onUpdate) line += ` ON UPDATE ${upper(foreignKey.onUpdate)}`
    lines.push(line)
  }

  return lines
}
