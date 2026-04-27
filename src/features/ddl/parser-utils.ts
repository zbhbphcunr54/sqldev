export interface DdlTableModel {
  name: string
  comment: string
  columns: unknown[]
  primaryKey: unknown
  uniqueKeys: unknown[]
  indexes: unknown[]
  foreignKeys: unknown[]
  partition: unknown
  extra: Record<string, unknown>
}

export interface DdlColumnModel {
  name: string
  type: string
  precision: number | null
  scale: number | null
  length: number | null
  nullable: boolean
  defaultValue: unknown
  comment: string
  autoIncrement: boolean
  rawType: string
  extra: Record<string, unknown>
}

export interface DdlViewModel {
  name: string
  columns: unknown[]
  query: string
  comment: string
  withCheckOption: boolean
  checkOptionType: unknown
  readOnly: boolean
  orReplace: boolean
  force: boolean
  algorithm: unknown
}

export interface DdlCreateTableSections {
  openIndex: number
  bodyEndIndex: number
  body: string
  trailing: string
}

export function createDdlTableModel(): DdlTableModel {
  return {
    name: '',
    comment: '',
    columns: [],
    primaryKey: null,
    uniqueKeys: [],
    indexes: [],
    foreignKeys: [],
    partition: null,
    extra: {}
  }
}

export function createDdlColumnModel(): DdlColumnModel {
  return {
    name: '',
    type: '',
    precision: null,
    scale: null,
    length: null,
    nullable: true,
    defaultValue: null,
    comment: '',
    autoIncrement: false,
    rawType: '',
    extra: {}
  }
}

export function createDdlViewModel(): DdlViewModel {
  return {
    name: '',
    columns: [],
    query: '',
    comment: '',
    withCheckOption: false,
    checkOptionType: null,
    readOnly: false,
    orReplace: true,
    force: false,
    algorithm: null
  }
}

export function splitColumnDefinitions(bodyValue: unknown): string[] {
  const body = String(bodyValue || '')
  const result: string[] = []
  let buffer = ''
  let depth = 0
  let inQuote = false

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === "'" && !inQuote) {
      inQuote = true
      buffer += character
      continue
    }
    if (character === "'" && inQuote) {
      if (index + 1 < body.length && body[index + 1] === "'") {
        buffer += "''"
        index += 1
      } else {
        inQuote = false
        buffer += character
      }
      continue
    }
    if (inQuote) {
      buffer += character
      continue
    }
    if (character === '(') {
      depth += 1
      buffer += character
      continue
    }
    if (character === ')') {
      depth -= 1
      buffer += character
      continue
    }
    if (character === ',' && depth === 0) {
      result.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += character
  }

  if (buffer.trim()) result.push(buffer.trim())
  return result
}

export function extractCreateTableSections(
  statementValue: unknown,
  headerLengthValue: unknown
): DdlCreateTableSections | null {
  const statement = String(statementValue || '')
  const headerLength = Number(headerLengthValue || 0)
  const openIndex = statement.indexOf('(', Math.max(0, headerLength - 1))
  if (openIndex === -1) return null

  let depth = 0
  let inQuote = false
  for (let index = openIndex; index < statement.length; index += 1) {
    const character = statement[index]
    if (character === "'" && !inQuote) {
      inQuote = true
      continue
    }
    if (character === "'" && inQuote) {
      if (index + 1 < statement.length && statement[index + 1] === "'") {
        index += 1
      } else {
        inQuote = false
      }
      continue
    }
    if (inQuote) continue
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth === 0) {
        return {
          openIndex,
          bodyEndIndex: index,
          body: statement.slice(openIndex + 1, index),
          trailing: statement.slice(index + 1).trim()
        }
      }
    }
  }

  return null
}

export function extractParenthesizedBody(textValue: unknown): string | null {
  const text = String(textValue || '')
  const start = text.indexOf('(')
  if (start === -1) return null

  let depth = 0
  let inQuote = false
  for (let index = start; index < text.length; index += 1) {
    const character = text[index]
    if (character === "'" && !inQuote) {
      inQuote = true
      continue
    }
    if (character === "'" && inQuote) {
      if (index + 1 < text.length && text[index + 1] === "'") {
        index += 1
      } else {
        inQuote = false
      }
      continue
    }
    if (inQuote) continue
    if (character === '(') depth += 1
    if (character === ')') {
      depth -= 1
      if (depth === 0) return text.slice(start + 1, index)
    }
  }

  return text.slice(start + 1)
}

export function splitListValues(textValue: unknown): string[] {
  const text = String(textValue || '')
  const result: string[] = []
  let buffer = ''
  let inQuote = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === "'" && !inQuote) {
      inQuote = true
      buffer += character
      continue
    }
    if (character === "'" && inQuote) {
      if (index + 1 < text.length && text[index + 1] === "'") {
        buffer += "''"
        index += 1
      } else {
        inQuote = false
        buffer += character
      }
      continue
    }
    if (character === ',' && !inQuote) {
      result.push(buffer.trim())
      buffer = ''
      continue
    }
    buffer += character
  }

  if (buffer.trim()) result.push(buffer.trim())
  return result
}

export function padText(textValue: unknown, widthValue: unknown): string {
  const text = String(textValue || '')
  const width = Number(widthValue || 0)
  return text + ' '.repeat(Math.max(0, width - text.length))
}
