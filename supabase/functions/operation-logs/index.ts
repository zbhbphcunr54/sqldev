import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, errorResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const RATE_LIMIT_WINDOW_MS = parsePositiveInt(Deno.env.get('OPLOGS_RATE_LIMIT_WINDOW_MS'), 60_000)
const RATE_LIMIT_MAX_REQUESTS = parsePositiveInt(Deno.env.get('OPLOGS_RATE_LIMIT_MAX_REQUESTS'), 30)
const RATE_LIMIT_TRACK_MAX = parsePositiveInt(Deno.env.get('OPLOGS_RATE_LIMIT_TRACK_MAX'), 2_000)
const RATE_LIMIT_STORE_MODE = String(Deno.env.get('OPLOGS_RATE_LIMIT_STORE') || 'kv').trim().toLowerCase()
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const rateLimiter = createRateLimiter({
  scope: 'operation-logs',
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
      logEdgeError('operation-logs', 'rate_limit_failed', err)
      limit = { ok: true, remaining: RATE_LIMIT_MAX_REQUESTS }
    }
    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    if (req.method !== 'GET') {
      return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey)

    // Check if user is admin
    const { data: adminCheck } = await adminClient
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    const isAdmin = !!adminCheck

    const url = new URL(req.url)
    const page = Math.max(1, parsePositiveInt(url.searchParams.get('page'), 1))
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parsePositiveInt(url.searchParams.get('page_size'), DEFAULT_PAGE_SIZE)))
    const operation = url.searchParams.get('operation') || ''
    const apiName = url.searchParams.get('api_name') || ''
    const startDate = url.searchParams.get('start_date') || ''
    const endDate = url.searchParams.get('end_date') || ''
    const searchUserId = url.searchParams.get('user_id') || ''

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('operation_logs')
      .select('id, created_at, user_id, user_email, client_ip, operation, api_name, response_status, duration_ms, error_message, extra', { count: 'exact' })

    // Non-admin users can only see their own logs
    if (!isAdmin) {
      query = query.eq('user_id', userId)
    } else if (searchUserId) {
      query = query.eq('user_id', searchUserId)
    }

    if (operation) query = query.eq('operation', operation)
    if (apiName) query = query.eq('api_name', apiName)
    if (startDate) query = query.gte('created_at', startDate)
    if (endDate) query = query.lte('created_at', endDate)

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error: dbError, count } = await query

    if (dbError) {
      logEdgeError('operation-logs', 'query_failed', dbError)
      return errorResponse(500, 'logs_query_failed', corsHeaders)
    }

    return jsonResponse(200, {
      ok: true,
      items: data || [],
      total: count || 0,
      page,
      page_size: pageSize,
      is_admin: isAdmin
    }, corsHeaders)
  } catch (err) {
    logEdgeError('operation-logs', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})