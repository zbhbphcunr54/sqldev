export interface ExtraSequenceDefinition {
  name: string
  startWith: number | null
  incrementBy: number | null
  minValue: number | null
  maxValue: number | null
  cache: number | null
  cycle: boolean
}

export interface ExtraAlterSequenceDefinition {
  name: string
  incrementBy: number | null
  maxValue: number | null
  cache: number | null
  restartWith: number | null
}

export interface ExtraAlterColumnDefinition {
  table: string
  column: string
  newType: string
  newLength: number | null
  newPrecision: number | null
  newScale: number | null
  action: string
}

export interface ExtraAddColumnDefinition {
  table: string
  column: string
  type: string
  length: number | null
  precision: number | null
  scale: number | null
  nullable: boolean
  defaultValue: string | null
}

export interface ExtraDdlParseResult {
  sequences: ExtraSequenceDefinition[]
  alterSequences: ExtraAlterSequenceDefinition[]
  alterColumns: ExtraAlterColumnDefinition[]
  addColumns: ExtraAddColumnDefinition[]
}

type SupportedDatabase = 'oracle' | 'mysql' | 'postgresql'
type SplitStatements = (sql: string) => string[]
type TypeConverter = (
  typeStr: string,
  length: number | null,
  precision: number | null,
  scale: number | null,
  sourceDb: SupportedDatabase,
  targetDb: SupportedDatabase
) => string

export function createEmptyExtraDdlParseResult(): ExtraDdlParseResult {
  return {
    sequences: [],
    alterSequences: [],
    alterColumns: [],
    addColumns: []
  }
}

export function parseAlterColumnTypeDefinition(
  tableValue: unknown,
  columnValue: unknown,
  typeValue: unknown,
  actionValue: unknown
): ExtraAlterColumnDefinition {
  const result: ExtraAlterColumnDefinition = {
    table: String(tableValue || ''),
    column: String(columnValue || ''),
    newType: '',
    newLength: null,
    newPrecision: null,
    newScale: null,
    action: String(actionValue || '')
  }

  const typeMatch = String(typeValue || '').match(
    /^([\w]+)(?:\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?/i
  )
  if (typeMatch) {
    result.newType = typeMatch[1].toUpperCase()
    if (typeMatch[2] && typeMatch[3]) {
      result.newPrecision = parseInt(typeMatch[2], 10)
      result.newScale = parseInt(typeMatch[3], 10)
    } else if (typeMatch[2]) {
      result.newLength = parseInt(typeMatch[2], 10)
    }
  }

  return result
}

export function parseAddColumnDefinition(
  tableValue: unknown,
  columnValue: unknown,
  typeValue: unknown,
  restValue: unknown
): ExtraAddColumnDefinition {
  const result: ExtraAddColumnDefinition = {
    table: String(tableValue || ''),
    column: String(columnValue || ''),
    type: '',
    length: null,
    precision: null,
    scale: null,
    nullable: true,
    defaultValue: null
  }

  const typeMatch = String(typeValue || '').match(
    /^([\w]+)(?:\s*\(\s*(\d+)(?:\s*,\s*(\d+))?\s*\))?/i
  )
  if (typeMatch) {
    result.type = typeMatch[1].toUpperCase()
    if (typeMatch[2] && typeMatch[3]) {
      result.precision = parseInt(typeMatch[2], 10)
      result.scale = parseInt(typeMatch[3], 10)
    } else if (typeMatch[2]) {
      result.length = parseInt(typeMatch[2], 10)
    }
  }

  const rest = String(restValue || '')
  if (rest) {
    if (/NOT\s+NULL/i.test(rest)) result.nullable = false
    const defaultMatch = rest.match(/DEFAULT\s+('(?:[^']*)'|[\w.()]+)/i)
    if (defaultMatch) result.defaultValue = defaultMatch[1]
  }

  return result
}

export function parseExtraDdlStatements(
  sqlValue: unknown,
  sourceDbValue: unknown,
  splitStatements: SplitStatements
): ExtraDdlParseResult {
  const sql = String(sqlValue || '')
  const sourceDb = String(sourceDbValue || '').toLowerCase() as SupportedDatabase
  const result = createEmptyExtraDdlParseResult()
  if (!sql.trim()) return result

  const statements = splitStatements(sql)
  for (const statement of statements) {
    const sqlStatement = String(statement || '').trim()

    const createSequenceMatch = sqlStatement.match(
      /^CREATE\s+SEQUENCE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[\w"]+\.)?["']?([\w]+)["']?\s*([\s\S]*)/i
    )
    if (createSequenceMatch) {
      const body = createSequenceMatch[2] || ''
      const sequence: ExtraSequenceDefinition = {
        name: createSequenceMatch[1],
        startWith: null,
        incrementBy: null,
        minValue: null,
        maxValue: null,
        cache: null,
        cycle: false
      }
      const startMatch = body.match(/START\s+(?:WITH\s+)?(\d+)/i)
      if (startMatch) sequence.startWith = parseInt(startMatch[1], 10)
      const incrementMatch = body.match(/INCREMENT\s+(?:BY\s+)?(-?\d+)/i)
      if (incrementMatch) sequence.incrementBy = parseInt(incrementMatch[1], 10)
      const minMatch = body.match(/MINVALUE\s+(\d+)/i)
      if (minMatch) sequence.minValue = parseInt(minMatch[1], 10)
      if (/NO\s*MINVALUE/i.test(body)) sequence.minValue = null
      const maxMatch = body.match(/MAXVALUE\s+(\d+)/i)
      if (maxMatch) sequence.maxValue = parseInt(maxMatch[1], 10)
      if (/NO\s*MAXVALUE/i.test(body)) sequence.maxValue = null
      const cacheMatch = body.match(/CACHE\s+(\d+)/i)
      if (cacheMatch) sequence.cache = parseInt(cacheMatch[1], 10)
      if (/\bCYCLE\b/i.test(body) && !/\bNO\s*CYCLE\b/i.test(body)) sequence.cycle = true
      if (/\bNOCYCLE\b/i.test(body)) sequence.cycle = false
      result.sequences.push(sequence)
      continue
    }

    const alterSequenceMatch = sqlStatement.match(
      /^ALTER\s+SEQUENCE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s*([\s\S]*)/i
    )
    if (alterSequenceMatch) {
      const body = alterSequenceMatch[2] || ''
      const sequence: ExtraAlterSequenceDefinition = {
        name: alterSequenceMatch[1],
        incrementBy: null,
        maxValue: null,
        cache: null,
        restartWith: null
      }
      const incrementMatch = body.match(/INCREMENT\s+(?:BY\s+)?(-?\d+)/i)
      if (incrementMatch) sequence.incrementBy = parseInt(incrementMatch[1], 10)
      const maxMatch = body.match(/MAXVALUE\s+(\d+)/i)
      if (maxMatch) sequence.maxValue = parseInt(maxMatch[1], 10)
      const cacheMatch = body.match(/CACHE\s+(\d+)/i)
      if (cacheMatch) sequence.cache = parseInt(cacheMatch[1], 10)
      const restartMatch = body.match(/RESTART\s+(?:WITH\s+)?(\d+)/i)
      if (restartMatch) sequence.restartWith = parseInt(restartMatch[1], 10)
      result.alterSequences.push(sequence)
      continue
    }

    if (sourceDb === 'oracle') {
      const alterMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+MODIFY\s+\(?\s*["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)\s*\)?/i
      )
      if (alterMatch) {
        result.alterColumns.push(
          parseAlterColumnTypeDefinition(alterMatch[1], alterMatch[2], alterMatch[3], 'modify')
        )
        continue
      }
      const addMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ADD\s+\(?\s*["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)([^)]*)\)?/i
      )
      if (addMatch && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|CHECK)\b/i.test(addMatch[2])) {
        result.addColumns.push(
          parseAddColumnDefinition(addMatch[1], addMatch[2], addMatch[3], addMatch[4])
        )
        continue
      }
    } else if (sourceDb === 'mysql') {
      const alterMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+[`"]?([\w]+)[`"]?\s+MODIFY\s+(?:COLUMN\s+)?[`"]?([\w]+)[`"]?\s+([\w]+(?:\s*\([^)]*\))?)/i
      )
      if (alterMatch) {
        result.alterColumns.push(
          parseAlterColumnTypeDefinition(alterMatch[1], alterMatch[2], alterMatch[3], 'modify')
        )
        continue
      }
      const addMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+[`"]?([\w]+)[`"]?\s+ADD\s+(?:COLUMN\s+)?[`"]?([\w]+)[`"]?\s+([\w]+(?:\s*\([^)]*\))?)(.*)/i
      )
      if (
        addMatch &&
        !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CHECK)\b/i.test(addMatch[2])
      ) {
        result.addColumns.push(
          parseAddColumnDefinition(addMatch[1], addMatch[2], addMatch[3], addMatch[4])
        )
        continue
      }
    } else if (sourceDb === 'postgresql') {
      const alterMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ALTER\s+COLUMN\s+["']?([\w]+)["']?\s+(?:SET\s+DATA\s+)?TYPE\s+([\w]+(?:\s*\([^)]*\))?)/i
      )
      if (alterMatch) {
        result.alterColumns.push(
          parseAlterColumnTypeDefinition(alterMatch[1], alterMatch[2], alterMatch[3], 'modify')
        )
        continue
      }
      const addMatch = sqlStatement.match(
        /^ALTER\s+TABLE\s+(?:[\w"]+\.)?["']?([\w]+)["']?\s+ADD\s+(?:COLUMN\s+)?["']?([\w]+)["']?\s+([\w]+(?:\s*\([^)]*\))?)(.*)/i
      )
      if (addMatch && !/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|INDEX|CHECK)\b/i.test(addMatch[2])) {
        result.addColumns.push(
          parseAddColumnDefinition(addMatch[1], addMatch[2], addMatch[3], addMatch[4])
        )
        continue
      }
    }
  }

  return result
}

export function convertExtraColumnType(
  typeStrValue: unknown,
  lengthValue: number | null,
  precisionValue: number | null,
  scaleValue: number | null,
  sourceDbValue: SupportedDatabase,
  targetDbValue: SupportedDatabase,
  typeConverter: TypeConverter
): string {
  const typeStr = String(typeStrValue || '')
  const length = lengthValue ?? null
  const precision = precisionValue ?? null
  const scale = scaleValue ?? null
  const sourceDb = sourceDbValue
  const targetDb = targetDbValue

  if (typeof typeConverter === 'function') {
    return typeConverter(typeStr, length, precision, scale, sourceDb, targetDb)
  }

  if (length) return `${typeStr}(${length})`
  if (precision && scale != null) return `${typeStr}(${precision},${scale})`
  if (precision) return `${typeStr}(${precision})`
  return typeStr
}

export function generateExtraDdlStatements(
  parsedValue: ExtraDdlParseResult,
  sourceDbValue: SupportedDatabase,
  targetDbValue: SupportedDatabase,
  typeConverter: TypeConverter
): string {
  const parsed = parsedValue || createEmptyExtraDdlParseResult()
  const sourceDb = sourceDbValue
  const targetDb = targetDbValue
  const lines: string[] = []

  if (parsed.sequences.length) {
    lines.push('-- ========== SEQUENCES ==========')
    for (const sequence of parsed.sequences) {
      if (targetDb === 'mysql') {
        lines.push('-- MySQL 不原生支持 CREATE SEQUENCE，可使用 AUTO_INCREMENT 替代')
        lines.push(
          `-- 原序列: ${sequence.name} START WITH ${sequence.startWith || 1} INCREMENT BY ${sequence.incrementBy || 1}`
        )
      } else if (targetDb === 'oracle') {
        let line = `CREATE SEQUENCE ${sequence.name}`
        if (sequence.startWith != null) line += ` START WITH ${sequence.startWith}`
        if (sequence.incrementBy != null) line += ` INCREMENT BY ${sequence.incrementBy}`
        if (sequence.minValue != null) line += ` MINVALUE ${sequence.minValue}`
        if (sequence.maxValue != null) line += ` MAXVALUE ${sequence.maxValue}`
        if (sequence.cache != null) line += ` CACHE ${sequence.cache}`
        line += sequence.cycle ? ' CYCLE' : ' NOCYCLE'
        lines.push(`${line};`)
      } else {
        let line = `CREATE SEQUENCE ${sequence.name}`
        if (sequence.startWith != null) line += ` START WITH ${sequence.startWith}`
        if (sequence.incrementBy != null) line += ` INCREMENT BY ${sequence.incrementBy}`
        if (sequence.minValue != null) line += ` MINVALUE ${sequence.minValue}`
        if (sequence.maxValue != null) line += ` MAXVALUE ${sequence.maxValue}`
        if (sequence.cache != null) line += ` CACHE ${sequence.cache}`
        line += sequence.cycle ? ' CYCLE' : ' NO CYCLE'
        lines.push(`${line};`)
      }
    }
    lines.push('')
  }

  if (parsed.alterSequences.length) {
    lines.push('-- ========== ALTER SEQUENCES ==========')
    for (const sequence of parsed.alterSequences) {
      if (targetDb === 'mysql') {
        lines.push('-- MySQL 不原生支持 ALTER SEQUENCE')
        lines.push(`-- 原序列: ALTER SEQUENCE ${sequence.name}`)
      } else if (targetDb === 'oracle') {
        let line = `ALTER SEQUENCE ${sequence.name}`
        if (sequence.incrementBy != null) line += ` INCREMENT BY ${sequence.incrementBy}`
        if (sequence.maxValue != null) line += ` MAXVALUE ${sequence.maxValue}`
        if (sequence.cache != null) line += ` CACHE ${sequence.cache}`
        if (sequence.restartWith != null) {
          line += ` /* RESTART WITH ${sequence.restartWith} - Oracle 不支持 RESTART, 需 DROP/CREATE */`
        }
        lines.push(`${line};`)
      } else {
        let line = `ALTER SEQUENCE ${sequence.name}`
        if (sequence.incrementBy != null) line += ` INCREMENT BY ${sequence.incrementBy}`
        if (sequence.maxValue != null) line += ` MAXVALUE ${sequence.maxValue}`
        if (sequence.cache != null) line += ` CACHE ${sequence.cache}`
        if (sequence.restartWith != null) line += ` RESTART WITH ${sequence.restartWith}`
        lines.push(`${line};`)
      }
    }
    lines.push('')
  }

  if (parsed.alterColumns.length) {
    lines.push('-- ========== ALTER COLUMN TYPE ==========')
    for (const alterColumn of parsed.alterColumns) {
      const nextType = convertExtraColumnType(
        alterColumn.newType,
        alterColumn.newLength,
        alterColumn.newPrecision,
        alterColumn.newScale,
        sourceDb,
        targetDb,
        typeConverter
      )
      if (targetDb === 'oracle') {
        lines.push(`ALTER TABLE ${alterColumn.table} MODIFY (${alterColumn.column} ${nextType});`)
      } else if (targetDb === 'mysql') {
        lines.push(
          `ALTER TABLE ${alterColumn.table} MODIFY COLUMN ${alterColumn.column} ${nextType};`
        )
      } else {
        lines.push(
          `ALTER TABLE ${alterColumn.table} ALTER COLUMN ${alterColumn.column} TYPE ${nextType};`
        )
      }
    }
    lines.push('')
  }

  if (parsed.addColumns.length) {
    lines.push('-- ========== ADD COLUMN ==========')
    for (const addColumn of parsed.addColumns) {
      const nextType = convertExtraColumnType(
        addColumn.type,
        addColumn.length,
        addColumn.precision,
        addColumn.scale,
        sourceDb,
        targetDb,
        typeConverter
      )
      const defaultClause =
        addColumn.defaultValue != null ? ` DEFAULT ${addColumn.defaultValue}` : ''
      const nullableClause = addColumn.nullable ? '' : ' NOT NULL'
      if (targetDb === 'oracle') {
        lines.push(
          `ALTER TABLE ${addColumn.table} ADD (${addColumn.column} ${nextType}${defaultClause}${nullableClause});`
        )
      } else {
        lines.push(
          `ALTER TABLE ${addColumn.table} ADD COLUMN ${addColumn.column} ${nextType}${defaultClause}${nullableClause};`
        )
      }
    }
    lines.push('')
  }

  return lines.join('\n')
}
