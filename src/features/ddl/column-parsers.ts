import { createDdlColumnModel } from './parser-utils'

type ColumnModel = ReturnType<typeof createDdlColumnModel> & {
  _inlinePK?: boolean
}

export function parseOracleColumnDefinition(definitionValue: unknown): ColumnModel | null {
  const definition = String(definitionValue || '')
  const match = definition.match(/^["']?(\w+)["']?\s+(.+)$/i)
  if (!match) return null

  const column = createDdlColumnModel() as ColumnModel
  column.name = match[1]
  let rest = match[2].trim()

  const typeMatch = rest.match(
    /^(LONG\s+RAW|TIMESTAMP\s+WITH\s+(?:LOCAL\s+)?TIME\s+ZONE|INTERVAL\s+(?:YEAR|DAY)\s+TO\s+(?:MONTH|SECOND)|DOUBLE\s+PRECISION|BINARY[_ ]FLOAT|BINARY[_ ]DOUBLE|\w+)(?:\(([^)]+)\))?/i
  )
  if (!typeMatch) return null

  column.rawType = typeMatch[0]
  const typeName = typeMatch[1].toUpperCase().replace(/\s+/g, ' ')
  column.type = typeName

  if (typeMatch[2]) {
    const numbers = typeMatch[2].split(',').map((item) => item.trim())
    if (typeName === 'NUMBER' || typeName === 'FLOAT' || typeName === 'DECIMAL') {
      column.precision = parseInt(numbers[0], 10) || null
      column.scale = numbers[1] !== undefined ? parseInt(numbers[1], 10) : null
    } else {
      column.length = parseInt(numbers[0], 10) || null
    }
  }

  rest = rest.slice(typeMatch[0].length).trim()
  const identityMatch = rest.match(
    /\bGENERATED\s+(?:ALWAYS|BY\s+DEFAULT(?:\s+ON\s+NULL)?)\s+AS\s+IDENTITY/i
  )
  if (identityMatch) {
    column.autoIncrement = true
    rest = rest.slice(rest.indexOf(identityMatch[0]) + identityMatch[0].length).trim()
  }

  const defaultMatch = rest.match(
    /^DEFAULT\s+(.+?)(?=\s+NOT\s+NULL|\s+NULL|\s+CONSTRAINT|\s+CHECK|\s+UNIQUE|\s+PRIMARY|$)/i
  )
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1].trim().replace(/,\s*$/, '')
    rest = rest.slice(rest.indexOf(defaultMatch[0]) + defaultMatch[0].length).trim()
  }

  if (/\bNOT\s+NULL\b/i.test(rest)) column.nullable = false
  else if (/\bNULL\b/i.test(rest) && !/\bNOT\s+NULL\b/i.test(rest)) column.nullable = true
  if (/\bPRIMARY\s+KEY\b/i.test(rest)) column._inlinePK = true
  return column
}

export function parseMySqlColumnDefinition(definitionValue: unknown): ColumnModel | null {
  const definition = String(definitionValue || '')
  const match = definition.match(/^[`"']?(\w+)[`"']?\s+(.+)$/i)
  if (!match) return null

  const column = createDdlColumnModel() as ColumnModel
  column.name = match[1]
  let rest = match[2].trim()
  const typeMatch = rest.match(/^(\w+)(?:\(([^)]+)\))?/i)
  if (!typeMatch) return null

  column.rawType = typeMatch[0]
  column.type = typeMatch[1].toUpperCase()
  if (typeMatch[2]) {
    const numbers = typeMatch[2].split(',').map((item) => item.trim())
    if (/DECIMAL|NUMERIC|FLOAT|DOUBLE|INT|BIGINT|TINYINT|SMALLINT|MEDIUMINT/i.test(column.type)) {
      column.precision = parseInt(numbers[0], 10) || null
      column.scale = numbers[1] !== undefined ? parseInt(numbers[1], 10) : null
    } else {
      column.length = parseInt(numbers[0], 10) || null
    }
  }

  rest = rest.slice(typeMatch[0].length).trim()
  if (/\bUNSIGNED\b/i.test(rest)) {
    column.extra.unsigned = true
    rest = rest.replace(/\bUNSIGNED\b/i, '').trim()
  }
  rest = rest.replace(/\bCHARACTER\s+SET\s+\w+/i, '').trim()
  rest = rest.replace(/\bCOLLATE\s+\w+/i, '').trim()

  if (/\bAUTO_INCREMENT\b/i.test(rest)) {
    column.autoIncrement = true
    rest = rest.replace(/\bAUTO_INCREMENT\b/i, '').trim()
  }

  const defaultMatch = rest.match(/\bDEFAULT\s+('(?:''|[^'])*'|[\w()]+(?:\(\d*\))?)/i)
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1].trim()
    rest = rest.replace(defaultMatch[0], '').trim()
  }

  const onUpdateMatch = rest.match(/\bON\s+UPDATE\s+(\S+(?:\(\d*\))?)/i)
  if (onUpdateMatch) column.extra.onUpdate = onUpdateMatch[1]
  rest = rest.replace(/\bON\s+UPDATE\s+\S+(?:\(\d*\))?/i, '').trim()

  if (/\bNOT\s+NULL\b/i.test(rest)) column.nullable = false
  const commentMatch = rest.match(/\bCOMMENT\s+'((?:''|[^'])*)'/i)
  if (commentMatch) column.comment = commentMatch[1].replace(/''/g, "'")
  return column
}

export function parsePostgresColumnDefinition(definitionValue: unknown): ColumnModel | null {
  const definition = String(definitionValue || '')
  const match = definition.match(/^["']?(\w+)["']?\s+(.+)$/i)
  if (!match) return null

  const column = createDdlColumnModel() as ColumnModel
  column.name = match[1]
  let rest = match[2].trim()

  if (/^BIGSERIAL\b/i.test(rest)) {
    column.type = 'BIGSERIAL'
    column.autoIncrement = true
    rest = rest.replace(/^BIGSERIAL/i, '').trim()
  } else if (/^SERIAL\b/i.test(rest)) {
    column.type = 'SERIAL'
    column.autoIncrement = true
    rest = rest.replace(/^SERIAL/i, '').trim()
  } else if (/^SMALLSERIAL\b/i.test(rest)) {
    column.type = 'SMALLSERIAL'
    column.autoIncrement = true
    rest = rest.replace(/^SMALLSERIAL/i, '').trim()
  } else {
    const typeMatch = rest.match(
      /^(DOUBLE\s+PRECISION|CHARACTER\s+VARYING|TIMESTAMP\s+WITH(?:OUT)?\s+TIME\s+ZONE|INTERVAL\s+(?:YEAR|DAY)\s+TO\s+(?:MONTH|SECOND)|BIT\s+VARYING|\w+)(?:\(([^)]+)\))?\s*(?:\[\s*\])?\s*(?=DEFAULT|NOT|NULL|CONSTRAINT|CHECK|UNIQUE|PRIMARY|REFERENCES|GENERATED|,|\)|$)/i
    )
    if (typeMatch) {
      column.type = typeMatch[1].trim().toUpperCase()
      if (typeMatch[2]) {
        const numbers = typeMatch[2].split(',').map((item) => item.trim())
        if (/NUMERIC|DECIMAL/i.test(column.type)) {
          column.precision = parseInt(numbers[0], 10) || null
          column.scale = numbers[1] !== undefined ? parseInt(numbers[1], 10) : null
        } else if (/TIMESTAMP|TIME/i.test(column.type)) {
          column.precision = parseInt(numbers[0], 10) || null
        } else {
          column.length = parseInt(numbers[0], 10) || null
        }
      }
      rest = rest.slice(typeMatch[0].length).trim()
    }
  }

  column.rawType =
    column.type +
    (column.length
      ? `(${column.length})`
      : column.precision
        ? `(${column.precision}${column.scale != null ? `,${column.scale}` : ''})`
        : '')

  const defaultMatch = rest.match(/\bDEFAULT\s+('(?:''|[^'])*'|[\w():.']+(?:\([\d]*\))?)/i)
  if (defaultMatch) {
    column.defaultValue = defaultMatch[1].trim()
    rest = rest.replace(defaultMatch[0], '').trim()
  }

  if (/\bNOT\s+NULL\b/i.test(rest)) column.nullable = false
  return column
}
