import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, errorResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'
import { logOperation } from '../_shared/operation-logger.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('RULES_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('RULES_RATE_LIMIT_MAX_REQUESTS'), 10)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('RULES_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('RULES_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_RULES_JSON_BYTES = 50 * 1024

const rateLimiter = createRateLimiter({
  scope: 'rules',
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  trackMax: RATE_LIMIT_TRACK_MAX,
  storeMode: RATE_LIMIT_STORE_MODE
})

const VALID_KINDS = new Set(['ddl', 'body'])

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }
  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  const startTime = Date.now()
  const clientIp = getClientIp(req)

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }

    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (sessionState.state !== 'valid') {
      return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    }
    const { userId, email } = sessionState

    let limit
    try {
      limit = await rateLimiter.consume(`${userId}:${clientIp}`)
    } catch (err) {
      logEdgeError('rules', 'rate_limit_failed', err)
      limit = { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS }
    }
    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey)

    // POST: read rules
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
      }
      const kind = String(body.kind || '')
      if (!VALID_KINDS.has(kind)) {
        return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
      }

      const { data, error: dbError } = await adminClient
        .from('user_rules')
        .select('rules_json, updated_at')
        .eq('user_id', userId)
        .eq('kind', kind)
        .maybeSingle()

      if (dbError) {
        logEdgeError('rules', 'read_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_read', apiName: 'rules',
          requestBody: { kind }, responseStatus: 500,
          durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'rule_read_failed', corsHeaders)
      }

      const result = data || { rules_json: {}, updated_at: null }
      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'rule_read', apiName: 'rules',
        requestBody: { kind }, responseBody: { found: !!data },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(200, {
        ok: true,
        kind,
        rules_json: result.rules_json,
        updated_at: result.updated_at
      }, corsHeaders)
    }

    // PUT: save rules
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
      }
      const kind = String(body.kind || '')
      const rulesJson = body.rules_json
      if (!VALID_KINDS.has(kind)) {
        return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
      }
      if (!rulesJson || typeof rulesJson !== 'object') {
        return jsonResponse(400, { error: 'invalid_rules_json' }, corsHeaders)
      }
      const rulesBytes = new TextEncoder().encode(JSON.stringify(rulesJson)).length
      if (rulesBytes > MAX_RULES_JSON_BYTES) {
        return jsonResponse(400, { error: 'rules_too_large' }, corsHeaders)
      }

      const { data, error: dbError } = await adminClient
        .from('user_rules')
        .upsert({
          user_id: userId,
          kind,
          rules_json: rulesJson
        }, { onConflict: 'user_id,kind' })
        .select('id, updated_at')
        .single()

      if (dbError) {
        logEdgeError('rules', 'save_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_save', apiName: 'rules',
          requestBody: { kind, rules_size: rulesBytes },
          responseStatus: 500, durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'rule_save_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'rule_save', apiName: 'rules',
        requestBody: { kind, rules_size: rulesBytes },
        responseBody: { id: data?.id },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(200, {
        ok: true,
        kind,
        updated_at: data?.updated_at
      }, corsHeaders)
    }

    // DELETE: reset rules to default
    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const kind = url.searchParams.get('kind') || ''
      if (!VALID_KINDS.has(kind)) {
        return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
      }

      const { error: dbError } = await adminClient
        .from('user_rules')
        .delete()
        .eq('user_id', userId)
        .eq('kind', kind)

      if (dbError) {
        logEdgeError('rules', 'reset_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_reset', apiName: 'rules',
          requestBody: { kind }, responseStatus: 500,
          durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'rule_reset_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'rule_reset', apiName: 'rules',
        requestBody: { kind }, responseStatus: 200,
        durationMs: Date.now() - startTime
      })

      return jsonResponse(200, { ok: true, kind }, corsHeaders)
    }

    return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
  } catch (err) {
    logEdgeError('rules', 'internal_error', err)
    await logOperation({
      clientIp,
      operation: 'rules_error', apiName: 'rules',
      responseStatus: 500, durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : 'internal_error'
    })
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})