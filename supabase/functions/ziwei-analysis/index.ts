import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

function buildAiEndpoint(raw: string): string {
  const base = String(raw || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

const AI_BASE_URL_RAW = (Deno.env.get('ZIWEI_AI_BASE_URL') || 'https://api.openai.com/v1').trim()
const AI_ENDPOINT = buildAiEndpoint(AI_BASE_URL_RAW)
const AI_MODEL = (Deno.env.get('ZIWEI_AI_MODEL') || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini'
const AI_API_KEY = (Deno.env.get('ZIWEI_AI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '').trim()
const AI_TIMEOUT_MS = parsePositiveInt(Deno.env.get('ZIWEI_AI_TIMEOUT_MS'), 20_000)
const AI_MAX_CHART_CHARS = parsePositiveInt(Deno.env.get('ZIWEI_AI_MAX_CHART_CHARS'), 12_000)
const AI_QA_MAX_QUESTION_CHARS = parsePositiveInt(Deno.env.get('ZIWEI_AI_QA_MAX_QUESTION_CHARS'), 220)
const AI_ANALYSIS_MAX_TOKENS = parsePositiveInt(Deno.env.get('ZIWEI_AI_ANALYSIS_MAX_TOKENS'), 900)
const AI_QA_MAX_TOKENS = parsePositiveInt(Deno.env.get('ZIWEI_AI_QA_MAX_TOKENS'), 520)
const AI_ANALYSIS_TEMPLATE = (Deno.env.get('ZIWEI_AI_ANALYSIS_TEMPLATE') || '').trim()
const AI_QA_TEMPLATE = (Deno.env.get('ZIWEI_AI_QA_TEMPLATE') || '').trim()
const AI_QA_SUGGESTIONS_JSON = (Deno.env.get('ZIWEI_AI_QA_SUGGESTIONS') || '').trim()

const ZIWEI_ALLOWED_EMAILS = (Deno.env.get('ZIWEI_ALLOWED_EMAILS') || '')
  .split(',')
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('ZIWEI_AI_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('ZIWEI_AI_RATE_LIMIT_MAX_REQUESTS'), 6)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('ZIWEI_AI_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('ZIWEI_AI_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const rateLimiter = createRateLimiter({
  scope: 'ziwei_analysis',
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  trackMax: RATE_LIMIT_TRACK_MAX,
  storeMode: RATE_LIMIT_STORE_MODE
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toSafeString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return ''
  const out = raw.replace(/\u0000/g, '').trim()
  if (!out) return ''
  return out.slice(0, maxLen)
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const text = String(raw || '').trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return isPlainObject(parsed) ? parsed : null
  } catch (_err) {
    // continue
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

function normalizeStringArray(input: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (let i = 0; i < input.length; i += 1) {
    if (out.length >= maxItems) break
    const v = toSafeString(input[i], maxLen)
    if (v) out.push(v)
  }
  return out
}

function parseJsonArrayOfStrings(raw: string): string[] {
  const text = String(raw || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => toSafeString(item, 160))
      .filter(Boolean)
      .slice(0, 12)
  } catch (_err) {
    return []
  }
}

function buildQaConfig() {
  const suggestions = parseJsonArrayOfStrings(AI_QA_SUGGESTIONS_JSON)
  return { suggestions }
}

function normalizeChartPayload(raw: unknown): string {
  if (!raw) return ''
  let text = ''
  try {
    text = typeof raw === 'string' ? raw : JSON.stringify(raw)
  } catch (_err) {
    text = ''
  }
  if (!text) return ''
  return text.length > AI_MAX_CHART_CHARS ? text.slice(0, AI_MAX_CHART_CHARS) : text
}

function buildAiUpstreamError(status: number): Error {
  if (status === 429) return new Error('ai_upstream_rate_limited')
  if (status === 408 || status === 504) return new Error('ai_upstream_timeout')
  if (status === 401 || status === 403) return new Error('ai_upstream_auth_failed')
  if (status === 404) return new Error('ai_upstream_not_found')
  if (status >= 500) return new Error('ai_upstream_unavailable')
  return new Error('ai_upstream_bad_response')
}

function normalizeAnalysis(raw: unknown): Record<string, unknown> | null {
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

  return {
    overview,
    sections,
    yearFocus,
    nextActions,
    disclaimer
  }
}

function buildAnalysisSystemPrompt(style: 'simple' | 'pro'): string {
  const baseLines = [
    'You are a professional Zi Wei Dou Shu analyst.',
    'Write all field contents in Simplified Chinese.',
    'Output strictly one JSON object. No markdown and no code fence.',
    'JSON schema:',
    '{',
    '  "overview": "80-220 chars summary",',
    '  "sections": [',
    '    {"title":"Core Personality","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Career and Finance","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Relationship and Collaboration","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Health and Rhythm","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Current Decade and Annual Focus","summary":"...","evidence":["..."],"advice":["..."]}',
    '  ],',
    '  "yearFocus":{"summary":"...","opportunities":["..."],"risks":["..."]},',
    '  "nextActions":["...","...","..."],',
    '  "disclaimer":"..."',
    '}',
    'Rules:',
    '1) Must reference concrete chart evidence (palaces/stars/hua/da-xian/liu-nian).',
    '2) Avoid generic one-size-fits-all wording.',
    '3) Keep tone practical and avoid absolute claims.',
    style === 'pro'
      ? '4) Pro mode: section summaries can be deeper.'
      : '4) Simple mode: section summaries should be concise.'
  ]
  if (!AI_ANALYSIS_TEMPLATE) return baseLines.join('\n')
  const template = AI_ANALYSIS_TEMPLATE.replace(/\{\{style\}\}/g, style)
  return [...baseLines, '', 'Template requirements configured on server:', template].join('\n')
}

function normalizeQaTemplate(): string {
  if (AI_QA_TEMPLATE) return AI_QA_TEMPLATE
  return [
    'You are a professional Zi Wei Dou Shu consultant.',
    'Reply in Simplified Chinese only.',
    'Use chart evidence whenever possible (palace/star/hua/decade/year).',
    'Use this structure:',
    '[问题] {{question}}',
    '[核心结论] ...',
    '[命盘证据] ...',
    '[行动建议] ...',
    '[风险提示] ...'
  ].join('\n')
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

function extractAiText(body: Record<string, unknown> | null): { text: string; finishReason: string } {
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

function buildFallbackFromText(raw: string): Record<string, unknown> | null {
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

async function fetchAiChat(payload: Record<string, unknown>, signal: AbortSignal): Promise<Record<string, unknown>> {
  const maxAttempts = 2
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    })

    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 408 || res.status === 504
      if (retryable && attempt < maxAttempts) {
        await sleep(220 * attempt)
        continue
      }
      throw buildAiUpstreamError(res.status)
    }

    const text = await res.text()
    const parsed = parseJsonLoose(text)
    if (parsed) return parsed

    if (attempt < maxAttempts) {
      await sleep(220 * attempt)
      continue
    }
    throw new Error('ai_upstream_bad_response')
  }
  throw new Error('ai_upstream_unavailable')
}

async function requestAiAnalysis(chartPayload: string, style: 'simple' | 'pro'): Promise<Record<string, unknown>> {
  if (!AI_ENDPOINT || !AI_API_KEY) throw new Error('ai_backend_not_configured')

  const now = new Date()
  const todayText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const systemPrompt = buildAnalysisSystemPrompt(style)
  const userPrompt = [`Current date: ${todayText}`, 'Structured chart payload as JSON string:', chartPayload].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const requestOnce = async (maxTokens: number) => {
      return await fetchAiChat({
        model: AI_MODEL,
        temperature: 0.55,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }, controller.signal)
    }

    let body = await requestOnce(AI_ANALYSIS_MAX_TOKENS)
    let extracted = extractAiText(body)
    let normalized = normalizeAnalysis(parseJsonLoose(extracted.text))

    if (!normalized && extracted.finishReason === 'length') {
      const retryTokens = Math.min(2_200, Math.max(AI_ANALYSIS_MAX_TOKENS + 500, Math.floor(AI_ANALYSIS_MAX_TOKENS * 1.8)))
      body = await requestOnce(retryTokens)
      extracted = extractAiText(body)
      normalized = normalizeAnalysis(parseJsonLoose(extracted.text))
    }

    if (!normalized) normalized = buildFallbackFromText(extracted.text)
    if (!normalized) throw new Error('ai_response_invalid')
    return normalized
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

async function requestAiQa(chartPayload: string, question: string): Promise<string> {
  if (!AI_ENDPOINT || !AI_API_KEY) throw new Error('ai_backend_not_configured')
  const q = toSafeString(question, AI_QA_MAX_QUESTION_CHARS)
  if (!q) throw new Error('invalid_question')

  const template = normalizeQaTemplate()
  const systemPrompt = template.includes('{{question}}')
    ? template.replace(/\{\{question\}\}/g, q)
    : `${template}\n\n[问题] ${q}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const body = await fetchAiChat({
      model: AI_MODEL,
      temperature: 0.35,
      max_tokens: AI_QA_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Structured chart payload as JSON string:\n\n${chartPayload}` }
      ]
    }, controller.signal)

    const extracted = extractAiText(body)
    const answer = toSafeString(extracted.text, 8_000)
    if (!answer) throw new Error('ai_response_empty')
    return answer
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function normalizeAiErrorCode(err: unknown): string {
  const raw = String((err && (err as Error).message) || err || '').trim().toLowerCase()
  if (raw === 'invalid_question') return raw
  if (/^ai_[a-z0-9_]+$/.test(raw)) return raw
  return 'ai_analysis_failed'
}

function mapAiErrorStatus(errorCode: string): number {
  if (errorCode === 'invalid_question') return 400
  if (errorCode === 'ai_upstream_rate_limited') return 429
  if (errorCode === 'ai_request_timeout' || errorCode === 'ai_upstream_timeout') return 504
  if (errorCode.startsWith('ai_')) return 502
  return 500
}

Deno.serve(async (req) => {
  try {
    const corsHeaders = buildCorsHeaders(req)
    if (!corsHeaders) return new Response('Forbidden', { status: 403, headers: defaultCorsHeaders() })
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { ok: false, error: 'supabase_env_missing' }, corsHeaders)
    }

    const authUser = await validateBearerToken(req.headers.get('authorization'), {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (!authUser) return jsonResponse(401, { ok: false, error: 'unauthorized' }, corsHeaders)
    if (ZIWEI_ALLOWED_EMAILS.length > 0) {
      const email = String(authUser.email || '').trim().toLowerCase()
      if (!email || ZIWEI_ALLOWED_EMAILS.indexOf(email) < 0) {
        return jsonResponse(403, { ok: false, error: 'forbidden_user' }, corsHeaders)
      }
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = await req.json()
    } catch (_err) {
      return jsonResponse(400, { ok: false, error: 'invalid_json' }, corsHeaders)
    }
    if (!isPlainObject(payload)) return jsonResponse(400, { ok: false, error: 'invalid_payload' }, corsHeaders)

    const styleRaw = toSafeString(payload.style, 16)
    const style: 'simple' | 'pro' = styleRaw === 'simple' ? 'simple' : 'pro'
    const modeRaw = toSafeString(payload.mode, 16)
    const mode: 'analysis' | 'qa' | 'config' = modeRaw === 'qa' ? 'qa' : (modeRaw === 'config' ? 'config' : 'analysis')
    const signature = toSafeString(payload.signature, 160) || null

    if (mode === 'config') {
      return jsonResponse(200, { ok: true, signature, config: buildQaConfig() }, corsHeaders)
    }

    const clientIp = getClientIp(req)
    const rate = await rateLimiter.consume(`${authUser.userId}|${clientIp}`)
    if (!rate.ok) {
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, corsHeaders, { 'Retry-After': String(rate.retryAfter) })
    }

    const chartPayload = normalizeChartPayload(payload.chart)
    if (!chartPayload || chartPayload.length < 120) {
      return jsonResponse(400, { ok: false, error: 'chart_payload_too_small' }, corsHeaders)
    }

    try {
      if (mode === 'qa') {
        const question = toSafeString(payload.question, AI_QA_MAX_QUESTION_CHARS)
        if (!question) return jsonResponse(400, { ok: false, error: 'invalid_question' }, corsHeaders)
        const answer = await requestAiQa(chartPayload, question)
        return jsonResponse(200, { ok: true, signature, model: AI_MODEL, answer }, corsHeaders)
      }

      const analysis = await requestAiAnalysis(chartPayload, style)
      return jsonResponse(200, { ok: true, signature, model: AI_MODEL, analysis }, corsHeaders)
    } catch (err) {
      const errorCode = normalizeAiErrorCode(err)
      return jsonResponse(mapAiErrorStatus(errorCode), { ok: false, error: errorCode }, corsHeaders)
    }
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    console.error('[ziwei-analysis] unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
})
