const MIN_ZIWEI_PALACE_COUNT = 12
const DEFAULT_ANALYSIS_DISCLAIMER = '本解读仅供参考，不构成医疗、法律、投资等专业建议，请结合现实情况理性判断。'
const DEFAULT_SECTION_TITLES = ['核心解读', '事业与财运', '感情与关系', '健康与节奏', '当前阶段']

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toSafeString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return ''
  const out = raw.replace(/\u0000/g, '').trim()
  if (!out) return ''
  return out.slice(0, maxLen)
}

export function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim()
  if (!text) return null

  try {
    const parsed = JSON.parse(text)
    return isPlainObject(parsed) ? parsed : null
  } catch (_err) {
    // Some providers wrap JSON in prose; fall back to the first JSON object.
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace < 0 || lastBrace <= firstBrace) return null

  try {
    const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1))
    return isPlainObject(parsed) ? parsed : null
  } catch (_err) {
    return null
  }
}

interface LenientJsonStringResult {
  value: string
  closed: boolean
  length: number
}

function parseLenientJsonString(input: string): LenientJsonStringResult {
  let value = ''

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]

    if (ch === '"') {
      return { value, closed: true, length: i + 1 }
    }

    if (ch !== '\\') {
      value += ch
      continue
    }

    if (i + 1 >= input.length) break

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
          return { value, closed: false, length: input.length }
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

  return { value, closed: false, length: input.length }
}

interface LenientJsonParserState {
  text: string
  index: number
}

function skipJsonWhitespace(state: LenientJsonParserState): void {
  while (state.index < state.text.length && /\s/.test(state.text[state.index])) {
    state.index += 1
  }
}

function parseLenientJsonPrimitive(state: LenientJsonParserState): unknown {
  const start = state.index
  while (state.index < state.text.length) {
    const ch = state.text[state.index]
    if (/[,\]\}\s]/.test(ch)) break
    state.index += 1
  }

  if (state.index === start) {
    if (state.index < state.text.length) state.index += 1
    return ''
  }

  const token = state.text.slice(start, state.index).trim()
  if (!token) return ''
  if (token === 'true') return true
  if (token === 'false') return false
  if (token === 'null') return null

  const numeric = Number(token)
  if (Number.isFinite(numeric)) return numeric
  return token
}

function parseLenientJsonValue(state: LenientJsonParserState): unknown {
  skipJsonWhitespace(state)
  if (state.index >= state.text.length) return null

  const ch = state.text[state.index]
  if (ch === '"') {
    const parsed = parseLenientJsonString(state.text.slice(state.index + 1))
    state.index += parsed.length + 1
    return parsed.value
  }
  if (ch === '{') return parseLenientJsonObject(state)
  if (ch === '[') return parseLenientJsonArray(state)
  return parseLenientJsonPrimitive(state)
}

function parseLenientJsonObject(state: LenientJsonParserState): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  state.index += 1

  while (state.index < state.text.length) {
    skipJsonWhitespace(state)
    if (state.index >= state.text.length) break

    const ch = state.text[state.index]
    if (ch === '}') {
      state.index += 1
      break
    }
    if (ch !== '"') break

    const key = parseLenientJsonString(state.text.slice(state.index + 1))
    state.index += key.length + 1
    skipJsonWhitespace(state)
    if (state.index >= state.text.length || state.text[state.index] !== ':') break

    state.index += 1
    const value = parseLenientJsonValue(state)
    if (key.value) out[key.value] = value

    skipJsonWhitespace(state)
    if (state.index >= state.text.length) break
    if (state.text[state.index] === ',') {
      state.index += 1
      continue
    }
    if (state.text[state.index] === '}') {
      state.index += 1
      break
    }
    break
  }

  return out
}

function parseLenientJsonArray(state: LenientJsonParserState): unknown[] {
  const out: unknown[] = []
  state.index += 1

  while (state.index < state.text.length) {
    skipJsonWhitespace(state)
    if (state.index >= state.text.length) break

    const ch = state.text[state.index]
    if (ch === ']') {
      state.index += 1
      break
    }

    out.push(parseLenientJsonValue(state))
    skipJsonWhitespace(state)
    if (state.index >= state.text.length) break
    if (state.text[state.index] === ',') {
      state.index += 1
      continue
    }
    if (state.text[state.index] === ']') {
      state.index += 1
      break
    }
    break
  }

  return out
}

function parseLenientJsonRoot(raw: string): unknown {
  const firstBrace = raw.indexOf('{')
  if (firstBrace < 0) return null

  const state: LenientJsonParserState = {
    text: raw.slice(firstBrace),
    index: 0
  }
  return parseLenientJsonValue(state)
}

function extractJsonStringField(raw: string, fieldName: string): string | null {
  const keyIndex = raw.indexOf(`"${fieldName}"`)
  if (keyIndex < 0) return null

  const colonIndex = raw.indexOf(':', keyIndex)
  if (colonIndex < 0) return null

  let valueStart = colonIndex + 1
  while (valueStart < raw.length && /\s/.test(raw[valueStart])) {
    valueStart += 1
  }

  if (valueStart >= raw.length || raw[valueStart] !== '"') return null
  const parsed = parseLenientJsonString(raw.slice(valueStart + 1))
  if (!parsed.closed) return null
  return parsed.value
}

function extractJsonStringFields(raw: string, fieldName: string, limit: number): string[] {
  const result: string[] = []
  let searchStart = 0

  while (result.length < limit) {
    const keyIndex = raw.indexOf(`"${fieldName}"`, searchStart)
    if (keyIndex < 0) break

    const colonIndex = raw.indexOf(':', keyIndex)
    if (colonIndex < 0) break

    let valueStart = colonIndex + 1
    while (valueStart < raw.length && /\s/.test(raw[valueStart])) {
      valueStart += 1
    }

    if (valueStart < raw.length && raw[valueStart] === '"') {
      const parsed = parseLenientJsonString(raw.slice(valueStart + 1))
      const text = toSafeString(parsed.value, 900)
      if (text && !result.includes(text)) result.push(text)
    }

    searchStart = keyIndex + fieldName.length + 2
  }

  return result
}

function buildPartialSections(input: unknown): Array<{
  title: string
  summary: string
  evidence: string[]
  advice: string[]
}> {
  if (!Array.isArray(input)) return []

  return input
    .slice(0, 8)
    .map((item, idx) => {
      if (!isPlainObject(item)) return null

      const rawTitle = toSafeString(item.title, 64)
      const title = rawTitle || `维度 ${idx + 1}`
      const summary = toSafeString(item.summary, 900)
      const evidence = normalizeStringArray(item.evidence, 4, 180)
      const advice = normalizeStringArray(item.advice, 4, 180)

      if (!summary && !evidence.length && !advice.length && !rawTitle) {
        return null
      }

      return {
        title,
        summary,
        evidence,
        advice
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
}

function buildPartialYearFocus(input: unknown): Record<string, unknown> | null {
  if (!isPlainObject(input)) return null

  const summary = toSafeString(input.summary, 700)
  const opportunities = normalizeStringArray(input.opportunities, 4, 180)
  const risks = normalizeStringArray(input.risks, 4, 180)

  if (!summary && !opportunities.length && !risks.length) return null

  return {
    summary,
    opportunities,
    risks
  }
}

export function extractAnalysisPreview(raw: string): string {
  const parts: string[] = []
  const overview = toSafeString(extractJsonStringField(raw, 'overview'), 1200)
  if (overview) parts.push(overview)

  let searchStart = 0
  while (parts.length < 6) {
    const summaryKey = raw.indexOf('"summary"', searchStart)
    if (summaryKey < 0) break

    const colonIndex = raw.indexOf(':', summaryKey)
    if (colonIndex < 0) break

    let valueStart = colonIndex + 1
    while (valueStart < raw.length && /\s/.test(raw[valueStart])) {
      valueStart += 1
    }

    if (valueStart < raw.length && raw[valueStart] === '"') {
      const parsed = parseLenientJsonString(raw.slice(valueStart + 1))
      const text = toSafeString(parsed.value, 900)
      if (text && !parts.includes(text)) parts.push(text)
    }

    searchStart = summaryKey + 9
  }

  return parts.join('\n\n').trim()
}

export function buildAnalysisFallbackFromPartialJson(raw: string): Record<string, unknown> | null {
  const overview = toSafeString(extractJsonStringField(raw, 'overview'), 1200)
  const titles = extractJsonStringFields(raw, 'title', 8)
  const summaries = extractJsonStringFields(raw, 'summary', 8)

  const sections = summaries
    .slice(0, 8)
    .map((summary, idx) => ({
      title: titles[idx] || `维度 ${idx + 1}`,
      summary,
      evidence: [] as string[],
      advice: [] as string[]
    }))
    .filter((item) => !!item.summary)

  const yearFocusSummary = summaries.length > sections.length
    ? summaries[sections.length]
    : toSafeString(extractJsonStringField(raw, 'yearFocus'), 700)

  if (!overview && !sections.length) return null

  return {
    overview: overview || (sections[0]?.summary ?? ''),
    sections,
    yearFocus: yearFocusSummary
      ? {
          summary: yearFocusSummary,
          opportunities: [] as string[],
          risks: [] as string[]
        }
      : null,
    nextActions: [] as string[],
    disclaimer: DEFAULT_ANALYSIS_DISCLAIMER
  }
}

export function normalizeStringArray(input: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(input)) return []

  const out: string[] = []
  for (let i = 0; i < input.length; i += 1) {
    if (out.length >= maxItems) break
    const value = toSafeString(input[i], maxLen)
    if (value) out.push(value)
  }
  return out
}

export function buildStreamingAnalysisPartial(raw: string): Record<string, unknown> | null {
  const normalized = normalizeAnalysis(parseJsonLoose(raw))
  if (normalized) return normalized

  const parsed = parseLenientJsonRoot(raw)
  if (isPlainObject(parsed)) {
    const overview = toSafeString(parsed.overview, 1200)
    const sections = buildPartialSections(parsed.sections)
    const yearFocus = buildPartialYearFocus(parsed.yearFocus)
    const nextActions = normalizeStringArray(parsed.nextActions, 6, 220)
    const disclaimer = toSafeString(parsed.disclaimer, 220)

    if (overview || sections.length || yearFocus || nextActions.length || disclaimer) {
      return {
        overview,
        sections,
        yearFocus,
        nextActions,
        disclaimer
      }
    }
  }

  return buildAnalysisFallbackFromPartialJson(raw)
}

function parseChartPayloadObject(raw: unknown): Record<string, unknown> | null {
  if (isPlainObject(raw)) return raw
  if (typeof raw !== 'string') return null

  try {
    const parsed = JSON.parse(raw)
    return isPlainObject(parsed) ? parsed : null
  } catch (_err) {
    return null
  }
}

function hasUsableCenter(center: unknown): boolean {
  if (!isPlainObject(center)) return false

  const evidence = [
    center.genderLabel,
    center.lunarText,
    center.solarText,
    center.yearGanZhi,
    center.bureauLabel,
    center.mingBranch,
    center.mingPalaceName
  ]
  return evidence.filter((item) => toSafeString(item, 80)).length >= 4
}

function hasUsablePalaces(palaces: unknown): boolean {
  if (!Array.isArray(palaces) || palaces.length < MIN_ZIWEI_PALACE_COUNT) return false

  let usableCount = 0
  for (const palaceValue of palaces.slice(0, MIN_ZIWEI_PALACE_COUNT)) {
    if (!isPlainObject(palaceValue)) continue

    const hasBranch = Boolean(toSafeString(palaceValue.branch, 16))
    const hasPalaceName = Boolean(toSafeString(palaceValue.palaceName, 32))
    const hasStars = Array.isArray(palaceValue.mainStars) || Boolean(toSafeString(palaceValue.mainStarsText, 160))
    if (hasBranch && hasPalaceName && hasStars) usableCount += 1
  }

  return usableCount >= 8
}

export function isValidChartPayloadStructure(raw: unknown): raw is Record<string, unknown> {
  const chart = parseChartPayloadObject(raw)
  if (!chart) return false

  const payloadVersion = toSafeString(chart.payloadVersion, 48)
  if (!payloadVersion.startsWith('ziwei-ai-')) return false

  return hasUsableCenter(chart.center) && hasUsablePalaces(chart.palaces)
}

export function normalizeChartPayload(raw: unknown, maxChars: number): string {
  if (!raw) return ''

  let text = ''
  try {
    text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  } catch (_err) {
    text = ''
  }

  if (!text) return ''
  return text.length > maxChars ? text.slice(0, maxChars) : text
}

export function buildAiUpstreamError(status: number): Error {
  if (status === 429) return new Error('ai_upstream_rate_limited')
  if (status === 408 || status === 504) return new Error('ai_upstream_timeout')
  if (status === 401 || status === 403) return new Error('ai_upstream_auth_failed')
  if (status === 404) return new Error('ai_upstream_not_found')
  if (status >= 500) return new Error('ai_upstream_unavailable')
  return new Error('ai_upstream_bad_response')
}

export function normalizeAnalysis(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null

  const overview = toSafeString(raw.overview, 1200)
  if (!overview) return null

  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .slice(0, 8)
    .map((item, idx) => {
      if (!isPlainObject(item)) return null

      const title = toSafeString(item.title, 64) || `Dimension ${idx + 1}`
      const summary = toSafeString(item.summary, 900)
      if (!summary) return null

      return {
        title,
        summary,
        evidence: normalizeStringArray(item.evidence, 4, 180),
        advice: normalizeStringArray(item.advice, 4, 180)
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  if (!sections.length) return null

  let yearFocus: Record<string, unknown> | null = null
  if (isPlainObject(raw.yearFocus)) {
    const summary = toSafeString(raw.yearFocus.summary, 700)
    if (summary) {
      yearFocus = {
        summary,
        opportunities: normalizeStringArray(raw.yearFocus.opportunities, 4, 180),
        risks: normalizeStringArray(raw.yearFocus.risks, 4, 180)
      }
    }
  }

  const nextActions = normalizeStringArray(raw.nextActions, 6, 220)
  const disclaimer = toSafeString(raw.disclaimer, 220) || DEFAULT_ANALYSIS_DISCLAIMER
  return { overview, sections, yearFocus, nextActions, disclaimer }
}

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content

  if (Array.isArray(content)) {
    return content.map((item) => {
      if (typeof item === 'string') return item
      if (!isPlainObject(item)) return ''
      if (typeof item.text === 'string') return item.text
      if (typeof item.content === 'string') return item.content
      if (isPlainObject(item.json)) return JSON.stringify(item.json)
      return ''
    }).join('')
  }

  if (isPlainObject(content)) {
    if (typeof content.text === 'string') return content.text
    if (typeof content.content === 'string') return content.content
    if (isPlainObject(content.json)) return JSON.stringify(content.json)
  }

  return ''
}

export function extractAiText(body: Record<string, unknown> | null): { text: string; finishReason: string } {
  if (!isPlainObject(body)) return { text: '', finishReason: '' }

  let text = ''
  let finishReason = ''
  const choices = Array.isArray(body.choices) ? body.choices : []
  const firstChoice = isPlainObject(choices[0]) ? choices[0] : null

  if (firstChoice) {
    finishReason = toSafeString(firstChoice.finish_reason, 32).toLowerCase()
    if (typeof firstChoice.text === 'string') text = firstChoice.text
    if (!text && isPlainObject(firstChoice.message)) {
      text = extractContentText(firstChoice.message.content)
    }
  }

  if (!text) text = extractContentText(body.output_text)
  if (!text && isPlainObject(body.message)) text = extractContentText(body.message.content)
  if (!text) text = toSafeString(body.answer, 8_000)
  return { text: toSafeString(text, 24_000), finishReason }
}

export function buildFallbackFromText(raw: string): Record<string, unknown> | null {
  const text = toSafeString(raw, 8_000)
  if (!text) return null

  const blocks = text
    .split(/\n{2,}/)
    .map((item) => toSafeString(item, 900))
    .filter(Boolean)

  const sectionSource = blocks.length > 1 ? blocks.slice(1, 6) : [text]
  const sections = sectionSource
    .map((item, idx) => ({
      title: DEFAULT_SECTION_TITLES[idx] || `维度 ${idx + 1}`,
      summary: toSafeString(item, 900),
      evidence: [] as string[],
      advice: [] as string[]
    }))
    .filter((item) => !!item.summary)
  if (!sections.length) return null

  const overview = toSafeString(blocks[0] || text, 220) || toSafeString(text, 220)
  if (!overview) return null

  return {
    overview,
    sections,
    yearFocus: null,
    nextActions: [],
    disclaimer: DEFAULT_ANALYSIS_DISCLAIMER
  }
}

export function normalizeAiErrorCode(err: unknown): string {
  const raw = String((err && (err as Error).message) || err || '').trim().toLowerCase()
  if (raw === 'invalid_question') return raw
  if (/^ai_[a-z0-9_]+$/.test(raw)) return raw
  return 'ai_analysis_failed'
}

export function mapAiErrorStatus(errorCode: string): number {
  if (errorCode === 'invalid_question') return 400
  if (errorCode === 'ai_upstream_rate_limited') return 429
  if (errorCode === 'ai_request_timeout' || errorCode === 'ai_upstream_timeout') return 504
  if (errorCode.startsWith('ai_')) return 502
  return 500
}
