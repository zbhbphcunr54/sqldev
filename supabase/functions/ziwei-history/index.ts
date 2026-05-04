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
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('HISTORY_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('HISTORY_RATE_LIMIT_MAX_REQUESTS'), 30)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('HISTORY_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('HISTORY_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const MAX_HISTORY_PER_USER = 30

const rateLimiter = createRateLimiter({
  scope: 'ziwei-history',
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequests: RATE_LIMIT_MAX_REQUESTS,
  trackMax: RATE_LIMIT_TRACK_MAX,
  storeMode: RATE_LIMIT_STORE_MODE
})

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
      logEdgeError('ziwei-history', 'rate_limit_failed', err)
      limit = { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS }
    }
    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey)

    // GET: list history
    if (req.method === 'GET') {
      const { data, error: dbError } = await adminClient
        .from('ziwei_history')
        .select('id, input_json, result_json, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY_PER_USER)

      if (dbError) {
        logEdgeError('ziwei-history', 'list_failed', dbError)
        return errorResponse(500, 'history_read_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'ziwei_history_list', apiName: 'ziwei-history',
        responseBody: { count: data?.length || 0 },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(200, { ok: true, items: data || [] }, corsHeaders)
    }

    // POST: create history entry
    if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object') {
        return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
      }
      const inputJson = body.input_json
      const resultJson = body.result_json || null
      if (!inputJson || typeof inputJson !== 'object') {
        return jsonResponse(400, { error: 'invalid_input_json' }, corsHeaders)
      }

      const { data, error: dbError } = await adminClient
        .from('ziwei_history')
        .insert({
          user_id: userId,
          input_json: inputJson,
          result_json: resultJson
        })
        .select('id, created_at')
        .single()

      if (dbError) {
        logEdgeError('ziwei-history', 'create_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'ziwei_history_create', apiName: 'ziwei-history',
          responseStatus: 500, durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'history_create_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'ziwei_history_create', apiName: 'ziwei-history',
        responseBody: { id: data?.id },
        responseStatus: 200, durationMs: Date.now() - startTime
      })

      return jsonResponse(201, { ok: true, id: data?.id, created_at: data?.created_at }, corsHeaders)
    }

    // DELETE: delete a history entry
    if (req.method === 'DELETE') {
      const url = new URL(req.url)
      const id = url.searchParams.get('id') || ''
      if (!id) return jsonResponse(400, { error: 'missing_id' }, corsHeaders)

      // Verify ownership before delete
      const { data: existing } = await adminClient
        .from('ziwei_history')
        .select('user_id')
        .eq('id', id)
        .single()

      if (!existing || existing.user_id !== userId) {
        return jsonResponse(404, { error: 'not_found' }, corsHeaders)
      }

      const { error: dbError } = await adminClient
        .from('ziwei_history')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (dbError) {
        logEdgeError('ziwei-history', 'delete_failed', dbError)
        await logOperation({
          userId, userEmail: email, clientIp,
          operation: 'ziwei_history_delete', apiName: 'ziwei-history',
          requestBody: { id }, responseStatus: 500,
          durationMs: Date.now() - startTime,
          errorMessage: dbError.message
        })
        return errorResponse(500, 'history_delete_failed', corsHeaders)
      }

      await logOperation({
        userId, userEmail: email, clientIp,
        operation: 'ziwei_history_delete', apiName: 'ziwei-history',
        requestBody: { id }, responseStatus: 200,
        durationMs: Date.now() - startTime
      })

      return jsonResponse(200, { ok: true, id }, corsHeaders)
    }

    return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
  } catch (err) {
    logEdgeError('ziwei-history', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})