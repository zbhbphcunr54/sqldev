interface LenientJsonStringResult {
  value: string
  closed: boolean
}

export interface SqlPreviewDelta {
  text: string
  replace: boolean
}

function parseLenientJsonString(input: string): LenientJsonStringResult {
  let value = ''

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]

    if (ch === '"') {
      return { value, closed: true }
    }

    if (ch !== '\\') {
      value += ch
      continue
    }

    if (i + 1 >= input.length) {
      break
    }

    const next = input[i + 1]
    switch (next) {
      case '"':
      case '\\':
      case '/':
        value += next
        i += 1
        break
      case 'b':
        value += '\b'
        i += 1
        break
      case 'f':
        value += '\f'
        i += 1
        break
      case 'n':
        value += '\n'
        i += 1
        break
      case 'r':
        value += '\r'
        i += 1
        break
      case 't':
        value += '\t'
        i += 1
        break
      case 'u': {
        const hex = input.slice(i + 2, i + 6)
        if (hex.length < 4 || !/^[0-9a-fA-F]{4}$/.test(hex)) {
          return { value, closed: false }
        }
        value += String.fromCharCode(Number.parseInt(hex, 16))
        i += 5
        break
      }
      default:
        value += next
        i += 1
        break
    }
  }

  return { value, closed: false }
}

function normalizeLineEndings(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function decodeEscapesOnce(input: string): { value: string; changed: boolean } {
  let value = ''
  let changed = false

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]

    if (ch !== '\\') {
      value += ch
      continue
    }

    if (i + 1 >= input.length) {
      value += ch
      continue
    }

    const next = input[i + 1]
    if (next === 'r' && i + 3 < input.length && input[i + 2] === '\\' && input[i + 3] === 'n') {
      value += '\n'
      changed = true
      i += 3
      continue
    }

    switch (next) {
      case '"':
        value += '"'
        changed = true
        i += 1
        break
      case '\\':
        value += '\\'
        changed = true
        i += 1
        break
      case '/':
        value += '/'
        changed = true
        i += 1
        break
      case 'b':
        value += '\b'
        changed = true
        i += 1
        break
      case 'f':
        value += '\f'
        changed = true
        i += 1
        break
      case 'n':
        value += '\n'
        changed = true
        i += 1
        break
      case 'r':
        value += '\n'
        changed = true
        i += 1
        break
      case 't':
        value += '\t'
        changed = true
        i += 1
        break
      case 'u': {
        const hex = input.slice(i + 2, i + 6)
        if (hex.length === 4 && /^[0-9a-fA-F]{4}$/.test(hex)) {
          value += String.fromCharCode(Number.parseInt(hex, 16))
          changed = true
          i += 5
          break
        }
        value += ch
        break
      }
      default:
        value += ch
        break
    }
  }

  const normalized = normalizeLineEndings(value)
  return { value: normalized, changed: changed || normalized !== input }
}

export function decodeEscapedSqlText(text: string): string {
  if (!text) return ''

  let current = normalizeLineEndings(text)
  for (let pass = 0; pass < 6; pass += 1) {
    const { value, changed } = decodeEscapesOnce(current)
    if (!changed || value === current) {
      return value
    }
    current = value
  }

  return current
}

export function extractConvertedSqlPreview(raw: string): string | null {
  const keyIndex = raw.indexOf('"converted_sql"')
  if (keyIndex < 0) return null

  const colonIndex = raw.indexOf(':', keyIndex)
  if (colonIndex < 0) return null

  let valueStart = colonIndex + 1
  while (valueStart < raw.length && /\s/.test(raw[valueStart])) {
    valueStart += 1
  }

  if (valueStart >= raw.length || raw[valueStart] !== '"') {
    return null
  }

  return parseLenientJsonString(raw.slice(valueStart + 1)).value
}

export function diffSqlPreview(previous: string, next: string): SqlPreviewDelta | null {
  if (next === previous) return null
  if (next.startsWith(previous)) {
    return {
      text: next.slice(previous.length),
      replace: false
    }
  }
  return {
    text: next,
    replace: true
  }
}
