export interface FormatSqlOptions {
  preserveBlocks?: boolean
}

export interface FormatSqlDisplayOptions {
  sqlType?: 'ddl' | 'function' | 'procedure' | 'auto'
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function finalizeDisplayText(text: string): string {
  return normalizeLineEndings(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function looksLikeSqlStart(text: string): boolean {
  return /^(?:create|alter|drop|comment|select|insert|update|delete|merge|with|begin|declare|grant|revoke|truncate)\b/i.test(text)
}

function unwrapLikelySqlWrapper(text: string): string {
  const trimmed = text.trim()
  if (trimmed.length < 2) return trimmed

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim()
    if (looksLikeSqlStart(inner)) return inner
  }

  return trimmed
}

export function splitSqlStatements(sql: string): string[] {
  const result: string[] = []
  let buffer = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inBlockComment = false
  let index = 0

  while (index < sql.length) {
    const char = sql[index]

    if (inBlockComment) {
      if (char === '*' && index + 1 < sql.length && sql[index + 1] === '/') {
        inBlockComment = false
        buffer += ' '
        index += 2
      } else {
        index++
      }
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      buffer += char
      if (inSingleQuote && index + 1 < sql.length && sql[index + 1] === "'") {
        buffer += "'"
        index += 2
        continue
      }
      inSingleQuote = !inSingleQuote
      index++
      continue
    }

    if (char === '"' && !inSingleQuote) {
      buffer += char
      inDoubleQuote = !inDoubleQuote
      index++
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '/' && index + 1 < sql.length && sql[index + 1] === '*') {
        inBlockComment = true
        index += 2
        continue
      }

      if (char === '-' && index + 1 < sql.length && sql[index + 1] === '-') {
        while (index < sql.length && sql[index] !== '\n') index++
        buffer += '\n'
        continue
      }

      if (char === ';') {
        const statement = buffer.trim()
        if (statement && !/^--/.test(statement)) result.push(statement)
        buffer = ''
        index++
        continue
      }
    }

    buffer += char
    index++
  }

  const tail = buffer.trim()
  if (tail && !/^--/.test(tail)) result.push(tail)
  return result
}

export function formatSqlText(text: string, options: FormatSqlOptions = {}): string {
  const raw = String(text || '')
    .replace(/\r\n/g, '\n')
    .trim()

  if (!raw) return ''

  if (options.preserveBlocks) {
    return raw.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
  }

  const statements = splitSqlStatements(raw)
  if (!statements.length) return raw

  return (
    statements
      .map((statement) =>
        statement
          .replace(/\s+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim()
      )
      .join(';\n\n') + ';'
  )
}

function isRoutineLikeSql(text: string, sqlType: FormatSqlDisplayOptions['sqlType']): boolean {
  if (sqlType === 'function' || sqlType === 'procedure') return true

  return /\bcreate\s+(?:or\s+replace\s+)?(?:function|procedure|package|trigger)\b/i.test(text)
    || /^\s*(?:declare|begin)\b/i.test(text)
}

function splitSqlStatementsPreserve(sql: string): string[] {
  const statements: string[] = []
  let buffer = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = index + 1 < sql.length ? sql[index + 1] : ''

    if (inLineComment) {
      buffer += char
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      buffer += char
      if (char === '*' && next === '/') {
        buffer += next
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      buffer += char + next
      index += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      buffer += char + next
      index += 1
      inBlockComment = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      buffer += char
      if (inSingleQuote && next === "'") {
        buffer += next
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      buffer += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote) {
      const statement = buffer.trim()
      if (statement) statements.push(statement)
      buffer = ''
      continue
    }

    buffer += char
  }

  const tail = buffer.trim()
  if (tail) statements.push(tail)
  return statements
}

function insertLineBreaksAfterSemicolons(text: string, separator: string): string {
  let result = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = index + 1 < text.length ? text[index + 1] : ''

    if (inLineComment) {
      result += char
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      result += char
      if (char === '*' && next === '/') {
        result += next
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      result += char + next
      index += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      result += char + next
      index += 1
      inBlockComment = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      result += char
      if (inSingleQuote && next === "'") {
        result += next
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      result += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    result += char

    if (char !== ';' || inSingleQuote || inDoubleQuote) continue

    let cursor = index + 1
    while (cursor < text.length && /\s/.test(text[cursor])) {
      cursor += 1
    }
    if (cursor >= text.length) continue

    result += separator
    index = cursor - 1
  }

  return result
}

function findCreateTableColumnBounds(statement: string): { openIndex: number; closeIndex: number } | null {
  if (!/^\s*create\s+(?:global\s+temporary\s+)?table\b/i.test(statement)) {
    return null
  }

  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let openIndex = -1
  let depth = 0

  for (let index = 0; index < statement.length; index += 1) {
    const char = statement[index]
    const next = index + 1 < statement.length ? statement[index + 1] : ''

    if (inLineComment) {
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      index += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      index += 1
      inBlockComment = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      if (inSingleQuote && next === "'") {
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (inSingleQuote || inDoubleQuote) continue

    if (char === '(') {
      if (openIndex < 0) openIndex = index
      depth += 1
      continue
    }

    if (char === ')' && openIndex >= 0) {
      depth -= 1
      if (depth === 0) {
        return { openIndex, closeIndex: index }
      }
    }
  }

  return null
}

function splitTopLevelCommaSegments(text: string): string[] {
  const segments: string[] = []
  let buffer = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false
  let depth = 0

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = index + 1 < text.length ? text[index + 1] : ''

    if (inLineComment) {
      buffer += char
      if (char === '\n') inLineComment = false
      continue
    }

    if (inBlockComment) {
      buffer += char
      if (char === '*' && next === '/') {
        buffer += next
        index += 1
        inBlockComment = false
      }
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '-' && next === '-') {
      buffer += char + next
      index += 1
      inLineComment = true
      continue
    }

    if (!inSingleQuote && !inDoubleQuote && char === '/' && next === '*') {
      buffer += char + next
      index += 1
      inBlockComment = true
      continue
    }

    if (char === "'" && !inDoubleQuote) {
      buffer += char
      if (inSingleQuote && next === "'") {
        buffer += next
        index += 1
        continue
      }
      inSingleQuote = !inSingleQuote
      continue
    }

    if (char === '"' && !inSingleQuote) {
      buffer += char
      inDoubleQuote = !inDoubleQuote
      continue
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') depth += 1
      else if (char === ')' && depth > 0) depth -= 1
      else if (char === ',' && depth === 0) {
        const segment = buffer.trim()
        if (segment) segments.push(segment)
        buffer = ''
        continue
      }
    }

    buffer += char
  }

  const tail = buffer.trim()
  if (tail) segments.push(tail)
  return segments
}

function formatCreateTableSuffix(suffix: string): string {
  const compact = suffix.replace(/\s+/g, ' ').trim()
  if (!compact) return ''

  return compact.replace(
    /\s+(?=(?:ORGANIZATION|TABLESPACE|PARTITION|SUBPARTITION|PCTFREE|PCTUSED|INITRANS|MAXTRANS|LOGGING|NOLOGGING|COMPRESS|NOCOMPRESS|STORAGE|PARALLEL|NOPARALLEL)\b)/gi,
    '\n'
  )
}

function formatCreateTableStatement(statement: string): string {
  const bounds = findCreateTableColumnBounds(statement)
  if (!bounds) return statement.trim()

  const prefix = statement.slice(0, bounds.openIndex).trim()
  const body = statement.slice(bounds.openIndex + 1, bounds.closeIndex)
  const suffix = statement.slice(bounds.closeIndex + 1).trim()
  const segments = splitTopLevelCommaSegments(body)

  if (segments.length < 2) {
    return statement.trim()
  }

  const formattedBody = segments.map((segment) => `  ${segment}`).join(',\n')
  const formattedSuffix = formatCreateTableSuffix(suffix)

  return formattedSuffix
    ? `${prefix} (\n${formattedBody}\n)\n${formattedSuffix}`
    : `${prefix} (\n${formattedBody}\n)`
}

function formatRoutineSqlForDisplay(text: string): string {
  if (text.includes('\n')) return finalizeDisplayText(text)

  return finalizeDisplayText(
    insertLineBreaksAfterSemicolons(text, '\n')
      .replace(/\b(IS|AS)\s+BEGIN\b/g, '$1\nBEGIN')
      .replace(/\bDECLARE\s+BEGIN\b/g, 'DECLARE\nBEGIN')
  )
}

function formatStatementForDisplay(statement: string): string {
  const trimmed = statement.trim()
  if (!trimmed) return ''

  if (/^\s*create\s+(?:global\s+temporary\s+)?table\b/i.test(trimmed)) {
    return formatCreateTableStatement(trimmed)
  }

  return trimmed
}

export function formatSqlForDisplay(text: string, options: FormatSqlDisplayOptions = {}): string {
  const raw = unwrapLikelySqlWrapper(finalizeDisplayText(String(text || '')))
  if (!raw) return ''

  if (isRoutineLikeSql(raw, options.sqlType)) {
    return formatRoutineSqlForDisplay(raw)
  }

  if (raw.includes('\n')) return raw

  const statements = splitSqlStatementsPreserve(raw)
  const hasTrailingSemicolon = /;\s*$/.test(raw)
  if (statements.length <= 1) {
    const single = formatStatementForDisplay(hasTrailingSemicolon ? raw.replace(/;\s*$/, '') : raw)
    return hasTrailingSemicolon ? `${single};` : single
  }

  const formatted = statements
    .map((statement) => formatStatementForDisplay(statement))
    .filter(Boolean)
    .join(';\n\n')

  return hasTrailingSemicolon ? `${formatted};` : formatted
}
