import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
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
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

// [2026-05-03] 修改：从 app-config 读取配置，支持数据库优先 + 环境变量回退
async function loadAiConfig(): Promise<{
  aiConfig: ZiweiAiProviderConfig
  allowedEmails: string[]
  rateLimit: { windowMs: number; maxRequests: number; trackMax: number }
  qaSuggestions: string[]
}> {
  // 紫微分析配置
  const [baseUrlResult, modelResult, timeoutResult, maxChartCharsResult,
         qaMaxQuestionResult, analysisMaxTokensResult, qaMaxTokensResult,
         analysisTemplateResult, qaTemplateResult, qaSuggestionsResult,
         allowedEmailsResult, rateLimitResult] = await Promise.all([
    getAppConfig('ziwei', 'base_url', { envVar: 'ZIWEI_AI_BASE_URL', defaultValue: 'https://api.openai.com/v1' }),
    getAppConfig('ziwei', 'model', { envVar: 'ZIWEI_AI_MODEL', defaultValue: 'gpt-4.1-mini' }),
    getAppConfig<number>('ziwei', 'timeout_ms', { envVar: 'ZIWEI_AI_TIMEOUT_MS', defaultValue: 20000, parse: Number }),
    getAppConfig<number>('ziwei_chart', 'max_chart_chars', { envVar: 'ZIWEI_AI_MAX_CHART_CHARS', defaultValue: 12000, parse: Number }),
    getAppConfig<number>('ziwei_qa', 'max_question_chars', { envVar: 'ZIWEI_AI_QA_MAX_QUESTION_CHARS', defaultValue: 220, parse: Number }),
    getAppConfig<number>('ziwei', 'analysis_max_tokens', { envVar: 'ZIWEI_AI_ANALYSIS_MAX_TOKENS', defaultValue: 900, parse: Number }),
    getAppConfig<number>('ziwei_qa', 'max_tokens', { envVar: 'ZIWEI_AI_QA_MAX_TOKENS', defaultValue: 520, parse: Number }),
    getAppConfig('ziwei_chart', 'template', { envVar: 'ZIWEI_AI_ANALYSIS_TEMPLATE', defaultValue: '' }),
    getAppConfig('ziwei_qa', 'template', { envVar: 'ZIWEI_AI_QA_TEMPLATE', defaultValue: '' }),
    getAppConfig<string[]>('ziwei_qa', 'suggestions', { envVar: 'ZIWEI_AI_QA_SUGGESTIONS', defaultValue: [], parse: (v) => v ? JSON.parse(v) : [] }),
    getAppConfig<string[]>('ziwei', 'allowed_emails', { envVar: 'ZIWEI_ALLOWED_EMAILS', defaultValue: [], parse: (v) => v.split(',').map(e => e.trim()).filter(Boolean) }),
    getAppConfigsByCategory('rate_limit')
  ])

  // API Key 仍从环境变量获取（敏感信息不存数据库）
  const apiKey = (Deno.env.get('ZIWEI_AI_API_KEY') || Deno.env.get('OPENAI_API_KEY') || '').trim()

  const aiConfig: ZiweiAiProviderConfig = {
    endpoint: buildAiEndpoint(baseUrlResult.value),
    apiKey,
    model: modelResult.value,
    timeoutMs: timeoutResult.value,
    analysisMaxTokens: analysisMaxTokensResult.value,
    qaMaxTokens: qaMaxTokensResult.value,
    qaMaxQuestionChars: qaMaxQuestionResult.value,
    analysisTemplate: analysisTemplateResult.value,
    qaTemplate: qaTemplateResult.value,
    maxChartChars: maxChartCharsResult.value
  }

  const rateLimit = {
    windowMs: Number(rateLimitResult.get('ziwei_window_ms') || rateLimitResult.get('ziwei_window') || 60000),
    maxRequests: Number(rateLimitResult.get('ziwei_requests') || 6),
    trackMax: 2000
  }

  return {
    aiConfig,
    allowedEmails: allowedEmailsResult.value,
    rateLimit,
    qaSuggestions: qaSuggestionsResult.value
  }
}

// 缓存加载结果
let cachedConfig: Awaited<ReturnType<typeof loadAiConfig>> | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000 // 1 分钟

async function getAiConfig() {
  const now = Date.now()
  if (!cachedConfig || now - configCacheTime > CONFIG_CACHE_TTL) {
    cachedConfig = await loadAiConfig()
    configCacheTime = now
  }
  return cachedConfig
}

// 限流器实例缓存
const rateLimiterCache = new Map<string, { limiter: ReturnType<typeof createRateLimiter>; windowMs: number }>()

async function getRateLimiter(windowMs: number, maxRequests: number) {
  const key = `${windowMs}:${maxRequests}`
  if (!rateLimiterCache.has(key)) {
    const limiter = createRateLimiter({
      scope: 'ziwei_analysis',
      windowMs,
      maxRequests,
      trackMax: 2000,
      storeMode: 'kv'
    })
    rateLimiterCache.set(key, { limiter, windowMs })
  }
  return rateLimiterCache.get(key)!.limiter
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

    // 加载配置
    const config = await getAiConfig()

    // 邮箱白名单检查
    if (config.allowedEmails.length > 0) {
      const email = String(authUser.email || '').trim().toLowerCase()
      if (!email || !config.allowedEmails.includes(email)) {
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

    // config 模式返回问答配置
    if (mode === 'config') {
      return jsonResponse(200, { ok: true, signature, config: buildQaConfig(JSON.stringify(config.qaSuggestions)) }, corsHeaders)
    }

    // 限流检查
    const rateLimiter = await getRateLimiter(config.rateLimit.windowMs, config.rateLimit.maxRequests)
    const clientIp = getClientIp(req)
    const rate = await rateLimiter.consume(`${authUser.userId}|${clientIp}`)
    if (!rate.ok) {
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, corsHeaders, { 'Retry-After': String(rate.retryAfter) })
    }

    // 验证命盘数据
    if (!isValidChartPayloadStructure(payload.chart)) {
      return jsonResponse(400, { ok: false, error: 'invalid_chart_payload' }, corsHeaders)
    }

    const chartPayload = normalizeChartPayload(payload.chart, config.aiConfig.maxChartChars || 12000)
    if (!chartPayload || chartPayload.length < 120) {
      return jsonResponse(400, { ok: false, error: 'chart_payload_too_small' }, corsHeaders)
    }

    try {
      if (mode === 'qa') {
        const question = toSafeString(payload.question, config.aiConfig.qaMaxQuestionChars || 220)
        if (!question) return jsonResponse(400, { ok: false, error: 'invalid_question' }, corsHeaders)
        const answer = await requestAiQa(config.aiConfig, chartPayload, question)
        return jsonResponse(200, { ok: true, signature, model: config.aiConfig.model, answer }, corsHeaders)
      }

      const analysis = await requestAiAnalysis(config.aiConfig, chartPayload, style)
      return jsonResponse(200, { ok: true, signature, model: config.aiConfig.model, analysis }, corsHeaders)
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
