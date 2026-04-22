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
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const AUTH_USER_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/user` : ''
const FEEDBACK_INSERT_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/rest/v1/feedback_entries` : ''

const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_MAX_REQUESTS'), 10)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('FEEDBACK_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('FEEDBACK_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_CONTENT_LENGTH = parsePositiveInt(Deno.env.get('FEEDBACK_MAX_CONTENT_LENGTH'), 1_200)
const MAX_CONTACT_LENGTH = parsePositiveInt(Deno.env.get('FEEDBACK_MAX_CONTACT_LENGTH'), 120)
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
  const kvKey: Deno.KvKey = ['rate_limit', 'feedback', key, windowIndex]

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

function toSafeString(raw: unknown, maxLen: number): string {
  if (typeof raw !== 'string') return ''
  const out = raw.replace(/\u0000/g, '').trim()
  if (!out) return ''
  return out.slice(0, maxLen)
}

function isAllowedCategory(value: string): boolean {
  return ['feature', 'ux', 'performance', 'bug', 'other'].includes(value)
}

async function validateBearerToken(authorization: string | null): Promise<string | null> {
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
    return userId || null
  } catch (_err) {
    return null
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

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (!corsHeaders) return new Response('Forbidden', { status: 403, headers: defaultCorsHeaders() })
  if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !FEEDBACK_INSERT_ENDPOINT) {
    return json(500, { ok: false, error: 'feedback_backend_not_configured' }, corsHeaders)
  }

  let payload: Record<string, unknown> | null = null
  try {
    payload = await req.json()
  } catch (_err) {
    return json(400, { ok: false, error: 'invalid_json' }, corsHeaders)
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { ok: false, error: 'invalid_payload' }, corsHeaders)
  }

  const content = toSafeString(payload.content, MAX_CONTENT_LENGTH)
  if (content.length < 6) {
    return json(400, { ok: false, error: 'content_too_short' }, corsHeaders)
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
  const authUserId = await validateBearerToken(req.headers.get('authorization'))
  const rateKey = `${authUserId || 'anon'}|${clientIp}`
  const rate = await consumeRateLimit(rateKey)
  if (!rate.ok) {
    return json(
      429,
      { ok: false, error: 'rate_limited' },
      corsHeaders,
      { 'Retry-After': String(rate.retryAfter) }
    )
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
  } catch (_err) {
    return json(502, { ok: false, error: 'storage_unreachable' }, corsHeaders)
  }

  if (!insertRes.ok) {
    return json(500, { ok: false, error: 'storage_insert_failed' }, corsHeaders)
  }

  const inserted = await insertRes.json().catch(() => [])
  const first = Array.isArray(inserted) ? inserted[0] : null
  return json(200, { ok: true, id: first?.id || null }, corsHeaders)
})
