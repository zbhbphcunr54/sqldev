import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp, getRequestContentLength } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

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
type ConvertEngineFunction = (input: string, from: string, to: string) => string
type EngineModuleShape = {
  convertDDL?: ConvertEngineFunction
  convertFunction?: ConvertEngineFunction
  convertProcedure?: ConvertEngineFunction
}

let engineReady = false
let convertDDLFn: ConvertEngineFunction | null = null
let convertFunctionFn: ConvertEngineFunction | null = null
let convertProcedureFn: ConvertEngineFunction | null = null
let rulesModule: RulesModuleShape | null = null
let ddlRulesDefaultSnapshot: Record<string, DdlRuleItem[]> | null = null
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_MAX_REQUESTS'), 20)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('CONVERT_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('CONVERT_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_REQUEST_BYTES = parsePositiveInt(Deno.env.get('CONVERT_MAX_REQUEST_BYTES'), 6 * 1024 * 1024)
const MAX_RULES_BYTES = parsePositiveInt(Deno.env.get('CONVERT_MAX_RULES_BYTES'), 256 * 1024)
const MAX_JSON_DEPTH = parsePositiveInt(Deno.env.get('CONVERT_MAX_JSON_DEPTH'), 14)
const rateLimiter = createRateLimiter({
  scope: 'convert',
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  trackMax: RATE_LIMIT_TRACK_MAX,
  storeMode: RATE_LIMIT_STORE_MODE
})

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object'
}

function isConvertEngineFunction(value: unknown): value is ConvertEngineFunction {
  return typeof value === 'function'
}

function validateEngineModuleShape(value: unknown): EngineModuleShape {
  if (!isRecord(value)) throw new Error('app-engine module is not an object')

  const moduleShape: EngineModuleShape = {}
  for (const key of ['convertDDL', 'convertFunction', 'convertProcedure'] as const) {
    const candidate = value[key]
    if (candidate == null) continue
    if (!isConvertEngineFunction(candidate)) {
      throw new Error(`app-engine export ${key} must be a function`)
    }
    moduleShape[key] = candidate
  }

  if (
    !moduleShape.convertDDL &&
    !moduleShape.convertFunction &&
    !moduleShape.convertProcedure
  ) {
    throw new Error('app-engine module does not export any converter')
  }

  return moduleShape
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

  await import('../_shared/convert-engine/samples.js')
  rulesModule = (await import('../_shared/convert-engine/rules.js')) as RulesModuleShape
  if (!ddlRulesDefaultSnapshot && rulesModule._ddlRulesData) {
    ddlRulesDefaultSnapshot = cloneJson(rulesModule._ddlRulesData)
  }
  const engineModule = validateEngineModuleShape(await import('../_shared/convert-engine/app-engine.js'))
  convertDDLFn = engineModule.convertDDL || null
  convertFunctionFn = engineModule.convertFunction || null
  convertProcedureFn = engineModule.convertProcedure || null
  engineReady = true
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' }, corsHeaders)

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }
    const contentLength = getRequestContentLength(req)
    if (contentLength > MAX_REQUEST_BYTES) {
      return jsonResponse(413, { error: 'payload_too_large' }, corsHeaders)
    }
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (sessionState.state === 'invalid') return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    if (sessionState.state === 'error') return jsonResponse(503, { error: 'auth_unavailable' }, corsHeaders)
    const clientIp = getClientIp(req)
    let limit
    try {
      limit = await rateLimiter.consume(`${sessionState.userId}:${clientIp}`)
    } catch (err) {
      logEdgeError('convert', 'rate_limit_failed', err)
      limit = { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS }
    }
    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return jsonResponse(400, { error: 'invalid_json' }, corsHeaders)
    if (exceedsJsonDepth(body, MAX_JSON_DEPTH)) return jsonResponse(400, { error: 'payload_too_deep' }, corsHeaders)
    if (estimateJsonBytes(body) > MAX_REQUEST_BYTES) return jsonResponse(413, { error: 'payload_too_large' }, corsHeaders)
    const kind = String(body?.kind || '')
    const fromDb = String(body?.fromDb || '')
    const toDb = String(body?.toDb || '')
    const input = String(body?.input || '')
    const runtimeRules = normalizeRuntimeRules(body?.rules)
    if (body?.rules && !runtimeRules) return jsonResponse(400, { error: 'invalid_rules' }, corsHeaders)
    if (body?.rules && estimateJsonBytes(body.rules) > MAX_RULES_BYTES) return jsonResponse(400, { error: 'rules_too_large' }, corsHeaders)

    if (!['ddl', 'func', 'proc'].includes(kind)) return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
    if (!['oracle', 'mysql', 'postgresql'].includes(fromDb) || !['oracle', 'mysql', 'postgresql'].includes(toDb)) {
      return jsonResponse(400, { error: 'invalid_database_type' }, corsHeaders)
    }
    if (!input.trim()) return jsonResponse(400, { error: 'input_empty' }, corsHeaders)
    if (input.length > 5 * 1024 * 1024) return jsonResponse(400, { error: 'input_too_large' }, corsHeaders)

    try {
      await ensureEngineReady()
    } catch (err) {
      logEdgeError('convert', 'engine_init_failed', err)
      return errorResponse(503, 'engine_init_failed', corsHeaders)
    }

    let runtimeApplied = false
    try {
      runtimeApplied = runtimeRules ? applyRuntimeRules(runtimeRules) : false
    } catch (err) {
      logEdgeError('convert', 'rules_apply_failed', err)
      return errorResponse(400, 'invalid_rules', corsHeaders)
    }

    let output = ''
    try {
      if (kind === 'ddl') {
        const fn = convertDDLFn
        if (typeof fn !== 'function') return jsonResponse(500, { error: 'engine_not_ready' }, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else if (kind === 'func') {
        const fn = convertFunctionFn
        if (typeof fn !== 'function') return jsonResponse(500, { error: 'engine_not_ready' }, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else {
        const fn = convertProcedureFn
        if (typeof fn !== 'function') return jsonResponse(500, { error: 'engine_not_ready' }, corsHeaders)
        output = fn(input, fromDb, toDb)
      }
    } catch (err) {
      logEdgeError('convert', 'conversion_failed', err)
      return errorResponse(500, 'conversion_failed', corsHeaders)
    } finally {
      if (runtimeApplied) resetRuntimeRules()
    }

    return jsonResponse(200, {
      output,
      kind,
      fromDb,
      toDb,
      rulesSource: runtimeRules?.source || 'server-default',
      rulesVersion: runtimeRules?.version || 'server-default'
    }, corsHeaders)
  } catch (err) {
    logEdgeError('convert', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
