import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'
import { buildQaConfig } from './prompt-template.ts'
import { buildAiEndpoint, requestAiAnalysis, requestAiQa, type ZiweiAiProviderConfig } from './provider.ts'
import {
  isPlainObject,
  isValidChartPayloadStructure,
  mapAiErrorStatus,
  normalizeAiErrorCode,
  normalizeChartPayload,
  toSafeString
} from './response-parser.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
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

const aiConfig: ZiweiAiProviderConfig = {
  endpoint: AI_ENDPOINT,
  apiKey: AI_API_KEY,
  model: AI_MODEL,
  timeoutMs: AI_TIMEOUT_MS,
  analysisMaxTokens: AI_ANALYSIS_MAX_TOKENS,
  qaMaxTokens: AI_QA_MAX_TOKENS,
  qaMaxQuestionChars: AI_QA_MAX_QUESTION_CHARS,
  analysisTemplate: AI_ANALYSIS_TEMPLATE,
  qaTemplate: AI_QA_TEMPLATE
}

export async function handleZiweiAnalysisRequest(req: Request): Promise<Response> {
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
      return jsonResponse(200, { ok: true, signature, config: buildQaConfig(AI_QA_SUGGESTIONS_JSON) }, corsHeaders)
    }

    const clientIp = getClientIp(req)
    const rate = await rateLimiter.consume(`${authUser.userId}|${clientIp}`)
    if (!rate.ok) {
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, corsHeaders, { 'Retry-After': String(rate.retryAfter) })
    }

    if (!isValidChartPayloadStructure(payload.chart)) {
      return jsonResponse(400, { ok: false, error: 'invalid_chart_payload' }, corsHeaders)
    }

    const chartPayload = normalizeChartPayload(payload.chart, AI_MAX_CHART_CHARS)
    if (!chartPayload || chartPayload.length < 120) {
      return jsonResponse(400, { ok: false, error: 'chart_payload_too_small' }, corsHeaders)
    }

    try {
      if (mode === 'qa') {
        const question = toSafeString(payload.question, AI_QA_MAX_QUESTION_CHARS)
        if (!question) return jsonResponse(400, { ok: false, error: 'invalid_question' }, corsHeaders)
        const answer = await requestAiQa(aiConfig, chartPayload, question)
        return jsonResponse(200, { ok: true, signature, model: AI_MODEL, answer }, corsHeaders)
      }

      const analysis = await requestAiAnalysis(aiConfig, chartPayload, style)
      return jsonResponse(200, { ok: true, signature, model: AI_MODEL, analysis }, corsHeaders)
    } catch (err) {
      const errorCode = normalizeAiErrorCode(err)
      logEdgeError('ziwei-analysis', errorCode, err)
      return jsonResponse(mapAiErrorStatus(errorCode), { ok: false, error: errorCode }, corsHeaders)
    }
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    logEdgeError('ziwei-analysis', 'unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
}
