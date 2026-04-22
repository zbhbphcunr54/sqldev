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

type DdlRuleItem = { source?: string; target?: string }
type BodyRuleItem = { s?: string; t?: string }
type RuntimeRulesPayload = {
  source?: string
  version?: string
  ddl?: Record<string, DdlRuleItem[]>
  body?: Record<string, BodyRuleItem[]>
}

type RulesModuleShape = {
  _ddlRulesData?: Record<string, DdlRuleItem[]>
  _bodyRulesData?: Record<string, Array<Record<string, unknown>>>
  _bodyRulesDefault?: Record<string, Array<Record<string, unknown>>>
}

type SessionValidationResult =
  | { state: 'valid'; userId: string }
  | { state: 'invalid' | 'error' }

type RateBucket = { count: number; windowStart: number }

let engineReady = false
let convertDDLFn: ((input: string, from: string, to: string) => string) | null = null
let convertFunctionFn: ((input: string, from: string, to: string) => string) | null = null
let convertProcedureFn: ((input: string, from: string, to: string) => string) | null = null
let rulesModule: RulesModuleShape | null = null
let ddlRulesDefaultSnapshot: Record<string, DdlRuleItem[]> | null = null
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const AUTH_USER_ENDPOINT = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1/user` : ''
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_MAX_REQUESTS'), 20)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('CONVERT_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_REQUEST_BYTES = parsePositiveInt(Deno.env.get('CONVERT_MAX_REQUEST_BYTES'), 6 * 1024 * 1024)
const MAX_RULES_BYTES = parsePositiveInt(Deno.env.get('CONVERT_MAX_RULES_BYTES'), 256 * 1024)
const MAX_JSON_DEPTH = parsePositiveInt(Deno.env.get('CONVERT_MAX_JSON_DEPTH'), 14)
const rateBuckets = new Map<string, RateBucket>()
let kvPromise: Promise<Deno.Kv | null> | null = null

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

function getRequestContentLength(req: Request): number {
  const raw = String(req.headers.get('content-length') || '').trim()
  if (!raw) return -1
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return -1
  return Math.floor(n)
}

function estimateJsonBytes(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length
  } catch (_err) {
    return Number.MAX_SAFE_INTEGER
  }
}

function exceedsJsonDepth(value: unknown, maxDepth: number, depth = 0): boolean {
  if (depth > maxDepth) return true
  if (value == null) return false
  if (typeof value !== 'object') return false
  if (Array.isArray(value)) {
    for (const item of value) {
      if (exceedsJsonDepth(item, maxDepth, depth + 1)) return true
    }
    return false
  }
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (exceedsJsonDepth((value as Record<string, unknown>)[key], maxDepth, depth + 1)) return true
  }
  return false
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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
  if (toDrop <= 0) return
  for (const key of rateBuckets.keys()) {
    rateBuckets.delete(key)
    toDrop -= 1
    if (toDrop <= 0) return
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
  const kvKey: Deno.KvKey = ['rate_limit', 'convert', key, windowIndex]

  for (let i = 0; i < 6; i += 1) {
    const entry = await kv.get<RateBucket>(kvKey)
    const count = Number(entry.value?.count || 0)
    if (count >= RATE_LIMIT_MAX_REQUESTS) return { ok: false, retryAfter }
    const next: RateBucket = { count: count + 1, windowStart }
    const commit = await kv.atomic().check(entry).set(kvKey, next, { expireIn }).commit()
    if (commit.ok) return { ok: true, remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - next.count) }
  }

  return consumeRateLimitMemory(key, now)
}

function replaceRecord<T>(target: Record<string, T>, source: Record<string, T>) {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key]
  }
  for (const key of Object.keys(source)) {
    target[key] = source[key]
  }
}

function normalizeRuntimeRules(raw: unknown): RuntimeRulesPayload | null {
  if (!isPlainObject(raw)) return null
  const payload: RuntimeRulesPayload = {}

  if (typeof raw.source === 'string') payload.source = raw.source.slice(0, 64)
  if (typeof raw.version === 'string') payload.version = raw.version.slice(0, 128)

  if (isPlainObject(raw.ddl)) {
    const ddl: Record<string, DdlRuleItem[]> = {}
    for (const pair of Object.keys(raw.ddl)) {
      const list = raw.ddl[pair]
      if (!Array.isArray(list)) continue
      ddl[pair] = list
        .filter((item) => isPlainObject(item))
        .map((item) => ({
          source: typeof item.source === 'string' ? item.source : '',
          target: typeof item.target === 'string' ? item.target : ''
        }))
    }
    if (Object.keys(ddl).length > 0) payload.ddl = ddl
  }

  if (isPlainObject(raw.body)) {
    const body: Record<string, BodyRuleItem[]> = {}
    for (const pair of Object.keys(raw.body)) {
      const list = raw.body[pair]
      if (!Array.isArray(list)) continue
      body[pair] = list
        .filter((item) => isPlainObject(item))
        .map((item) => ({
          s: typeof item.s === 'string' ? item.s : '',
          t: typeof item.t === 'string' ? item.t : ''
        }))
    }
    if (Object.keys(body).length > 0) payload.body = body
  }

  if (!payload.ddl && !payload.body) return null
  return payload
}

function cloneBodyRulesWithHandlers(
  src: Record<string, Array<Record<string, unknown>>>
): Record<string, Array<Record<string, unknown>>> {
  const out: Record<string, Array<Record<string, unknown>>> = {}
  for (const key of Object.keys(src)) {
    const list = src[key]
    if (!Array.isArray(list)) continue
    out[key] = list.map((item) => ({ ...item }))
  }
  return out
}

function buildBodyRulesFromPlain(
  plain: Record<string, BodyRuleItem[]>,
  defaults: Record<string, Array<Record<string, unknown>>>
): Record<string, Array<Record<string, unknown>>> {
  const merged = cloneBodyRulesWithHandlers(defaults)
  for (const pair of Object.keys(plain)) {
    const defaultList = defaults[pair]
    if (!Array.isArray(defaultList)) continue
    const incoming = plain[pair]
    if (!Array.isArray(incoming)) continue
    const lookup = new Map<string, Record<string, unknown>>()
    for (const rule of defaultList) {
      const s = typeof rule.s === 'string' ? rule.s : ''
      const t = typeof rule.t === 'string' ? rule.t : ''
      lookup.set(`${s}\u0000${t}`, rule)
    }
    merged[pair] = incoming.map((item) => {
      const s = typeof item.s === 'string' ? item.s : ''
      const t = typeof item.t === 'string' ? item.t : ''
      const def = lookup.get(`${s}\u0000${t}`)
      if (def) return { ...def, s, t }
      return { s, t, fwd: null, rev: null }
    })
  }
  return merged
}

function applyRuntimeRules(payload: RuntimeRulesPayload): boolean {
  if (!rulesModule) return false
  let applied = false

  if (payload.ddl && rulesModule._ddlRulesData && ddlRulesDefaultSnapshot) {
    const merged = cloneJson(ddlRulesDefaultSnapshot)
    for (const pair of Object.keys(payload.ddl)) {
      if (!Object.prototype.hasOwnProperty.call(merged, pair)) continue
      const incoming = payload.ddl[pair]
      if (!Array.isArray(incoming)) continue
      merged[pair] = incoming.map((item) => ({
        source: typeof item.source === 'string' ? item.source : '',
        target: typeof item.target === 'string' ? item.target : ''
      }))
    }
    replaceRecord(rulesModule._ddlRulesData, merged)
    applied = true
  }

  if (payload.body && rulesModule._bodyRulesData && rulesModule._bodyRulesDefault) {
    const mergedBody = buildBodyRulesFromPlain(payload.body, rulesModule._bodyRulesDefault)
    replaceRecord(rulesModule._bodyRulesData, mergedBody)
    applied = true
  }

  return applied
}

function resetRuntimeRules() {
  if (!rulesModule) return
  if (rulesModule._ddlRulesData && ddlRulesDefaultSnapshot) {
    replaceRecord(rulesModule._ddlRulesData, cloneJson(ddlRulesDefaultSnapshot))
  }
  if (rulesModule._bodyRulesData && rulesModule._bodyRulesDefault) {
    replaceRecord(rulesModule._bodyRulesData, cloneBodyRulesWithHandlers(rulesModule._bodyRulesDefault))
  }
}

async function ensureEngineReady() {
  if (engineReady) return
  const g = globalThis as Record<string, unknown>
  if (!g.localStorage) {
    g.localStorage = {
      getItem() {
        return null
      },
      setItem() {
        return undefined
      }
    }
  }

  await import('./samples.js')
  rulesModule = (await import('./rules.js')) as RulesModuleShape
  if (!ddlRulesDefaultSnapshot && rulesModule._ddlRulesData) {
    ddlRulesDefaultSnapshot = cloneJson(rulesModule._ddlRulesData)
  }
  const engineModule = (await import('./app-engine.js')) as {
    convertDDL?: (input: string, from: string, to: string) => string
    convertFunction?: (input: string, from: string, to: string) => string
    convertProcedure?: (input: string, from: string, to: string) => string
  }
  convertDDLFn = engineModule.convertDDL || null
  convertFunctionFn = engineModule.convertFunction || null
  convertProcedureFn = engineModule.convertProcedure || null
  engineReady = true
}

function json(data: unknown, status = 200, corsHeaders: Record<string, string> = defaultCorsHeaders()) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  })
}

function bearerToken(req: Request): string {
  const auth = req.headers.get('authorization') || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

async function validateUserSession(token: string): Promise<SessionValidationResult> {
  if (!AUTH_USER_ENDPOINT || !SUPABASE_ANON_KEY) return { state: 'error' }
  try {
    const res = await fetch(AUTH_USER_ENDPOINT, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY
      }
    })
    if (res.ok) {
      const payload = await res.json().catch(() => null)
      const userId = typeof payload?.id === 'string' ? payload.id : ''
      if (!userId) return { state: 'error' }
      return { state: 'valid', userId }
    }
    if (res.status === 401 || res.status === 403) return { state: 'invalid' }
    return { state: 'error' }
  } catch {
    return { state: 'error' }
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return json({ error: 'CORS origin not allowed' }, 403)
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return json({ error: 'CORS origin not allowed' }, 403)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  try {
    if (!AUTH_USER_ENDPOINT || !SUPABASE_ANON_KEY) {
      return json({ error: 'server_not_ready' }, 500, corsHeaders)
    }
    const contentLength = getRequestContentLength(req)
    if (contentLength > MAX_REQUEST_BYTES) {
      return json({ error: 'payload_too_large' }, 413, corsHeaders)
    }
    const token = bearerToken(req)
    if (!token) return json({ error: 'unauthorized' }, 401, corsHeaders)
    const sessionState = await validateUserSession(token)
    if (sessionState.state === 'invalid') return json({ error: 'unauthorized' }, 401, corsHeaders)
    if (sessionState.state === 'error') return json({ error: 'auth_unavailable' }, 503, corsHeaders)
    const clientIp = getClientIp(req)
    const limit = await consumeRateLimit(`${sessionState.userId}:${clientIp}`)
    if (!limit.ok) {
      return json({ error: 'rate_limited' }, 429, {
        ...corsHeaders,
        'Retry-After': String(limit.retryAfter)
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json({ error: 'invalid_json' }, 400, corsHeaders)
    if (exceedsJsonDepth(body, MAX_JSON_DEPTH)) return json({ error: 'payload_too_deep' }, 400, corsHeaders)
    if (estimateJsonBytes(body) > MAX_REQUEST_BYTES) return json({ error: 'payload_too_large' }, 413, corsHeaders)
    const kind = String(body?.kind || '')
    const fromDb = String(body?.fromDb || '')
    const toDb = String(body?.toDb || '')
    const input = String(body?.input || '')
    const runtimeRules = normalizeRuntimeRules(body?.rules)
    if (body?.rules && !runtimeRules) return json({ error: 'invalid_rules' }, 400, corsHeaders)
    if (body?.rules && estimateJsonBytes(body.rules) > MAX_RULES_BYTES) return json({ error: 'rules_too_large' }, 400, corsHeaders)

    if (!['ddl', 'func', 'proc'].includes(kind)) return json({ error: 'invalid_kind' }, 400, corsHeaders)
    if (!['oracle', 'mysql', 'postgresql'].includes(fromDb) || !['oracle', 'mysql', 'postgresql'].includes(toDb)) {
      return json({ error: 'invalid_database_type' }, 400, corsHeaders)
    }
    if (!input.trim()) return json({ error: 'input_empty' }, 400, corsHeaders)
    if (input.length > 5 * 1024 * 1024) return json({ error: 'input_too_large' }, 400, corsHeaders)

    await ensureEngineReady()
    const runtimeApplied = runtimeRules ? applyRuntimeRules(runtimeRules) : false

    let output = ''
    try {
      if (kind === 'ddl') {
        const fn = convertDDLFn
        if (typeof fn !== 'function') return json({ error: 'engine_not_ready' }, 500, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else if (kind === 'func') {
        const fn = convertFunctionFn
        if (typeof fn !== 'function') return json({ error: 'engine_not_ready' }, 500, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else {
        const fn = convertProcedureFn
        if (typeof fn !== 'function') return json({ error: 'engine_not_ready' }, 500, corsHeaders)
        output = fn(input, fromDb, toDb)
      }
    } finally {
      if (runtimeApplied) resetRuntimeRules()
    }

    return json({
      output,
      kind,
      fromDb,
      toDb,
      rulesSource: runtimeRules?.source || 'server-default',
      rulesVersion: runtimeRules?.version || 'server-default'
    }, 200, corsHeaders)
  } catch (err) {
    void err
    return json({ error: 'internal_error' }, 500, corsHeaders)
  }
})
