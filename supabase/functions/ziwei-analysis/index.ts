const DEFAULT_WEB_ORIGIN = 'https://gitzhengpeng.github.io'
const CORS_PRIMARY_ORIGIN = (Deno.env.get('CORS_PRIMARY_ORIGIN') || DEFAULT_WEB_ORIGIN).trim() || DEFAULT_WEB_ORIGIN
const CORS_ALLOWED_ORIGINS = (Deno.env.get('CORS_ALLOWED_ORIGINS') || CORS_PRIMARY_ORIGIN)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)
const ALLOWED_ORIGINS = new Set(CORS_ALLOWED_ORIGINS.length > 0 ? CORS_ALLOWED_ORIGINS : [CORS_PRIMARY_ORIGIN])
const LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i
const ALLOW_LOCALHOST_ORIGIN = /^(1|true|yes)$/i.test((Deno.env.get('ALLOW_LOCALHOST_ORIGIN') || '').trim())
const corsBaseHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const AUTH_USER_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/user` : ''

const AI_BASE_URL_RAW = (Deno.env.get('ZIWEI_AI_BASE_URL') || 'https://api.openai.com/v1').trim()
function buildAiEndpoint(raw: string): string {
  const base = String(raw || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}
const AI_ENDPOINT = buildAiEndpoint(AI_BASE_URL_RAW)
const AI_MODEL = (Deno.env.get('ZIWEI_AI_MODEL') || 'gpt-4.1-mini').trim() || 'gpt-4.1-mini'
const AI_API_KEY = (Deno.env.get('ZIWEI_AI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '').trim()
const AI_TIMEOUT_MS = parsePositiveInt(Deno.env.get('ZIWEI_AI_TIMEOUT_MS'), 20_000)
const AI_MAX_CHART_CHARS = parsePositiveInt(Deno.env.get('ZIWEI_AI_MAX_CHART_CHARS'), 24_000)
const AI_QA_MAX_QUESTION_CHARS = parsePositiveInt(Deno.env.get('ZIWEI_AI_QA_MAX_QUESTION_CHARS'), 220)
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
const rateBuckets = new Map<string, { count: number; windowStart: number }>()
let kvPromise: Promise<Deno.Kv | null> | null = null

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function defaultCorsHeaders() {
  return {
    ...corsBaseHeaders,
    'Access-Control-Allow-Origin': CORS_PRIMARY_ORIGIN,
    Vary: 'Origin'
  }
}

function buildCorsHeaders(req: Request): Record<string, string> | null {
  const origin = (req.headers.get('origin') || '').trim()
  if (!origin) return defaultCorsHeaders()
  const localhostAllowed = ALLOW_LOCALHOST_ORIGIN && LOCAL_ORIGIN_RE.test(origin)
  if (!ALLOWED_ORIGINS.has(origin) && !localhostAllowed) return null
  return {
    ...corsBaseHeaders,
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin'
  }
}

function json(status: number, body: Record<string, unknown>, corsHeaders: Record<string, string>, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extra,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

function getClientIp(req: Request): string {
  const cf = (req.headers.get('cf-connecting-ip') || '').trim()
  if (cf) return cf
  const fwd = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || ''
  if (fwd) return fwd
  const real = (req.headers.get('x-real-ip') || '').trim()
  if (real) return real
  return 'unknown'
}

function pruneRateBuckets(now: number) {
  if (rateBuckets.size <= RATE_LIMIT_TRACK_MAX) return
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key)
    if (rateBuckets.size <= RATE_LIMIT_TRACK_MAX) return
  }
  let toDrop = rateBuckets.size - RATE_LIMIT_TRACK_MAX
  for (const key of rateBuckets.keys()) {
    if (toDrop <= 0) break
    rateBuckets.delete(key)
    toDrop -= 1
  }
}

function consumeRateLimitMemory(key: string, now = Date.now()): { ok: true; remaining: number } | { ok: false; retryAfter: number } {
  let bucket = rateBuckets.get(key)
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = { count: 0, windowStart: now }
    rateBuckets.set(key, bucket)
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000))
    return { ok: false, retryAfter }
  }
  bucket.count += 1
  pruneRateBuckets(now)
  return { ok: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - bucket.count) }
}

async function getRateKv(): Promise<Deno.Kv | null> {
  if (RATE_LIMIT_STORE_MODE !== 'kv') return null
  if (!kvPromise) {
    kvPromise = Deno.openKv().then((kv) => kv).catch(() => null)
  }
  return await kvPromise
}

async function consumeRateLimit(key: string, now = Date.now()): Promise<{ ok: true; remaining: number } | { ok: false; retryAfter: number }> {
  const kv = await getRateKv()
  if (!kv) return consumeRateLimitMemory(key, now)

  const windowStart = now - (now % RATE_LIMIT_WINDOW_MS)
  const windowIndex = Math.floor(now / RATE_LIMIT_WINDOW_MS)
  const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - windowStart)) / 1000))
  const expireIn = Math.max(1_000, RATE_LIMIT_WINDOW_MS - (now - windowStart) + 1_500)
  const kvKey: Deno.KvKey = ['rate_limit', 'ziwei_analysis', key, windowIndex]

  for (let i = 0; i < 6; i += 1) {
    const entry = await kv.get<{ count: number; windowStart: number }>(kvKey)
    const count = Number(entry.value?.count || 0)
    if (count >= RATE_LIMIT_MAX_REQUESTS) return { ok: false, retryAfter }
    const next = { count: count + 1, windowStart }
    const commit = await kv.atomic().check(entry).set(kvKey, next, { expireIn }).commit()
    if (commit.ok) return { ok: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - next.count) }
  }

  return consumeRateLimitMemory(key, now)
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

async function validateBearerToken(authorization: string | null): Promise<{ userId: string; email: string } | null> {
  if (!authorization || !AUTH_USER_ENDPOINT || !SUPABASE_ANON_KEY) return null
  const raw = authorization.replace(/^Bearer\s+/i, '').trim()
  if (!raw) return null
  try {
    const res = await fetch(AUTH_USER_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${raw}`,
        apikey: SUPABASE_ANON_KEY
      }
    })
    if (!res.ok) return null
    const body = await res.json().catch(() => null)
    const userId = typeof body?.id === 'string' ? body.id : ''
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!userId) return null
    return { userId, email }
  } catch (_err) {
    return null
  }
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
  if (text.length > AI_MAX_CHART_CHARS) return text.slice(0, AI_MAX_CHART_CHARS)
  return text
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
  const sliced = text.slice(firstBrace, lastBrace + 1)
  try {
    const parsed = JSON.parse(sliced)
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
  /*
    '请解读我今年事业和收入变化重点',
    '请解读我当前大限的机会与风险',
    '请解读感情关系中最需要注意的点',
    '请给我未来三个月可执行建议',
    '请解读我这个命盘的长期优势和短板'
  ]
  const fallbackHintText = '问答模板由服务端 Secrets 控制；前端仅配置建议问题与提示语。'
  const suggestions = parseJsonArrayOfStrings(AI_QA_SUGGESTIONS_JSON)
  return {
    suggestions
  }
  */
}

/*
function normalizeAnalysis(raw: unknown): Record<string, unknown> | null {
  if (!isPlainObject(raw)) return null
  const overview = toSafeString(raw.overview, 1200)
  if (!overview) return null

  const sectionInput = Array.isArray(raw.sections) ? raw.sections : []
  const sections = sectionInput
    .slice(0, 8)
    .map((item, idx) => {
      if (!isPlainObject(item)) return null
      const title = toSafeString(item.title, 64) || `维度${idx + 1}`
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

function buildAiUpstreamError(status: number): Error {
  if (status === 429) return new Error('ai_upstream_rate_limited')
  if (status === 408 || status === 504) return new Error('ai_upstream_timeout')
  if (status === 401 || status === 403) return new Error('ai_upstream_auth_failed')
  if (status === 404) return new Error('ai_upstream_not_found')
  if (status >= 500) return new Error('ai_upstream_unavailable')
  return new Error('ai_upstream_bad_response')
}

*/
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
  const disclaimer = toSafeString(raw.disclaimer, 220) || '\u8bf4\u660e\uff1a\u89e3\u8bfb\u4ec5\u4f9b\u53c2\u8003\uff0c\u8bf7\u7ed3\u5408\u73b0\u5b9e\u51b3\u7b56\u4e0e\u4e13\u4e1a\u610f\u89c1\u3002'

  return {
    overview,
    sections,
    yearFocus,
    nextActions,
    disclaimer
  }
}

/*
async function requestAiAnalysis(chartPayload: string, style: 'simple' | 'pro'): Promise<Record<string, unknown>> {
  if (!AI_ENDPOINT || !AI_API_KEY) {
    throw new Error('AI backend not configured: missing ZIWEI_AI_API_KEY/OPENAI_API_KEY or endpoint')
  }
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayText = `${y}-${m}-${d}`
  const systemPrompt = [
    '你是专业紫微斗数解盘顾问。',
    '必须输出 JSON 对象，不要输出 markdown，不要输出代码块。',
    '输出结构：',
    '{',
    '  "overview": "总述（80-220字）",',
    '  "sections": [',
    '    {"title":"核心性格","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"事业与财务","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"感情与协作","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"健康与节奏","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"当前十年与流年","summary":"...","evidence":["..."],"advice":["..."]}',
    '  ],',
    '  "yearFocus":{"summary":"...","opportunities":["..."],"risks":["..."]},',
    '  "nextActions":["...","...","..."],',
    '  "disclaimer":"..."',
    '}',
    '要求：',
    '1) 必须引用输入命盘中的具体信息（宫位/星曜/四化/大限或流年），避免模板化空话。',
    '2) 不得出现“所有人都适用”的泛化描述。',
    '3) 语气务实，避免绝对化结论与恐吓表达。',
    style === 'pro'
      ? '4) 当前模式为专业模式：每个 section summary 适当更深入。'
      : '4) 当前模式为简洁模式：每个 section summary 简洁清晰。'
  ].join('\n')

  const userPrompt = [
    `当前日期：${todayText}`,
    '以下是结构化命盘输入（JSON 字符串）：',
    chartPayload
  ].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    })
    if (!res.ok) throw buildAiUpstreamError(res.status)
    const body = await res.json().catch(() => null)
    const content = body?.choices?.[0]?.message?.content
    const text = typeof content === 'string'
      ? content
      : (Array.isArray(content) ? content.map((item: unknown) => {
          if (typeof item === 'string') return item
          if (isPlainObject(item)) return String(item.text || '')
          return ''
        }).join('') : '')
    const parsed = parseJsonLoose(text)
    const normalized = normalizeAnalysis(parsed)
    if (!normalized) throw new Error('ai_response_invalid')
    return normalized
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('ai_request_timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

*/
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
  return [
    ...baseLines,
    '',
    'Template requirements below are configured on server and MUST be followed:',
    template
  ].join('\n')
}

async function requestAiAnalysis(chartPayload: string, style: 'simple' | 'pro'): Promise<Record<string, unknown>> {
  if (!AI_ENDPOINT || !AI_API_KEY) {
    throw new Error('AI backend not configured: missing ZIWEI_AI_API_KEY/OPENAI_API_KEY or endpoint')
  }
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const todayText = `${y}-${m}-${d}`
  const systemPrompt = buildAnalysisSystemPrompt(style)

  const userPrompt = [
    `Current date: ${todayText}`,
    'Structured chart payload as JSON string:',
    chartPayload
  ].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.8,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    })
    if (!res.ok) throw buildAiUpstreamError(res.status)
    const body = await res.json().catch(() => null)
    const content = body?.choices?.[0]?.message?.content
    const text = typeof content === 'string'
      ? content
      : (Array.isArray(content) ? content.map((item: unknown) => {
          if (typeof item === 'string') return item
          if (isPlainObject(item)) return String(item.text || '')
          return ''
        }).join('') : '')
    const parsed = parseJsonLoose(text)
    const normalized = normalizeAnalysis(parsed)
    if (!normalized) throw new Error('AI response JSON schema invalid')
    return normalized
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('AI request timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function normalizeQaTemplate(): string {
  if (AI_QA_TEMPLATE) return AI_QA_TEMPLATE
  return [
    '你是专业紫微斗数命盘顾问，请使用简体中文回答。',
    '必须引用命盘中的具体证据（宫位/星曜/四化/大限/流年）。',
    '输出结构：',
    '【问题】{{question}}',
    '【核心结论】',
    '【命盘证据】',
    '【行动建议】',
    '【风险提示】'
  ].join('\n')
}

async function requestAiQa(chartPayload: string, question: string): Promise<string> {
  if (!AI_ENDPOINT || !AI_API_KEY) {
    throw new Error('AI backend not configured: missing ZIWEI_AI_API_KEY/OPENAI_API_KEY or endpoint')
  }
  const template = normalizeQaTemplate()
  const q = toSafeString(question, AI_QA_MAX_QUESTION_CHARS)
  if (!q) throw new Error('invalid_question')
  const templateWithQuestion = template.includes('{{question}}')
    ? template.replace(/\{\{question\}\}/g, q)
    : `${template}\n\n【问题】${q}`

  const userPrompt = [
    '以下是命盘结构化数据(JSON字符串)：',
    chartPayload
  ].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  try {
    const res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.5,
        messages: [
          { role: 'system', content: templateWithQuestion },
          { role: 'user', content: userPrompt }
        ]
      }),
      signal: controller.signal
    })
    if (!res.ok) throw buildAiUpstreamError(res.status)
    const body = await res.json().catch(() => null)
    const content = body?.choices?.[0]?.message?.content
    const text = typeof content === 'string'
      ? content
      : (Array.isArray(content) ? content.map((item: unknown) => {
          if (typeof item === 'string') return item
          if (isPlainObject(item)) return String(item.text || '')
          return ''
        }).join('') : '')
    const answer = toSafeString(text, 8_000)
    if (!answer) throw new Error('ai_response_empty')
    return answer
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('ai_request_timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (!corsHeaders) return new Response('Forbidden', { status: 403, headers: defaultCorsHeaders() })
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !AUTH_USER_ENDPOINT) {
    return json(500, { ok: false, error: 'supabase_env_missing' }, corsHeaders)
  }

  const authUser = await validateBearerToken(req.headers.get('authorization'))
  if (!authUser) return json(401, { ok: false, error: 'unauthorized' }, corsHeaders)
  if (ZIWEI_ALLOWED_EMAILS.length > 0) {
    const email = String(authUser.email || '').trim().toLowerCase()
    if (!email || ZIWEI_ALLOWED_EMAILS.indexOf(email) < 0) {
      return json(403, { ok: false, error: 'forbidden_user' }, corsHeaders)
    }
  }

  const clientIp = getClientIp(req)
  const rate = await consumeRateLimit(`${authUser.userId}|${clientIp}`)
  if (!rate.ok) {
    return json(429, { ok: false, error: 'rate_limited' }, corsHeaders, { 'Retry-After': String(rate.retryAfter) })
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = await req.json()
  } catch (_err) {
    return json(400, { ok: false, error: 'invalid_json' }, corsHeaders)
  }
  if (!isPlainObject(payload)) return json(400, { ok: false, error: 'invalid_payload' }, corsHeaders)

  const styleRaw = toSafeString(payload.style, 16)
  const style: 'simple' | 'pro' = styleRaw === 'simple' ? 'simple' : 'pro'
  const modeRaw = toSafeString(payload.mode, 16)
  const mode: 'analysis' | 'qa' | 'config' = modeRaw === 'qa'
    ? 'qa'
    : (modeRaw === 'config' ? 'config' : 'analysis')
  const signature = toSafeString(payload.signature, 160) || null

  if (mode === 'config') {
    const cfg = buildQaConfig()
    return json(200, {
      ok: true,
      signature,
      config: cfg
    }, corsHeaders)
  }

  const chartPayload = normalizeChartPayload(payload.chart)
  if (!chartPayload || chartPayload.length < 120) {
    return json(400, { ok: false, error: 'chart_payload_too_small' }, corsHeaders)
  }

  try {
    if (mode === 'qa') {
      const question = toSafeString(payload.question, AI_QA_MAX_QUESTION_CHARS)
      if (!question) return json(400, { ok: false, error: 'invalid_question' }, corsHeaders)
      const answer = await requestAiQa(chartPayload, question)
      return json(200, {
        ok: true,
        signature,
        model: AI_MODEL,
        answer
      }, corsHeaders)
    }

    const analysis = await requestAiAnalysis(chartPayload, style)
    return json(200, {
      ok: true,
      signature,
      model: AI_MODEL,
      analysis
    }, corsHeaders)
  } catch (err) {
    const raw = String((err && (err as Error).message) || err || '')
    const safeCode = /^ai_[a-z0-9_]+$/i.test(raw) ? raw.toLowerCase() : 'ai_analysis_failed'
    return json(502, { ok: false, error: safeCode }, corsHeaders)
  }
})
