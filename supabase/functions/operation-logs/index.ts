import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, errorResponse, logEdgeError } from '../_shared/response.ts'
import { parsePositiveInt } from '../_shared/utils.ts'
import { getAppConfig } from '../_shared/app-config.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({})

await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

const OPERATION_LABELS: Record<string, string> = {
  convert_ddl: 'DDL 翻译',
  convert_func: '函数翻译',
  convert_proc: '存储过程翻译',
  convert_error: 'SQL 转换异常',
  convert_verify: 'AI 校验',
  convert_verify_error: 'AI 校验异常',
  rule_read: '读取规则',
  rule_save: '保存规则',
  rule_reset: '重置规则',
  rules_error: '规则服务异常',
  ziwei_history_list: '紫微历史查询',
  ziwei_history_create: '紫微历史保存',
  ziwei_history_delete: '紫微历史删除'
}

const API_LABELS: Record<string, string> = {
  convert: 'SQL 转换',
  'convert-verify': 'AI 校验',
  rules: '规则服务',
  'ziwei-history': '紫微历史',
  'ziwei-analysis': '紫微分析',
  feedback: '用户反馈',
  'ai-config': 'AI 配置',
  'app-config': '应用配置',
  'operation-logs': '操作日志'
}

type StatusFilter = '' | 'success' | 'fail'
type LogRowLite = {
  response_status: number | null
  duration_ms: number | null
  user_email: string | null
}

async function loadRateLimitConfig() {
  const [maxRequests, windowMs, trackMax, storeMode] = await Promise.all([
    getAppConfig<number>('rate_limit', 'oplogs_requests', { envVar: 'OPLOGS_RATE_LIMIT_MAX_REQUESTS', defaultValue: 30, parse: Number }),
    getAppConfig<number>('rate_limit', 'oplogs_window_ms', { envVar: 'OPLOGS_RATE_LIMIT_WINDOW_MS', defaultValue: 60000, parse: Number }),
    getAppConfig<number>('rate_limit', 'oplogs_track_max', { envVar: 'OPLOGS_RATE_LIMIT_TRACK_MAX', defaultValue: 2000, parse: Number }),
    getAppConfig('rate_limit', 'store_mode', { envVar: 'OPLOGS_RATE_LIMIT_STORE', defaultValue: 'kv' })
  ])
  return {
    maxRequests: maxRequests.value,
    windowMs: windowMs.value,
    trackMax: trackMax.value,
    storeMode: String(storeMode.value || 'kv').toLowerCase()
  }
}

function toDateRangeStart(dateText: string): string {
  return `${dateText}T00:00:00+08:00`
}

function toDateRangeEnd(dateText: string): string {
  return `${dateText}T23:59:59.999+08:00`
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

  if (operation.startsWith('convert_')) {
    const kind = operation.slice('convert_'.length)
    if (kind === 'ddl') return 'DDL 翻译'
    if (kind === 'func' || kind === 'function') return '函数翻译'
    if (kind === 'proc' || kind === 'procedure') return '存储过程翻译'
    if (kind === 'verify') return 'AI 校验'
    if (kind === 'verify_error' || kind.endsWith('_error')) return 'SQL 转换异常'
    return `SQL 转换（${kind}）`
  }

  if (operation.startsWith('rule_')) {
    const action = operation.slice('rule_'.length)
    if (action === 'read') return '读取规则'
    if (action === 'save') return '保存规则'
    if (action === 'reset') return '重置规则'
  }

  if (operation.startsWith('ziwei_history_')) {
    const action = operation.slice('ziwei_history_'.length)
    if (action === 'list') return '紫微历史查询'
    if (action === 'create') return '紫微历史保存'
    if (action === 'delete') return '紫微历史删除'
  }

  if (operation.endsWith('_error')) {
    const base = operation.slice(0, -'_error'.length).replaceAll('_', ' ')
    return `${base} 异常`
  }

  return operation.replaceAll('_', ' ')
}

function normalizeApiLabel(apiName: string): string {
  if (API_LABELS[apiName]) return API_LABELS[apiName]
  return apiName.replaceAll('-', ' ')
}

async function buildFilterOptions(
  adminClient: ReturnType<typeof createClient>,
  isAdmin: boolean,
  userId: string,
  searchUserId: string
) {
  let optionQuery = adminClient
    .from('operation_logs')
    .select('operation, api_name')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!isAdmin) {
    optionQuery = optionQuery.eq('user_id', userId)
  } else if (searchUserId) {
    optionQuery = optionQuery.eq('user_id', searchUserId)
  }

  const { data: optionRows, error: optionError } = await optionQuery
  if (optionError) throw optionError

  const operationValues = new Set<string>()
  const apiValues = new Set<string>()

  for (const row of optionRows || []) {
    if (row.operation) operationValues.add(row.operation)
    if (row.api_name) apiValues.add(row.api_name)
  }

  for (const key of Object.keys(OPERATION_LABELS)) operationValues.add(key)
  for (const key of Object.keys(API_LABELS)) apiValues.add(key)

  const operation_options = [
    { value: '', label: '全部操作' },
    ...Array.from(operationValues)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: normalizeOperationLabel(value) }))
  ]

  const api_options = [
    { value: '', label: '全部接口' },
    ...Array.from(apiValues)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ value, label: normalizeApiLabel(value) }))
  ]

  return { operation_options, api_options }
}

function computeSummary(items: LogRowLite[]): {
  total_requests: number
  success_rate: number
  fail_count: number
  avg_duration_ms: number
  p95_duration_ms: number
  active_users: number
} {
  const totalCount = items.length
  const successCount = items.filter(
    (item) => item.response_status !== null && item.response_status >= 200 && item.response_status < 400
  ).length
  const failCount = Math.max(0, totalCount - successCount)
  const successRate = totalCount > 0 ? Number(((successCount / totalCount) * 100).toFixed(1)) : 0

  const durations = items
    .map((item) => item.duration_ms)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    .sort((a, b) => a - b)

  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : 0
  const p95Duration =
    durations.length > 0
      ? durations[Math.min(durations.length - 1, Math.floor(durations.length * 0.95))]
      : 0

  const activeUsers = new Set(
    items
      .map((item) => (item.user_email || '').trim().toLowerCase())
      .filter(Boolean)
  ).size

  return {
    total_requests: totalCount,
    success_rate: successRate,
    fail_count: failCount,
    avg_duration_ms: avgDuration,
    p95_duration_ms: Math.round(p95Duration),
    active_users: activeUsers
  }
}

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

    // 异步加载限流配置
    const rateLimitConfig = await loadRateLimitConfig()
    const rateLimiter = createRateLimiter({
      scope: 'operation-logs',
      windowMs: rateLimitConfig.windowMs,
      maxRequests: rateLimitConfig.maxRequests,
      trackMax: rateLimitConfig.trackMax,
      storeMode: rateLimitConfig.storeMode
    })

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
    const status = String(url.searchParams.get('status') || '').trim() as StatusFilter
    const operation = url.searchParams.get('operation') || ''
    const apiName = url.searchParams.get('api_name') || ''
    const startDate = url.searchParams.get('start_date') || ''
    const endDate = url.searchParams.get('end_date') || ''
    const searchUserId = url.searchParams.get('user_id') || ''

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = adminClient
      .from('operation_logs')
      .select('id, created_at, user_id, user_email, client_ip, operation, api_name, request_body, response_body, response_status, duration_ms, error_message, extra', { count: 'exact' })

    // Non-admin users can only see their own logs
    if (!isAdmin) {
      query = query.eq('user_id', userId)
    } else if (searchUserId) {
      query = query.eq('user_id', searchUserId)
    }

    if (status === 'success' || status === 'fail') {
      query = applyStatusFilter(query, status)
    }
    if (operation) query = query.eq('operation', operation)
    if (apiName) query = query.eq('api_name', apiName)
    if (startDate) query = query.gte('created_at', toDateRangeStart(startDate))
    if (endDate) query = query.lte('created_at', toDateRangeEnd(endDate))

    query = query.order('created_at', { ascending: false }).range(from, to)

    const { data, error: dbError, count } = await query

    if (dbError) {
      logEdgeError('operation-logs', 'query_failed', dbError)
      return errorResponse(500, 'logs_query_failed', corsHeaders)
    }

    // Summary cards (按当前筛选范围)
    let summaryQuery = adminClient
      .from('operation_logs')
      .select('response_status, duration_ms, user_email')
    if (startDate) summaryQuery = summaryQuery.gte('created_at', toDateRangeStart(startDate))
    if (endDate) summaryQuery = summaryQuery.lte('created_at', toDateRangeEnd(endDate))

    if (!isAdmin) {
      summaryQuery = summaryQuery.eq('user_id', userId)
    } else if (searchUserId) {
      summaryQuery = summaryQuery.eq('user_id', searchUserId)
    }

    if (status === 'success' || status === 'fail') {
      summaryQuery = applyStatusFilter(summaryQuery, status)
    }
    if (operation) {
      summaryQuery = summaryQuery.eq('operation', operation)
    }
    if (apiName) {
      summaryQuery = summaryQuery.eq('api_name', apiName)
    }

    const [{ data: summaryRows, error: summaryError }, options] =
      await Promise.all([
        summaryQuery,
        buildFilterOptions(adminClient, isAdmin, userId, searchUserId)
      ])

    if (summaryError) {
      logEdgeError('operation-logs', 'summary_failed', summaryError)
      return errorResponse(500, 'logs_summary_failed', corsHeaders)
    }

    const summaryItems = (summaryRows || []) as LogRowLite[]
    const summaryStats = computeSummary(summaryItems)

    const requestChangeRate = null

    return jsonResponse(200, {
      ok: true,
      items: data || [],
      total: count || 0,
      page,
      page_size: pageSize,
      is_admin: isAdmin,
      summary: {
        today_requests: summaryStats.total_requests,
        request_change_rate: requestChangeRate,
        success_rate: summaryStats.success_rate,
        fail_count: summaryStats.fail_count,
        avg_duration_ms: summaryStats.avg_duration_ms,
        p95_duration_ms: summaryStats.p95_duration_ms,
        active_users: summaryStats.active_users
      },
      operation_options: options.operation_options,
      api_options: options.api_options
    }, corsHeaders)
  } catch (err) {
    logEdgeError('operation-logs', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
