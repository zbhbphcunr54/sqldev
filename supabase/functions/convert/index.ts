import { createClient } from 'npm:@supabase/supabase-js@2'

const PRIMARY_WEB_ORIGIN = 'https://gitzhengpeng.github.io'
const ALLOWED_ORIGINS = new Set([PRIMARY_WEB_ORIGIN])
const LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i
const corsBaseHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const supabaseAuthClient = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null

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

let engineReady = false
let convertDDLFn: ((input: string, from: string, to: string) => string) | null = null
let convertFunctionFn: ((input: string, from: string, to: string) => string) | null = null
let convertProcedureFn: ((input: string, from: string, to: string) => string) | null = null
let rulesModule: RulesModuleShape | null = null
let ddlRulesDefaultSnapshot: Record<string, DdlRuleItem[]> | null = null

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function defaultCorsHeaders() {
  return {
    ...corsBaseHeaders,
    'Access-Control-Allow-Origin': PRIMARY_WEB_ORIGIN,
    Vary: 'Origin'
  }
}

function buildCorsHeaders(req: Request): Record<string, string> | null {
  const origin = (req.headers.get('origin') || '').trim()
  if (!origin) return defaultCorsHeaders()
  if (!ALLOWED_ORIGINS.has(origin) && !LOCAL_ORIGIN_RE.test(origin)) return null
  return {
    ...corsBaseHeaders,
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin'
  }
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

function validateUserToken(token: string): boolean {
  const t = (token || '').trim()
  return /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/.test(t)
}

async function validateUserSession(token: string): Promise<boolean> {
  if (!validateUserToken(token) || !supabaseAuthClient) return false
  try {
    const { data, error } = await supabaseAuthClient.auth.getUser(token)
    if (error) return false
    return !!(data && data.user && typeof data.user.id === 'string' && data.user.id.length > 0)
  } catch {
    return false
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return json({ error: 'Server env missing SUPABASE_URL or SUPABASE_ANON_KEY' }, 500, corsHeaders)
  }

  try {
    const body = await req.json().catch(() => null)
    const token = bearerToken(req)
    if (!validateUserToken(token)) return json({ error: 'Missing or invalid access token' }, 401, corsHeaders)
    const isValidUser = await validateUserSession(token)
    if (!isValidUser) return json({ error: 'Invalid login session' }, 401, corsHeaders)
    const kind = String(body?.kind || '')
    const fromDb = String(body?.fromDb || '')
    const toDb = String(body?.toDb || '')
    const input = String(body?.input || '')
    const runtimeRules = normalizeRuntimeRules(body?.rules)
    if (body?.rules && !runtimeRules) return json({ error: 'Invalid rules payload' }, 400, corsHeaders)

    if (!['ddl', 'func', 'proc'].includes(kind)) return json({ error: 'Invalid kind' }, 400, corsHeaders)
    if (!['oracle', 'mysql', 'postgresql'].includes(fromDb) || !['oracle', 'mysql', 'postgresql'].includes(toDb)) {
      return json({ error: 'Invalid database type' }, 400, corsHeaders)
    }
    if (!input.trim()) return json({ error: 'Input is empty' }, 400, corsHeaders)
    if (input.length > 5 * 1024 * 1024) return json({ error: 'Input too large (max 5MB)' }, 400, corsHeaders)

    await ensureEngineReady()
    const runtimeApplied = runtimeRules ? applyRuntimeRules(runtimeRules) : false

    let output = ''
    try {
      if (kind === 'ddl') {
        const fn = convertDDLFn
        if (typeof fn !== 'function') return json({ error: 'DDL engine not ready' }, 500, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else if (kind === 'func') {
        const fn = convertFunctionFn
        if (typeof fn !== 'function') return json({ error: 'Function engine not ready' }, 500, corsHeaders)
        output = fn(input, fromDb, toDb)
      } else {
        const fn = convertProcedureFn
        if (typeof fn !== 'function') return json({ error: 'Procedure engine not ready' }, 500, corsHeaders)
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
    const msg = err instanceof Error ? err.message : String(err)
    return json({ error: msg }, 500, corsHeaders)
  }
})
