import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'
import { resolveAiConfig, type ResolvedAiConfig } from '../_shared/ai-resolver.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

await initCorsConfig()
const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase not configured')
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

function getTodayUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

// ── 配置缓存 ──
let cachedSystemPrompt: string | null = null
let cachedDailyLimit: number | null = null
let cachedContextLimit: number | null = null
let cachedTemperature: number | null = null
let cachedMaxTokens: number | null = null
let cachedMaxMessageLength: number | null = null
let cachedMaxSessions: number | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000

async function loadChatConfig(): Promise<{
  systemPrompt: string; dailyLimit: number; contextLimit: number
  temperature: number; maxTokens: number; maxMessageLength: number; maxSessions: number
}> {
  const now = Date.now()
  if (cachedSystemPrompt !== null && cachedDailyLimit !== null && cachedContextLimit !== null && cachedTemperature !== null && cachedMaxTokens !== null && cachedMaxMessageLength !== null && cachedMaxSessions !== null && now - configCacheTime < CONFIG_CACHE_TTL) {
    return { systemPrompt: cachedSystemPrompt, dailyLimit: cachedDailyLimit, contextLimit: cachedContextLimit, temperature: cachedTemperature, maxTokens: cachedMaxTokens, maxMessageLength: cachedMaxMessageLength, maxSessions: cachedMaxSessions }
  }
  const [systemPromptResult, dailyLimitResult, contextLimitResult, temperatureResult, maxTokensResult, maxMessageLengthResult, maxSessionsResult] = await Promise.all([
    getAppConfig('ai_chat', 'system_prompt', {
      envVar: 'AI_CHAT_SYSTEM_PROMPT',
      defaultValue: '你是 SQLDev 的 AI 数据库助手。'
    }),
    getAppConfig<number>('ai_chat', 'daily_limit', {
      envVar: 'AI_CHAT_DAILY_LIMIT',
      defaultValue: 20,
      parse: Number
    }),
    getAppConfig<number>('ai_chat', 'context_limit', {
      envVar: 'AI_CHAT_CONTEXT_LIMIT',
      defaultValue: 0,
      parse: Number
    }),
    getAppConfig<number>('ai_chat', 'temperature', {
      envVar: 'AI_CHAT_TEMPERATURE',
      parse: Number
    }),
    getAppConfig<number>('ai_chat', 'max_tokens', {
      envVar: 'AI_CHAT_MAX_TOKENS',
      parse: Number
    }),
    getAppConfig<number>('ai_chat', 'max_message_length', {
      envVar: 'AI_CHAT_MAX_MESSAGE_LENGTH',
      defaultValue: 4000,
      parse: Number
    }),
    getAppConfig<number>('ai_chat', 'max_sessions', {
      envVar: 'AI_CHAT_MAX_SESSIONS',
      defaultValue: 50,
      parse: Number
    })
  ])
  cachedSystemPrompt = systemPromptResult.value
  cachedDailyLimit = dailyLimitResult.value
  cachedContextLimit = contextLimitResult.value
  cachedTemperature = temperatureResult.value
  cachedMaxTokens = maxTokensResult.value
  cachedMaxMessageLength = maxMessageLengthResult.value
  cachedMaxSessions = maxSessionsResult.value
  configCacheTime = now
  return { systemPrompt: cachedSystemPrompt, dailyLimit: cachedDailyLimit, contextLimit: cachedContextLimit, temperature: cachedTemperature, maxTokens: cachedMaxTokens, maxMessageLength: cachedMaxMessageLength, maxSessions: cachedMaxSessions }
}

// ── 限流器（延迟初始化，读取统一全局限流配置）──
let rateLimiter: ReturnType<typeof createRateLimiter> | null = null

async function getRateLimiter(): Promise<ReturnType<typeof createRateLimiter>> {
  if (rateLimiter) return rateLimiter
  const [maxRequests, windowMs] = await Promise.all([
    getAppConfig<number>('rate_limit', 'max_requests', { defaultValue: 10, parse: Number }),
    getAppConfig<number>('rate_limit', 'window_ms', { defaultValue: 60000, parse: Number })
  ])
  rateLimiter = createRateLimiter({
    scope: 'ai_chat',
    windowMs: windowMs.value,
    maxRequests: maxRequests.value,
    trackMax: 500,
    storeMode: 'kv'
  })
  return rateLimiter
}

// ── 配额（原子检查+递增）──
async function consumeQuota(userId: string, dailyLimit: number): Promise<{ allowed: boolean; used: number; remaining: number }> {
  let adminClient: SupabaseClient
  try {
    adminClient = getAdminClient()
  } catch {
    return { allowed: true, used: 0, remaining: dailyLimit }
  }
  const today = getTodayUTC8()
  try {
    const { data } = await adminClient.rpc('increment_ai_chat_quota', { p_user_id: userId, p_date: today, p_limit: dailyLimit })
    if (data) {
      return { allowed: data.allowed, used: data.used_count, remaining: data.remaining }
    }
    return { allowed: true, used: 0, remaining: dailyLimit }
  } catch (err) {
    console.error('[ai-chat] Failed to consume quota:', err)
    return { allowed: true, used: 0, remaining: dailyLimit }
  }
}

async function checkQuota(userId: string, dailyLimit: number): Promise<{ allowed: boolean; used: number; remaining: number }> {
  let adminClient: SupabaseClient
  try {
    adminClient = getAdminClient()
  } catch {
    return { allowed: true, used: 0, remaining: dailyLimit }
  }
  const today = getTodayUTC8()
  try {
    const { data } = await adminClient
      .from('ai_chat_quota')
      .select('used_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()
    const used = data?.used_count ?? 0
    return { allowed: used < dailyLimit, used, remaining: Math.max(0, dailyLimit - used) }
  } catch (err) {
    console.error('[ai-chat] Quota check failed:', err)
    return { allowed: false, used: 0, remaining: 0 }
  }
}

// ── AI 调用 ──
interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

async function callAi(
  aiConfig: ResolvedAiConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const base = aiConfig.baseUrl.replace(/\/+$/, '')
  const url = /\/v\d+/.test(base) ? base + '/chat/completions' : base + '/v1/chat/completions'
  const apiKeyMasked = aiConfig.apiKey ? '***' + aiConfig.apiKey.slice(-4) : '(empty)'
  console.log('[ai-chat] callAi url=', url, 'model=', aiConfig.model, 'apiKey=', apiKeyMasked, 'source=', aiConfig.source)
  const body = {
    model: aiConfig.model,
    messages,
    temperature,
    max_tokens: maxTokens
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${aiConfig.apiKey}`
    },
    body: JSON.stringify(body),
    signal
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    if (res.status === 429) throw new Error('ai_upstream_rate_limited')
    if (res.status === 401 || res.status === 403) throw new Error('ai_upstream_auth_failed')
    if (res.status >= 500) throw new Error('ai_upstream_unavailable')
    console.error('[ai-chat] ai_upstream_error: status', res.status, 'body:', errText.slice(0, 500))
    throw new Error('ai_upstream_error')
  }
  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('ai_response_invalid')
  }
  return content.trim()
}

// ── 主 Handler ──
export async function handleAiChatRequest(req: Request): Promise<Response> {
  try {
    const corsHeaders = buildCorsHeaders(req) || defaultCorsHeaders()

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const startTime = Date.now()
    const clientIp = getClientIp(req)

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { ok: false, error: 'supabase_env_missing' }, corsHeaders)
    }

    const authUser = await validateBearerToken(req.headers.get('authorization'), {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (!authUser) return jsonResponse(401, { ok: false, error: 'unauthorized' }, corsHeaders)

    // 限流（统一读取全局限流配置）
    const rl = await getRateLimiter()
    const rateResult = await rl.consume(`${authUser.userId}|${clientIp}`)
    if (!rateResult.ok) {
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(rateResult.retryAfter)
      })
    }

    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/+|\/+$/g, '')

    // GET /ai-chat/sessions — 列出会话
    if (req.method === 'GET' && path.endsWith('/sessions')) {
      const adminClient = getAdminClient()
      const { maxSessions } = await loadChatConfig()
      const { data } = await adminClient
        .from('ai_chat_sessions')
        .select('id, title, provider_slug, model, created_at, updated_at')
        .eq('user_id', authUser.userId)
        .order('updated_at', { ascending: false })
        .limit(maxSessions)
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_list_sessions',
        apiName: 'ai-chat',
        responseBody: { count: data?.length || 0 },
        responseStatus: 200,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(200, { ok: true, sessions: data || [] }, corsHeaders)
    }

    // GET /ai-chat/messages?sessionId=xxx — 获取消息
    if (req.method === 'GET' && path.endsWith('/messages')) {
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId) return jsonResponse(400, { ok: false, error: 'missing_session_id' }, corsHeaders)
      const adminClient = getAdminClient()
      // 验证 session 归属
      const { data: session } = await adminClient
        .from('ai_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', authUser.userId)
        .single()
      if (!session) return jsonResponse(404, { ok: false, error: 'session_not_found' }, corsHeaders)
      const { data: messages } = await adminClient
        .from('ai_chat_messages')
        .select('id, role, content, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(100)
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_get_messages',
        apiName: 'ai-chat',
        responseBody: { sessionId, count: messages?.length || 0 },
        responseStatus: 200,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(200, { ok: true, messages: messages || [] }, corsHeaders)
    }

    // GET /ai-chat/quota — 查询配额 + 当前供应商
    if (req.method === 'GET' && path.endsWith('/quota')) {
      const { dailyLimit, maxMessageLength, maxSessions } = await loadChatConfig()
      const quota = await checkQuota(authUser.userId, dailyLimit)
      let provider: string | null = null
      let currentModel: string | null = null
      try {
        const aiConfig = await resolveAiConfig()
        provider = aiConfig.providerSlug
        currentModel = aiConfig.model
      } catch {
        // 提供商标识获取失败不影响配额查询
      }
      const responseBody = {
        ok: true,
        quota: { ...quota, limit: dailyLimit },
        provider,
        model: currentModel,
        maxMessageLength,
        maxSessions
      }
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_check_quota',
        apiName: 'ai-chat',
        responseBody,
        responseStatus: 200,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(200, responseBody, corsHeaders)
    }

    // DELETE /ai-chat/sessions/:id — 删除会话
    if (req.method === 'DELETE' && path.includes('/sessions/')) {
      const sessionId = path.split('/sessions/')[1]
      if (!sessionId) return jsonResponse(400, { ok: false, error: 'missing_session_id' }, corsHeaders)
      const adminClient = getAdminClient()
      const { error } = await adminClient
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', authUser.userId)
      if (error) {
        logEdgeError('ai-chat', 'delete_session', error)
        logOperation({
          userId: authUser.userId,
          userEmail: authUser.email,
          clientIp,
          operation: 'ai_chat_error',
          apiName: 'ai-chat',
          requestBody: { sessionId },
          responseBody: { error: 'server_error' },
          responseStatus: 500,
          durationMs: Date.now() - startTime
        }).catch(() => {})
        return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
      }
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_delete_session',
        apiName: 'ai-chat',
        requestBody: { sessionId },
        responseBody: { ok: true },
        responseStatus: 200,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(200, { ok: true }, corsHeaders)
    }

    // POST /ai-chat — 发送消息
    if (req.method !== 'POST') {
      return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = await req.json()
    } catch {
      return jsonResponse(400, { ok: false, error: 'invalid_json' }, corsHeaders)
    }

    const { systemPrompt, dailyLimit, contextLimit, temperature, maxTokens, maxMessageLength } = await loadChatConfig()

    const message = typeof payload.message === 'string' ? payload.message.trim() : ''
    if (!message || message.length > maxMessageLength) {
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length },
        responseBody: { error: 'invalid_message' },
        responseStatus: 400,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(400, { ok: false, error: 'invalid_message' }, corsHeaders)
    }

    const { systemPrompt, dailyLimit, contextLimit, temperature, maxTokens } = await loadChatConfig()

    // 原子配额检查+递增
    const quota = await consumeQuota(authUser.userId, dailyLimit)
    if (!quota.allowed) {
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length },
        responseBody: { error: 'ai_chat_quota_exceeded', quota },
        responseStatus: 429,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(429, { ok: false, error: 'ai_chat_quota_exceeded', quota }, corsHeaders)
    }

    // 解析 AI 配置
    let aiConfig: ResolvedAiConfig
    try {
      aiConfig = await resolveAiConfig()
    } catch (err) {
      logEdgeError('ai-chat', 'resolve_ai_config', err)
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length },
        responseBody: { error: 'ai_config_not_found' },
        responseStatus: 500,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(500, { ok: false, error: 'ai_config_not_found' }, corsHeaders)
    }

    if (!aiConfig.apiKey) {
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length },
        responseBody: { error: 'ai_config_not_found' },
        responseStatus: 500,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(500, { ok: false, error: 'ai_config_not_found' }, corsHeaders)
    }

    const adminClient = getAdminClient()

    // 获取或创建会话
    let sessionId = typeof payload.sessionId === 'string' ? payload.sessionId : null
    if (sessionId) {
      const { data: existing } = await adminClient
        .from('ai_chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('user_id', authUser.userId)
        .single()
      if (!existing) sessionId = null
    }

    if (!sessionId) {
      const title = message.length > 40 ? message.slice(0, 40) + '...' : message
      const { data: newSession } = await adminClient
        .from('ai_chat_sessions')
        .insert({
          user_id: authUser.userId,
          title,
          provider_slug: aiConfig.providerSlug,
          model: aiConfig.model
        })
        .select('id')
        .single()
      if (!newSession) {
        logOperation({
          userId: authUser.userId,
          userEmail: authUser.email,
          clientIp,
          operation: 'ai_chat_error',
          apiName: 'ai-chat',
          requestBody: { messageLength: message.length },
          responseBody: { error: 'server_error' },
          responseStatus: 500,
          durationMs: Date.now() - startTime
        }).catch(() => {})
        return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
      }
      sessionId = (newSession as { id: string }).id
    }

    // 保存用户消息
    const { data: userMsg } = await adminClient
      .from('ai_chat_messages')
      .insert({ session_id: sessionId, role: 'user', content: message })
      .select('id, created_at')
      .single()

    // 根据配置加载历史上下文
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }]
    if (contextLimit > 0) {
      const { data: history } = await adminClient
        .from('ai_chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(contextLimit)
      const ordered = (history || []).reverse() as { role: string; content: string }[]
      for (const m of ordered) {
        if (m.role === 'user' || m.role === 'assistant') {
          messages.push({ role: m.role, content: m.content })
        }
      }
    } else {
      messages.push({ role: 'user', content: message })
    }

    // 调用 AI
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), aiConfig.timeoutMs || 30000)

    let assistantContent: string
    try {
      assistantContent = await callAi(aiConfig, messages, controller.signal, temperature, maxTokens)
    } catch (err) {
      const errorCode = err instanceof Error && err.message.startsWith('ai_')
        ? err.message
        : 'ai_analysis_failed'
      logEdgeError('ai-chat', errorCode, err)
      const errorStatus = errorCode === 'ai_upstream_rate_limited' ? 429
        : errorCode === 'ai_upstream_auth_failed' ? 500
        : errorCode === 'ai_request_timeout' ? 504
        : 502
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model },
        responseBody: { error: errorCode },
        responseStatus: errorStatus,
        durationMs: Date.now() - startTime
      }).catch(() => {})
      return jsonResponse(errorStatus, { ok: false, error: errorCode }, corsHeaders)
    } finally {
      clearTimeout(timeoutId)
    }

    // 保存助手消息
    const { data: assistantMsg } = await adminClient
      .from('ai_chat_messages')
      .insert({ session_id: sessionId, role: 'assistant', content: assistantContent })
      .select('id, created_at')
      .single()

    // 更新会话的 provider_slug / model（首次可能未写入）
    await adminClient
      .from('ai_chat_sessions')
      .update({ provider_slug: aiConfig.providerSlug, model: aiConfig.model })
      .eq('id', sessionId)

    const responseBody = {
      ok: true,
      sessionId,
      message: {
        id: assistantMsg ? (assistantMsg as { id: string }).id : '',
        role: 'assistant',
        content: assistantContent,
        created_at: assistantMsg ? (assistantMsg as { created_at: string }).created_at : new Date().toISOString()
      },
      userMessage: {
        id: userMsg ? (userMsg as { id: string }).id : '',
        role: 'user',
        content: message,
        created_at: userMsg ? (userMsg as { created_at: string }).created_at : new Date().toISOString()
      },
      provider: aiConfig.providerSlug || aiConfig.model,
      model: aiConfig.model,
      quota: {
        used: quota.used,
        limit: dailyLimit,
        remaining: quota.remaining
      }
    }
    logOperation({
      userId: authUser.userId,
      userEmail: authUser.email,
      clientIp,
      operation: 'ai_chat_message',
      apiName: 'ai-chat',
      requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model },
      responseBody: { sessionId, assistantMsgId: assistantMsg ? (assistantMsg as { id: string }).id : null },
      responseStatus: 200,
      durationMs: Date.now() - startTime,
      extra: { provider: aiConfig.providerSlug, model: aiConfig.model }
    }).catch(() => {})
    return jsonResponse(200, responseBody, corsHeaders)
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    logEdgeError('ai-chat', 'unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
}

Deno.serve(handleAiChatRequest)
