import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { parsePositiveInt } from '../_shared/utils.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({})

await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100
const SUMMARY_CACHE_MAX_ENTRIES = 100
const SUMMARY_CACHE_TTL_MS = 60_000
const RATE_LIMIT_CONFIG_TTL_MS = 60_000
const ADMIN_CACHE_TTL_MS = 300_000
const ADMIN_CACHE_MAX_ENTRIES = 500
const STATIC_ADMIN_EMAILS = new Set(
  String(Deno.env.get('OPLOGS_ADMIN_EMAILS') || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
)

const OPERATION_LABELS: Record<string, string> = {
  sql_convert: 'SQL AI转换',
  id_card_generate: '身份证号码生成',
  id_card_validate: '身份证号码校验',
  uscc_generate: '统一社会信用代码生成',
  uscc_validate: '统一社会信用代码校验',
  ziwei_chart_generate: '紫微斗数排盘',
  ziwei_analysis: '命盘AI解读',
  ziwei_qa: '基于AI命盘问答',
  ai_provider_create: '新增供应商',
  ai_provider_update: '编辑供应商',
  ai_provider_delete: '删除供应商',
  ai_config_create: '新增Key',
  ai_config_append_model: '追加模型',
  ai_config_test: '测试Key',
  ai_config_delete: '删除Key',
  ai_chat_message: 'AI助手对话'
}

const CLIENT_LOG_OPERATIONS = new Set([
  'id_card_generate',
  'id_card_validate',
  'uscc_generate',
  'uscc_validate',
  'ziwei_chart_generate'
])

type StatusFilter = '' | 'success' | 'fail'

interface LogFilterParams {
  isAdmin: boolean
  userId: string
  searchUserId: string
  status: StatusFilter
  operation: string
  startDate: string
  endDate: string
}

interface LogSummary {
  total_requests: number
  success_rate: number
  fail_count: number
  avg_duration_ms: number
  p95_duration_ms: number
  active_users: number
}

interface SummaryCacheEntry {
  data: LogSummary
  accessedAt: number
  expiresAt: number
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  trackMax: number
  storeMode: string
}

interface JwtClaims {
  userId: string
  email: string
}

interface ClientLogRequest {
  operation: string
  api_name?: unknown
  request_body?: unknown
  response_body?: unknown
  response_status?: unknown
  duration_ms?: unknown
  error_message?: unknown
  extra?: unknown
}

type RateLimiterInstance = ReturnType<typeof createRateLimiter>

const summaryCache = new Map<string, SummaryCacheEntry>()
let rateLimitConfigCache: { data: RateLimitConfig; expiresAt: number } | null = null
let rateLimiterCache: { key: string; limiter: RateLimiterInstance; expiresAt: number } | null =
  null
const adminCheckCache = new Map<string, { isAdmin: boolean; expiresAt: number }>()

function parseIncludeFlag(value: string | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true
  }
  if (
    normalized === 'false' ||
    normalized === '0' ||
    normalized === 'no' ||
    normalized === 'off'
  ) {
    return false
  }
  return defaultValue
}

function parseRateLimitNumber(value: string | undefined, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
}

function decodeJwtClaims(token: string): JwtClaims | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  const payloadPart = parts[1]
  if (!payloadPart) return null

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const decoded = JSON.parse(atob(padded)) as { sub?: unknown; email?: unknown }
    const userId = typeof decoded.sub === 'string' ? decoded.sub.trim() : ''
    if (!userId) return null
    const email = typeof decoded.email === 'string' ? decoded.email.trim().toLowerCase() : ''
    return { userId, email }
  } catch {
    return null
  }
}

function getRateLimiter(config: RateLimitConfig): RateLimiterInstance {
  const key = `${config.windowMs}:${config.maxRequests}:${config.trackMax}:${config.storeMode}`
  if (rateLimiterCache && rateLimiterCache.key === key && rateLimiterCache.expiresAt > Date.now()) {
    return rateLimiterCache.limiter
  }

  const limiter = createRateLimiter({
    scope: 'operation-logs',
    windowMs: config.windowMs,
    maxRequests: config.maxRequests,
    trackMax: config.trackMax,
    storeMode: config.storeMode
  })

  rateLimiterCache = {
    key,
    limiter,
    expiresAt: Date.now() + RATE_LIMIT_CONFIG_TTL_MS
  }

  return limiter
}

async function loadRateLimitConfig(): Promise<RateLimitConfig> {
  if (rateLimitConfigCache && rateLimitConfigCache.expiresAt > Date.now()) {
    return rateLimitConfigCache.data
  }

  const config: RateLimitConfig = {
    maxRequests: parseRateLimitNumber(
      Deno.env.get('OPLOGS_RATE_LIMIT_MAX_REQUESTS') || undefined,
      30
    ),
    windowMs: parseRateLimitNumber(Deno.env.get('OPLOGS_RATE_LIMIT_WINDOW_MS') || undefined, 60_000),
    trackMax: parseRateLimitNumber(Deno.env.get('OPLOGS_RATE_LIMIT_TRACK_MAX') || undefined, 2000),
    storeMode: String(Deno.env.get('OPLOGS_RATE_LIMIT_STORE') || 'memory').toLowerCase()
  }

  rateLimitConfigCache = {
    data: config,
    expiresAt: Date.now() + RATE_LIMIT_CONFIG_TTL_MS
  }

  return config
}

function toDateRangeStart(dateText: string): string {
  return `${dateText}T00:00:00+08:00`
}

function toDateRangeEnd(dateText: string): string {
  return `${dateText}T23:59:59.999+08:00`
}

function getCacheKey(filters: LogFilterParams): string {
  return JSON.stringify(filters)
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function getCachedSummary(cacheKey: string): LogSummary | null {
  const entry = summaryCache.get(cacheKey)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    summaryCache.delete(cacheKey)
    return null
  }
  entry.accessedAt = Date.now()
  summaryCache.set(cacheKey, entry)
  return entry.data
}

function setCachedSummary(cacheKey: string, summary: LogSummary): void {
  if (!summaryCache.has(cacheKey) && summaryCache.size >= SUMMARY_CACHE_MAX_ENTRIES) {
    let oldestKey: string | null = null
    let oldestAccessedAt = Number.POSITIVE_INFINITY
    for (const [key, value] of summaryCache.entries()) {
      if (value.accessedAt < oldestAccessedAt) {
        oldestAccessedAt = value.accessedAt
        oldestKey = key
      }
    }
    if (oldestKey) summaryCache.delete(oldestKey)
  }

  const now = Date.now()
  summaryCache.set(cacheKey, {
    data: summary,
    accessedAt: now,
    expiresAt: now + SUMMARY_CACHE_TTL_MS
  })
}

async function fetchLogSummary(
  adminClient: ReturnType<typeof createClient>,
  filters: LogFilterParams
): Promise<LogSummary> {
  const cacheKey = getCacheKey(filters)
  const cached = getCachedSummary(cacheKey)
  if (cached) return cached

  const { data, error } = await adminClient.rpc('compute_operation_log_summary', {
    p_is_admin: filters.isAdmin,
    p_user_id: filters.userId,
    p_search_user_id: filters.searchUserId || null,
    p_status: filters.status || null,
    p_operation: filters.operation || null,
    p_start_date: filters.startDate ? toDateRangeStart(filters.startDate) : null,
    p_end_date: filters.endDate ? toDateRangeEnd(filters.endDate) : null
  })

  if (error) {
    logEdgeError('operation-logs', 'summary_rpc_failed', error)
    throw error
  }

  const row = (Array.isArray(data) ? data[0] : null) as
    | {
        total_requests: number | null
        success_rate: number | null
        fail_count: number | null
        avg_duration_ms: number | null
        p95_duration_ms: number | null
        active_users: number | null
      }
    | null

  const result: LogSummary = {
    total_requests: toFiniteNumber(row?.total_requests, 0),
    success_rate: toFiniteNumber(row?.success_rate, 0),
    fail_count: toFiniteNumber(row?.fail_count, 0),
    avg_duration_ms: toFiniteNumber(row?.avg_duration_ms, 0),
    p95_duration_ms: toFiniteNumber(row?.p95_duration_ms, 0),
    active_users: toFiniteNumber(row?.active_users, 0)
  }

  setCachedSummary(cacheKey, result)
  return result
}

function applyStatusFilter<T extends { gte: Function; lt: Function; or: Function }>(
  query: T,
  status: StatusFilter
): T {
  if (status === 'success') {
    return query.gte('response_status', 200).lt('response_status', 400)
  }
  if (status === 'fail') {
    return query.or('response_status.is.null,response_status.lt.200,response_status.gte.400')
  }
  return query
}

function normalizeOperationLabel(operation: string): string {
  if (OPERATION_LABELS[operation]) return OPERATION_LABELS[operation]
  if (operation === 'sql-convert' || operation.startsWith('convert_')) return 'SQL AI转换'
  return operation.replaceAll('_', ' ')
}

function toRecordLike(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

async function writeClientOperationLog(
  userId: string,
  userEmail: string,
  clientIp: string,
  payload: ClientLogRequest
): Promise<void> {
  const operation = String(payload.operation || '').trim()
  if (!CLIENT_LOG_OPERATIONS.has(operation)) {
    throw new Error('invalid_operation')
  }

  const responseStatusRaw = Number(payload.response_status)
  const durationMsRaw = Number(payload.duration_ms)

  await logOperation({
    userId,
    userEmail,
    clientIp,
    operation,
    apiName:
      typeof payload.api_name === 'string' && payload.api_name.trim()
        ? payload.api_name.trim()
        : 'client',
    requestBody: toRecordLike(payload.request_body),
    responseBody: toRecordLike(payload.response_body),
    responseStatus:
      Number.isFinite(responseStatusRaw) && responseStatusRaw >= 100 && responseStatusRaw <= 599
        ? responseStatusRaw
        : 200,
    durationMs:
      Number.isFinite(durationMsRaw) && durationMsRaw >= 0 && durationMsRaw <= 600_000
        ? Math.round(durationMsRaw)
        : 0,
    errorMessage:
      typeof payload.error_message === 'string' && payload.error_message.trim()
        ? payload.error_message.trim().slice(0, 500)
        : undefined,
    extra: toRecordLike(payload.extra)
  })
}

async function buildFilterOptions(
  adminClient: ReturnType<typeof createClient>,
  isAdmin: boolean,
  userId: string,
  searchUserId: string
) {
  let optionQuery = adminClient
    .from('operation_logs')
    .select('operation')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!isAdmin) {
    optionQuery = optionQuery.eq('user_id', userId)
  } else if (searchUserId) {
    optionQuery = optionQuery.eq('user_id', searchUserId)
  }

  const { data: optionRows, error: optionError } = await optionQuery
  if (optionError) throw optionError

  const operationValues = new Set<string>(Object.keys(OPERATION_LABELS))
  for (const row of optionRows || []) {
    if (row.operation && OPERATION_LABELS[row.operation]) operationValues.add(row.operation)
  }

  return {
    operation_options: [
      { value: '', label: '全部操作' },
      ...Array.from(operationValues)
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: normalizeOperationLabel(value) }))
    ]
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    if (!corsHeaders) {
      return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    }
    return new Response('ok', { headers: corsHeaders })
  }
  if (!corsHeaders) {
    return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
  }

  const clientIp = getClientIp(req)

  try {
    if (!SUPABASE_URL) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }

    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const claims = decodeJwtClaims(token)
    if (!claims) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const { userId, email } = claims
    const rateLimitConfig = await loadRateLimitConfig()
    const rateLimiter = getRateLimiter(rateLimitConfig)

    let limit
    try {
      limit = await rateLimiter.consume(`${userId}:${clientIp}`)
    } catch (err) {
      logEdgeError('operation-logs', 'rate_limit_failed', err)
      limit = { ok: true, remaining: rateLimitConfig.maxRequests }
    }

    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey)

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return jsonResponse(400, { error: 'invalid_payload' }, corsHeaders)
      }

      try {
        await writeClientOperationLog(userId, email, clientIp, body as ClientLogRequest)
        return jsonResponse(200, { ok: true }, corsHeaders)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message === 'invalid_operation') {
          return jsonResponse(400, { error: 'invalid_operation' }, corsHeaders)
        }
        logEdgeError('operation-logs', 'write_failed', err)
        return errorResponse(500, 'logs_write_failed', corsHeaders)
      }
    }

    if (req.method !== 'GET') {
      return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
    }

    let isAdmin = false
    if (email) {
      if (STATIC_ADMIN_EMAILS.size > 0) {
        isAdmin = STATIC_ADMIN_EMAILS.has(email)
      } else {
        const cached = adminCheckCache.get(email)
        if (cached && cached.expiresAt > Date.now()) {
          isAdmin = cached.isAdmin
        } else {
          const { data: adminCheck } = await adminClient
            .from('admin_users')
            .select('email')
            .eq('email', email)
            .maybeSingle()

          isAdmin = !!adminCheck
          if (!adminCheckCache.has(email) && adminCheckCache.size >= ADMIN_CACHE_MAX_ENTRIES) {
            for (const [key, value] of adminCheckCache.entries()) {
              if (value.expiresAt <= Date.now()) adminCheckCache.delete(key)
            }
            if (adminCheckCache.size >= ADMIN_CACHE_MAX_ENTRIES) {
              const oldestKey = adminCheckCache.keys().next().value
              if (oldestKey) adminCheckCache.delete(oldestKey)
            }
          }
          adminCheckCache.set(email, {
            isAdmin,
            expiresAt: Date.now() + ADMIN_CACHE_TTL_MS
          })
        }
      }
    }

    const url = new URL(req.url)
    const page = Math.max(1, parsePositiveInt(url.searchParams.get('page'), 1))
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parsePositiveInt(url.searchParams.get('page_size'), DEFAULT_PAGE_SIZE))
    )
    const status = String(url.searchParams.get('status') || '').trim() as StatusFilter
    const operation = url.searchParams.get('operation') || ''
    const startDate = url.searchParams.get('start_date') || ''
    const endDate = url.searchParams.get('end_date') || ''
    const searchUserId = url.searchParams.get('user_id') || ''
    const withSummary = parseIncludeFlag(url.searchParams.get('with_summary'), true)
    const withOptions = parseIncludeFlag(url.searchParams.get('with_options'), true)
    const withTotal = parseIncludeFlag(url.searchParams.get('with_total'), true)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const selectColumns =
      'id, created_at, user_id, user_email, client_ip, operation, api_name, request_body, response_body, response_status, duration_ms, error_message, extra'
    let query = withTotal
      ? adminClient.from('operation_logs').select(selectColumns, { count: 'exact' })
      : adminClient.from('operation_logs').select(selectColumns)

    if (!isAdmin) {
      query = query.eq('user_id', userId)
    } else if (searchUserId) {
      query = query.eq('user_id', searchUserId)
    }

    if (status === 'success' || status === 'fail') {
      query = applyStatusFilter(query, status)
    }
    if (operation) query = query.eq('operation', operation)
    if (startDate) query = query.gte('created_at', toDateRangeStart(startDate))
    if (endDate) query = query.lte('created_at', toDateRangeEnd(endDate))

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error: dbError, count } = await query
    if (dbError) {
      logEdgeError('operation-logs', 'query_failed', dbError)
      return errorResponse(500, 'logs_query_failed', corsHeaders)
    }

    const filters: LogFilterParams = {
      isAdmin,
      userId,
      searchUserId,
      status,
      operation,
      startDate,
      endDate
    }

    const [summary, options] = await Promise.all([
      withSummary ? fetchLogSummary(adminClient, filters) : Promise.resolve(null),
      withOptions ? buildFilterOptions(adminClient, isAdmin, userId, searchUserId) : Promise.resolve(null)
    ])

    const responseData: Record<string, unknown> = {
      ok: true,
      items: data || [],
      page,
      page_size: pageSize,
      is_admin: isAdmin
    }

    if (withTotal) responseData.total = count || 0
    if (summary) {
      responseData.summary = {
        total_requests: summary.total_requests,
        request_change_rate: null,
        success_rate: summary.success_rate,
        fail_count: summary.fail_count,
        avg_duration_ms: summary.avg_duration_ms,
        p95_duration_ms: summary.p95_duration_ms,
        active_users: summary.active_users
      }
    }
    if (options) responseData.operation_options = options.operation_options

    return jsonResponse(200, responseData, corsHeaders)
  } catch (err) {
    logEdgeError('operation-logs', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
