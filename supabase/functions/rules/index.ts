// supabase/functions/rules/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, errorResponse, logEdgeError } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { getAppConfig } from '../_shared/app-config.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  allowMethods: 'POST, PUT, DELETE, OPTIONS'
})

await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const MAX_RULES_JSON_BYTES = 50 * 1024

const VALID_KINDS = new Set(['ddl', 'body'])
const VALID_DBS = new Set(['oracle', 'mysql', 'pg'])

async function loadRateLimitConfig() {
  const [maxRequests, windowMs, trackMax, storeMode] = await Promise.all([
    getAppConfig<number>('rate_limit', 'rules_requests', { envVar: 'RULES_RATE_LIMIT_MAX_REQUESTS', defaultValue: 10, parse: Number }),
    getAppConfig<number>('rate_limit', 'rules_window_ms', { envVar: 'RULES_RATE_LIMIT_WINDOW_MS', defaultValue: 60000, parse: Number }),
    getAppConfig<number>('rate_limit', 'rules_track_max', { envVar: 'RULES_RATE_LIMIT_TRACK_MAX', defaultValue: 2000, parse: Number }),
    getAppConfig('rate_limit', 'store_mode', { envVar: 'RULES_RATE_LIMIT_STORE', defaultValue: 'kv' })
  ])
  return {
    maxRequests: maxRequests.value,
    windowMs: windowMs.value,
    trackMax: trackMax.value,
    storeMode: String(storeMode.value || 'kv').toLowerCase()
  }
}

async function getDefaultRules(
  adminClient: ReturnType<typeof createClient>,
  sourceDb: string,
  targetDb: string,
  kind: string
): Promise<unknown[]> {
  const { data, error } = await adminClient
    .from('user_rules')
    .select('rules_json')
    .is('user_id', null)
    .eq('source_db', sourceDb)
    .eq('target_db', targetDb)
    .eq('kind', kind)
    .maybeSingle()

  if (error || !data) {
    return []
  }

  return data.rules_json || []
}

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

    // 异步加载限流配置
    const rateLimitConfig = await loadRateLimitConfig()
    const rateLimiter = createRateLimiter({
      scope: 'rules',
      windowMs: rateLimitConfig.windowMs,
      maxRequests: rateLimitConfig.maxRequests,
      trackMax: rateLimitConfig.trackMax,
      storeMode: rateLimitConfig.storeMode
    })

    let limit
    try {
      limit = await rateLimiter.consume(`${userId}:${clientIp}`)
    } catch (err) {
      logEdgeError('rules', 'rate_limit_failed', err)
      limit = { ok: true, remaining: rateLimitConfig.maxRequests }
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
      const url = new URL(req.url)
      // Check if this is a reset request
      if (url.pathname.endsWith('/reset')) {
        const body = await req.json().catch(() => null)
        if (!body || typeof body !== 'object') {
          return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
        }
        const sourceDb = String(body.source_db || '')
        const targetDb = String(body.target_db || '')
        const kind = String(body.kind || '')

        if (!VALID_DBS.has(sourceDb) || !VALID_DBS.has(targetDb)) {
          return jsonResponse(400, { error: 'invalid_db' }, corsHeaders)
        }
        if (!VALID_KINDS.has(kind)) {
          return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
        }

        // Delete user's custom rules, will fall back to system defaults
        const { error: dbError } = await adminClient
          .from('user_rules')
          .delete()
          .eq('user_id', userId)
          .eq('source_db', sourceDb)
          .eq('target_db', targetDb)
          .eq('kind', kind)

        if (dbError) {
          logEdgeError('rules', 'reset_failed', dbError)
          await logOperation({
            userId, userEmail: email, clientIp,
            operation: 'rule_reset', apiName: 'rules',
            requestBody: { source_db: sourceDb, target_db: targetDb, kind },
            responseStatus: 500, durationMs: Date.now() - startTime,
            errorMessage: dbError.message
          })
          return errorResponse(500, 'rule_reset_failed', corsHeaders)
        }

        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_reset', apiName: 'rules',
          requestBody: { source_db: sourceDb, target_db: targetDb, kind },
          responseStatus: 200, durationMs: Date.now() - startTime
        })

        return jsonResponse(200, { ok: true, source_db: sourceDb, target_db: targetDb, kind }, corsHeaders)
      }

      // Normal read request
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
      }
      const sourceDb = String(body.source_db || '')
      const targetDb = String(body.target_db || '')
      const kind = String(body.kind || '')

      if (!VALID_DBS.has(sourceDb) || !VALID_DBS.has(targetDb)) {
        return jsonResponse(400, { error: 'invalid_db' }, corsHeaders)
      }
      if (!VALID_KINDS.has(kind)) {
        return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
      }

      // First check user rules, if not found, use system default rules
      const { data, error: dbError } = await adminClient
        .from('user_rules')
        .select('id, rules_json, updated_at')
        .eq('user_id', userId)
        .eq('source_db', sourceDb)
        .eq('target_db', targetDb)
        .eq('kind', kind)
        .maybeSingle()

      if (dbError) {
        logEdgeError('rules', 'read_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_read', apiName: 'rules',
          requestBody: { source_db: sourceDb, target_db: targetDb, kind },
          responseStatus: 500, durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'rule_read_failed', corsHeaders)
      }

      // If user has custom rules, return them
      if (data) {
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_read', apiName: 'rules',
          requestBody: { source_db: sourceDb, target_db: targetDb, kind },
          responseBody: { found: true, rule_id: data.id },
          responseStatus: 200, durationMs: Date.now() - startTime
        })

        return jsonResponse(200, {
          ok: true,
          id: data.id,
          source_db: sourceDb,
          target_db: targetDb,
          kind,
          rules_json: data.rules_json,
          updated_at: data.updated_at
        }, corsHeaders)
      }

      // Fall back to system default rules
      const defaultRules = await getDefaultRules(adminClient, sourceDb, targetDb, kind)

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'rule_read', apiName: 'rules',
        requestBody: { source_db: sourceDb, target_db: targetDb, kind },
        responseBody: { found: false, is_default: true },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(200, {
        ok: true,
        id: 0,
        source_db: sourceDb,
        target_db: targetDb,
        kind,
        rules_json: defaultRules,
        updated_at: null
      }, corsHeaders)
    }

    // PUT: save rules
    if (req.method === 'PUT') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
      }
      const sourceDb = String(body.source_db || '')
      const targetDb = String(body.target_db || '')
      const kind = String(body.kind || '')
      const rulesJson = body.rules_json

      if (!VALID_DBS.has(sourceDb) || !VALID_DBS.has(targetDb)) {
        return jsonResponse(400, { error: 'invalid_db' }, corsHeaders)
      }
      if (!VALID_KINDS.has(kind)) {
        return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
      }
      if (!rulesJson || !Array.isArray(rulesJson)) {
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
          source_db: sourceDb,
          target_db: targetDb,
          kind,
          rules_json: rulesJson
        }, { onConflict: 'user_id,source_db,target_db,kind' })
        .select('id, updated_at')
        .single()

      if (dbError) {
        logEdgeError('rules', 'save_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'rule_save', apiName: 'rules',
          requestBody: { source_db: sourceDb, target_db: targetDb, kind, rules_size: rulesBytes },
          responseStatus: 500, durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'rule_save_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'rule_save', apiName: 'rules',
        requestBody: { source_db: sourceDb, target_db: targetDb, kind, rules_size: rulesBytes },
        responseBody: { id: data?.id },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(200, {
        ok: true,
        id: data?.id,
        source_db: sourceDb,
        target_db: targetDb,
        kind,
        rules_json: rulesJson,
        updated_at: data?.updated_at
      }, corsHeaders)
    }

    // DELETE: deprecated, use POST /reset instead
    if (req.method === 'DELETE') {
      return jsonResponse(405, { error: 'method_not_allowed', message: 'Use POST /rules/reset instead' }, corsHeaders)
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
