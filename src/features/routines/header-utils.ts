export interface HeaderWithParamsMatch {
  name: string
  paramStr: string
  afterParams: string
}

function extractParenBlock(source: string, startIndex: number): { content: string; after: string } {
  let depth = 1
  let cursor = startIndex
  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '(') depth += 1
    else if (source[cursor] === ')') depth -= 1
    if (depth > 0) cursor += 1
  }
  return {
    content: source.substring(startIndex, cursor),
    after: source.substring(cursor + 1).trim()
  }
}

export function extractRoutineHeaderWithParams(
  source: string,
  prefixRe: RegExp
): HeaderWithParamsMatch | null {
  const match = source.match(prefixRe)
  if (!match || typeof match.index !== 'number') return null
  const block = extractParenBlock(source, match.index + match[0].length)
  return {
    name: match[1],
    paramStr: block.content,
    afterParams: block.after
  }
}

export function stripTrailingOracleStyleComments(source: string): string {
  return source.replace(/(\bEND\b\s*\w*\s*;?)\s*(?:\/\s*)?\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1')
}

export function stripTrailingPostgresDollarComments(source: string): string {
  return source.replace(/(\$\$\s*;?)\s*(?:\n\s*--[^\n]*)*\s*$/i, '$1')
}
