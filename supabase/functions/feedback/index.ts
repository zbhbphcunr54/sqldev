import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: (Deno.env.get('CORS_PRIMARY_ORIGIN') || DEFAULT_WEB_ORIGIN).trim() || DEFAULT_WEB_ORIGIN,
  primaryOriginEnvKey: 'CORS_PRIMARY_ORIGIN',
  allowedOriginsEnvKey: 'CORS_ALLOWED_ORIGINS',
  allowLocalhostEnvKey: 'ALLOW_LOCALHOST_ORIGIN'
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FEEDBACK_INSERT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/feedback_entries` : ''

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_MAX_REQUESTS'), 10)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('FEEDBACK_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_CONTENT_LENGTH = parsePositiveInt(Deno.env.get('FEEDBACK_MAX_CONTENT_LENGTH'), 1_200)
const MAX_CONTACT_LENGTH = parsePositiveInt(Deno.env.get('FEEDBACK_MAX_CONTACT_LENGTH'), 120)
const rateLimiter = createRateLimiter({
  scope: 'feedback',
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  trackMax: RATE_LIMIT_TRACK_MAX,
  storeMode: RATE_LIMIT_STORE_MODE
})

function toSafeString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return ''
  const out = raw.replace(/\u0000/g, '').trim()
  if (!out) return ''
  return out.slice(0, maxLen)
}

function isAllowedCategory(value: string): boolean {
  return ['feature', 'ux', 'performance', 'bug', 'other'].includes(value)
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (!corsHeaders) return new Response('Forbidden', { status: 403, headers: defaultCorsHeaders() })
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return errorResponse(405, 'method_not_allowed', corsHeaders)

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FEEDBACK_INSERT_ENDPOINT) {
      return errorResponse(500, 'feedback_backend_not_configured', corsHeaders)
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = await req.json()
    } catch (_err) {
      return errorResponse(400, 'invalid_json', corsHeaders)
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return errorResponse(400, 'invalid_payload', corsHeaders)
    }

    const content = toSafeString(payload.content, MAX_CONTENT_LENGTH)
    if (content.length < 6) {
      return errorResponse(400, 'content_too_short', corsHeaders)
    }

    const categoryRaw = toSafeString(payload.category, 24) || 'other'
    const category = isAllowedCategory(categoryRaw) ? categoryRaw : 'other'
    const contact = toSafeString(payload.contact, MAX_CONTACT_LENGTH) || null
    const source = toSafeString(payload.source, 64) || null
    const scene = toSafeString(payload.scene, 32) || null
    const page = toSafeString(payload.page, 300) || null
    const theme = toSafeString(payload.theme, 16) || null
    const userAgent = toSafeString(payload.userAgent, 300) || toSafeString(req.headers.get('user-agent'), 300) || null

    const clientIp = getClientIp(req)
    const authUser = await validateBearerToken(req.headers.get('authorization'), {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    const authUserId = authUser?.userId || null
    const rateKey = `${authUserId || 'anon'}|${clientIp}`
    let rate: { ok: boolean; remaining?: number; retryAfter?: number }
    try {
      rate = await rateLimiter.consume(rateKey)
    } catch (err) {
      logEdgeError('feedback', 'rate_limit_failed', err)
      rate = { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS }
    }
    if (!rate.ok) {
      return errorResponse(429, 'rate_limited', corsHeaders, {
        'Retry-After': String(rate.retryAfter)
      })
    }

    const row = {
      category,
      content,
      contact,
      source,
      scene,
      page,
      theme,
      user_agent: userAgent,
      user_id: authUserId,
      client_ip: clientIp
    }

    let insertRes: Response
    try {
      insertRes = await fetch(FEEDBACK_INSERT_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Prefer: 'return=representation',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([row])
      })
    } catch (err) {
      logEdgeError('feedback', 'storage_unreachable', err)
      return errorResponse(502, 'storage_unreachable', corsHeaders)
    }

    if (!insertRes.ok) {
      logEdgeError('feedback', 'storage_insert_failed', new Error(`status_${insertRes.status}`))
      return errorResponse(500, 'storage_insert_failed', corsHeaders)
    }

    const inserted = await insertRes.json().catch(() => [])
    const first = Array.isArray(inserted) ? inserted[0] : null
    return jsonResponse(200, { ok: true, id: first?.id || null }, corsHeaders)
  } catch (err) {
    logEdgeError('feedback', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
