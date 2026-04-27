export interface FormatSqlOptions {
  preserveBlocks?: boolean
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
