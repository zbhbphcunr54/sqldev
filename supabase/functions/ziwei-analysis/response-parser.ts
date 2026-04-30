const MIN_ZIWEI_PALACE_COUNT = 12

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
    // Some providers wrap JSON in prose; fall back to first JSON object.
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

export function normalizeStringArray(input: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (let i = 0; i < input.length; i += 1) {
    if (out.length >= maxItems) break
    const v = toSafeString(input[i], maxLen)
    if (v) out.push(v)
  }
  return out
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

  const sectionInput = Array.isArray(raw.sections) ? raw.sections : []
  const sections = sectionInput
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
    .filter(Boolean)
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
  const disclaimer = toSafeString(raw.disclaimer, 220) || '说明：解读仅供参考，请结合现实决策与专业意见。'
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
  const titles = ['核心解读', '事业与财运', '关系与协作', '健康与节律', '当前阶段']
  const sectionSource = blocks.length > 1 ? blocks.slice(1, 6) : [text]
  const sections = sectionSource
    .map((item, idx) => ({
      title: titles[idx] || `维度${idx + 1}`,
      summary: toSafeString(item, 900),
      evidence: [] as string[],
      advice: [] as string[]
    }))
    .filter((item) => !!item.summary)
  if (!sections.length) return null
  const overview = toSafeString(blocks[0] || text, 220) || toSafeString(text, 220)
  if (!overview) return null
  return { overview, sections, yearFocus: null, nextActions: [], disclaimer: '说明：解读仅供参考，请结合现实决策与专业意见。' }
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
