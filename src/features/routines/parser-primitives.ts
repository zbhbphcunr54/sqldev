export interface RoutineParameterModel {
  name: string
  direction: string
  type: string
  defaultVal: string | null
}

export interface RoutineVariableModel {
  name?: string
  type?: string
  defaultVal?: string | null
  raw?: string
  cursor?: boolean
  query?: string
}

export interface RoutineDeclarationExtractionResult {
  vars: RoutineVariableModel[]
  body: string
}

function normalizeRoutineDirection(direction: string): string {
  const normalized = direction.toUpperCase().replace(/\s+/g, ' ').trim()
  return normalized === 'INOUT' ? 'IN OUT' : normalized
}

function parseFallbackRoutineParam(
  value: string,
  defaultDirection = 'IN'
): RoutineParameterModel | null {
  const fallback = value.match(/^(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i)
  if (!fallback) return null
  return {
    name: fallback[1],
    direction: defaultDirection,
    type: fallback[2].trim(),
    defaultVal: fallback[3] || null
  }
}

export function splitRoutineParamList(paramStr: string): string[] {
  const result: string[] = []
  let current = ''
  let depth = 0

  for (let index = 0; index < paramStr.length; index += 1) {
    const char = paramStr[index]
    if (char === '(') {
      depth += 1
      current += char
      continue
    }
    if (char === ')') {
      depth -= 1
      current += char
      continue
    }
    if (char === ',' && depth === 0) {
      const trimmed = current.trim()
      if (trimmed) result.push(trimmed)
      current = ''
      continue
    }
    current += char
  }

  const trailing = current.trim()
  if (trailing) result.push(trailing)
  return result
}

export function parseOracleRoutineParam(paramStr: string): RoutineParameterModel | null {
  const trimmed = paramStr.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\w+)\s+(IN\s+OUT|IN|OUT)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i)
  if (match) {
    return {
      name: match[1],
      direction: normalizeRoutineDirection(match[2]),
      type: match[3].trim(),
      defaultVal: match[4] || null
    }
  }
  return parseFallbackRoutineParam(trimmed)
}

export function parseMySqlRoutineParam(paramStr: string): RoutineParameterModel | null {
  const trimmed = paramStr.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(IN\s*OUT|INOUT|IN|OUT)\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i)
  if (match) {
    return {
      name: match[2],
      direction: normalizeRoutineDirection(match[1]),
      type: match[3].trim(),
      defaultVal: match[4] || null
    }
  }
  return parseFallbackRoutineParam(trimmed)
}

export function parsePostgresRoutineParam(paramStr: string): RoutineParameterModel | null {
  const trimmed = paramStr.trim()
  if (!trimmed) return null

  const directionFirst = trimmed.match(
    /^(IN\s*OUT|INOUT|IN|OUT)\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i
  )
  if (directionFirst) {
    return {
      name: directionFirst[2],
      direction: normalizeRoutineDirection(directionFirst[1]),
      type: directionFirst[3].trim(),
      defaultVal: directionFirst[4] || null
    }
  }

  const nameFirst = trimmed.match(
    /^(\w+)\s+(IN\s*OUT|INOUT|IN|OUT)\s+(.+?)(?:\s+DEFAULT\s+(.+))?$/i
  )
  if (nameFirst) {
    return {
      name: nameFirst[1],
      direction: normalizeRoutineDirection(nameFirst[2]),
      type: nameFirst[3].trim(),
      defaultVal: nameFirst[4] || null
    }
  }

  return parseFallbackRoutineParam(trimmed)
}

export function parseOracleVariableDeclarations(declBlock: string): RoutineVariableModel[] {
  const vars: RoutineVariableModel[] = []
  if (!declBlock) return vars

  const parts = declBlock.split(';')
  for (const part of parts) {
    const statement = part.trim()
    if (!statement) continue

    if (/^--/.test(statement)) {
      vars.push({ raw: `${statement};` })
      continue
    }

    const cursorMatch = statement.match(/^CURSOR\s+(\w+)\s+IS\s+([\s\S]+)$/i)
    if (cursorMatch) {
      vars.push({
        cursor: true,
        name: cursorMatch[1],
        query: cursorMatch[2].trim()
      })
      continue
    }

    const variableMatch = statement.match(/^(\w+)\s+(.+?)(?:\s*:=\s*(.+))?$/i)
    if (variableMatch) {
      vars.push({
        name: variableMatch[1],
        type: variableMatch[2].trim(),
        defaultVal: variableMatch[3] ? variableMatch[3].trim() : null
      })
      continue
    }

    vars.push({ raw: `${statement};` })
  }

  return vars
}

export function extractMySqlRoutineDeclarations(
  bodyContent: string
): RoutineDeclarationExtractionResult {
  const vars: RoutineVariableModel[] = []
  const nonDeclLines: string[] = []
  const bodyLines = bodyContent.split('\n')

  for (const line of bodyLines) {
    if (
      /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\b/i.test(line) ||
      /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(line)
    ) {
      nonDeclLines.push(line)
      continue
    }

    const declMatch = line.match(/^\s*DECLARE\s+(\w+)\s+(.+?)(?:\s+DEFAULT\s+(.+?))?\s*;\s*$/i)
    if (declMatch) {
      vars.push({
        name: declMatch[1],
        type: declMatch[2].trim(),
        defaultVal: declMatch[3] ? declMatch[3].trim() : null
      })
      continue
    }

    nonDeclLines.push(line)
  }

  return { vars, body: nonDeclLines.join('\n') }
}

export function extractPostgresRoutineDeclarations(
  inner: string
): RoutineDeclarationExtractionResult {
  const vars: RoutineVariableModel[] = []
  const declareMatch = inner.match(/\bDECLARE\b([\s\S]*?)\bBEGIN\b/i)

  if (declareMatch) {
    const declParts = declareMatch[1].split(';')
    for (const part of declParts) {
      const statement = part.trim()
      if (!statement) continue

      const cursorMatch = statement.match(/^(\w+)\s+CURSOR\s+FOR\s+([\s\S]+)$/i)
      if (cursorMatch) {
        vars.push({
          name: cursorMatch[1],
          cursor: true,
          query: cursorMatch[2].trim(),
          type: 'CURSOR'
        })
        continue
      }

      const variableMatch = statement.match(/^(\w+)\s+(.+?)(?:\s*:=\s*(.+))?$/i)
      if (variableMatch) {
        vars.push({
          name: variableMatch[1],
          type: variableMatch[2].trim(),
          defaultVal: variableMatch[3] ? variableMatch[3].trim() : null
        })
      }
    }
  }

  const bodyMatch = inner.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*;?\s*$/i)
  return {
    vars,
    body: bodyMatch ? bodyMatch[1] : inner
  }
}
