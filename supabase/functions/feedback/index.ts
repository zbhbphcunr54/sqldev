import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig, handleCors } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { getAppConfig } from '../_shared/app-config.ts'
import { toSafeString } from '../_shared/utils.ts'

await initCorsConfig()

const corsHelpers = createCorsHelpers({})
const { defaultCorsHeaders, buildCorsHeaders } = corsHelpers

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FEEDBACK_INSERT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/feedback_entries` : ''

// 限流器（延迟初始化，读取全局限流配置）
let rateLimiter: ReturnType<typeof createRateLimiter> | null = null

async function getRateLimiter(): Promise<ReturnType<typeof createRateLimiter>> {
  if (rateLimiter) return rateLimiter
  const [maxRequests, windowMs] = await Promise.all([
    getAppConfig<number>('rate_limit', 'max_requests', { defaultValue: 10, parse: Number }),
    getAppConfig<number>('rate_limit', 'window_ms', { defaultValue: 60000, parse: Number })
  ])
  rateLimiter = createRateLimiter({
    scope: 'feedback',
    windowMs: windowMs.value,
    maxRequests: maxRequests.value,
    trackMax: 2000,
    storeMode: 'kv'
  })
  return rateLimiter
}

// 反馈内容长度缓存
let cachedMaxContentLength: number | null = null
let cachedMaxContactLength: number | null = null
let cachedMinContentLength: number | null = null
let feedbackConfigCacheTime = 0

async function loadFeedbackConfig(): Promise<{ maxContentLength: number; maxContactLength: number; minContentLength: number }> {
  const now = Date.now()
  if (cachedMaxContentLength !== null && cachedMaxContactLength !== null && cachedMinContentLength !== null && now - feedbackConfigCacheTime < 60_000) {
    return { maxContentLength: cachedMaxContentLength, maxContactLength: cachedMaxContactLength, minContentLength: cachedMinContentLength }
  }
  const [maxContentLen, maxContactLen, minContentLen] = await Promise.all([
    getAppConfig<number>('feedback', 'max_content_length', { defaultValue: 1200, parse: Number }),
    getAppConfig<number>('feedback', 'max_contact_length', { defaultValue: 120, parse: Number }),
    getAppConfig<number>('feedback', 'min_content_length', { defaultValue: 6, parse: Number })
  ])
  cachedMaxContentLength = maxContentLen.value
  cachedMaxContactLength = maxContactLen.value
  cachedMinContentLength = minContentLen.value
  feedbackConfigCacheTime = now
  return { maxContentLength: cachedMaxContentLength, maxContactLength: cachedMaxContactLength, minContentLength: cachedMinContentLength }
}

function isAllowedCategory(value: string): boolean {
  return ['feature', 'ux', 'performance', 'bug', 'other'].includes(value)
}

interface FeedbackRow {
  category: string; content: string; contact: string | null
  source: string | null; scene: string | null; page: string | null
  theme: string | null; user_agent: string | null
  user_id: string | null; client_ip: string
}

async function parseFeedbackPayload(req: Request, payload: unknown, corsHeaders: Record<string, string>): Promise<FeedbackRow | Response> {
  const config = await loadFeedbackConfig()
  const content = toSafeString((payload as Record<string, unknown>)?.content, config.maxContentLength)
  if (content.length < config.minContentLength) return errorResponse(400, 'content_too_short', corsHeaders)

  const categoryRaw = toSafeString((payload as Record<string, unknown>)?.category, 24) || 'other'
  return {
    category: isAllowedCategory(categoryRaw) ? categoryRaw : 'other',
    content,
    contact: toSafeString((payload as Record<string, unknown>)?.contact, config.maxContactLength) || null,
    source: toSafeString((payload as Record<string, unknown>)?.source, 64) || null,
    scene: toSafeString((payload as Record<string, unknown>)?.scene, 32) || null,
    page: toSafeString((payload as Record<string, unknown>)?.page, 300) || null,
    theme: toSafeString((payload as Record<string, unknown>)?.theme, 16) || null,
    user_agent: toSafeString((payload as Record<string, unknown>)?.userAgent, 300) || toSafeString(req.headers.get('user-agent'), 300) || null,
    user_id: null,
    client_ip: ''
  }
}

async function checkFeedbackRateLimit(userId: string | null, clientIp: string, corsHeaders: Record<string, string>): Promise<Response | null> {
  const rateKey = `${userId || 'anon'}|${clientIp}`
  try {
    const rl = await getRateLimiter()
    const rate = await rl.consume(rateKey)
    if (!rate.ok) {
      return errorResponse(429, 'rate_limited', corsHeaders, { 'Retry-After': String(rate.retryAfter) })
    }
    return null
  } catch (err) {
    logEdgeError('feedback', 'rate_limit_failed', err)
    return null
  }
}

async function insertFeedbackRow(row: FeedbackRow, corsHeaders: Record<string, string>): Promise<Response> {
  try {
    const res = await fetch(FEEDBACK_INSERT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Prefer: 'return=representation',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([row])
    })
    if (!res.ok) {
      logEdgeError('feedback', 'storage_insert_failed', new Error(`status_${res.status}`))
      return errorResponse(500, 'storage_insert_failed', corsHeaders)
    }
    return res
  } catch (err) {
    logEdgeError('feedback', 'storage_unreachable', err)
    return errorResponse(502, 'storage_unreachable', corsHeaders)
  }
}

Deno.serve(async (req) => {
  const corsResult = handleCors(req, corsHelpers)
  if (corsResult) return corsResult
  const corsHeaders = buildCorsHeaders(req)!
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed', corsHeaders)

  const startTime = Date.now()
  const clientIp = getClientIp(req)

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FEEDBACK_INSERT_ENDPOINT) {
      return errorResponse(500, 'feedback_backend_not_configured', corsHeaders)
    }

    const [payload, authUser] = await Promise.all([
      req.json().catch(() => null),
      validateBearerToken(req.headers.get('authorization'), {
        supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY
      })
    ])
    const authUserId = authUser?.userId || null

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return errorResponse(400, 'invalid_payload', corsHeaders)
    }

    const rowResult = await parseFeedbackPayload(req, payload, corsHeaders)
    if (rowResult instanceof Response) {
      return rowResult
    }
    const row = rowResult as FeedbackRow
    row.user_id = authUserId
    row.client_ip = clientIp

    const rateLimitResponse = await checkFeedbackRateLimit(authUserId, clientIp, corsHeaders)
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const insertRes = await insertFeedbackRow(row, corsHeaders)
    if (!insertRes.ok) {
      return insertRes
    }

    const inserted = await insertRes.json().catch(() => [])
    const first = Array.isArray(inserted) ? inserted[0] : null
    const responseBody = { ok: true, id: first?.id || null }
    return jsonResponse(200, responseBody, corsHeaders)
  } catch (err) {
    logEdgeError('feedback', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
