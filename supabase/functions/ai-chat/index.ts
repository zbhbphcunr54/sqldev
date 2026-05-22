import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig, handleCors } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp, parseJsonBody } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
import { getAppConfig, getSupabaseEnv, getDefaultAiTimeoutMs } from '../_shared/app-config.ts'
import { resolveAiConfig, type ResolvedAiConfig } from '../_shared/ai-resolver.ts'
import { callAiProvider, callAiProviderStream } from '../_shared/ai-client.ts'
import { logOperation as baseLogOperation } from '../_shared/operation-logger.ts'
import { maskApiKeySync } from '../_shared/crypto.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

await initCorsConfig()
const corsHelpers = createCorsHelpers({})
const { defaultCorsHeaders, buildCorsHeaders } = corsHelpers

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SERVICE_ROLE_KEY } = getSupabaseEnv()

function logOperation(entry: Parameters<typeof baseLogOperation>[0]): Promise<void> {
  if (entry.operation === 'ai_chat_message') {
    return baseLogOperation(entry).catch((e: unknown) => { console.warn('[ai-chat] log failed:', e) })
  }

  if (entry.operation === 'ai_chat_error') {
    const requestBody =
      entry.requestBody && typeof entry.requestBody === 'object' && !Array.isArray(entry.requestBody)
        ? (entry.requestBody as Record<string, unknown>)
        : {}

    if ('messageLength' in requestBody) {
      return baseLogOperation({
        ...entry,
        operation: 'ai_chat_message'
      }).catch((e: unknown) => { console.warn('[ai-chat] log failed:', e) })
    }
  }

  return Promise.resolve()
}

function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase not configured')
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

function getTodayUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

function buildAiRequestUrl(baseUrl: string, providerSlug?: string | null): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (providerSlug === 'claude') {
    return `${base}/messages`
  }
  if (/\/v\d+/.test(base)) {
    return `${base}/chat/completions`
  }
  return `${base}/v1/chat/completions`
}

function createSseResponse(stream: ReadableStream<Uint8Array>, corsHeaders: Record<string, string>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}

function encodeSseEvent(event: string, data: Record<string, unknown>): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new TextEncoder().encode(payload)
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

  // 先检查 RPC 是否存在（正确签名：3 个参数）
  let rpcExists = false
  try {
    const { data: rpcCheck } = await adminClient.rpc('increment_ai_chat_quota', { p_user_id: userId, p_date: today, p_limit: dailyLimit })
    // RPC 成功执行，data 中有结果则取；否则继续查表
    if (rpcCheck) {
      rpcExists = true
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[ai-chat] consumeQuota RPC failed:', msg)
    // 明确告知：迁移未执行
    if (msg.includes('does not exist') || msg.includes('arguments')) {
      console.error('[ai-chat] → 请执行迁移: supabase/migrations/202605110001_fix_ai_chat_quota_race.sql')
    }
  }

  // 直接查表取结果（RPC 如成功已递增，如失败表无变化）
  try {
    const { data } = await adminClient
      .from('ai_chat_quota')
      .select('used_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .single()
    const used = data?.used_count ?? 0
    if (used === 0 && !rpcExists) {
      console.error('[ai-chat] consumeQuota: RPC not executed and no quota record. Check migration.')
    }
    return { allowed: used <= dailyLimit, used, remaining: Math.max(0, dailyLimit - used) }
  } catch (err) {
    console.error('[ai-chat] consumeQuota table read failed:', err)
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

interface SendMessageSuccessResponse {
  ok: true
  sessionId: string
  message: {
    id: string
    role: 'assistant'
    content: string
    created_at: string
  }
  userMessage: {
    id: string
    role: 'user'
    content: string
    created_at: string
  }
  provider: string
  model: string
  quota: {
    used: number
    limit: number
    remaining: number
  }
}

function getAiErrorCode(err: unknown): string {
  const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
  if (isTimeout) return 'ai_request_timeout'
  if (err instanceof Error && err.message.startsWith('ai_')) return err.message
  return 'ai_analysis_failed'
}

function getAiErrorStatus(errorCode: string): number {
  if (errorCode === 'ai_upstream_rate_limited') return 429
  if (errorCode === 'ai_upstream_auth_failed') return 500
  if (errorCode === 'ai_request_timeout') return 504
  return 502
}

function buildSendMessageResponse(args: {
  sessionId: string
  assistantContent: string
  assistantMsg: { id?: string; created_at?: string } | null
  userMsg: { id?: string; created_at?: string } | null
  userContent: string
  aiConfig: ResolvedAiConfig
  quota: { used: number; remaining: number }
  dailyLimit: number
}): SendMessageSuccessResponse {
  return {
    ok: true,
    sessionId: args.sessionId,
    message: {
      id: args.assistantMsg?.id || '',
      role: 'assistant',
      content: args.assistantContent,
      created_at: args.assistantMsg?.created_at || new Date().toISOString()
    },
    userMessage: {
      id: args.userMsg?.id || '',
      role: 'user',
      content: args.userContent,
      created_at: args.userMsg?.created_at || new Date().toISOString()
    },
    provider: args.aiConfig.providerSlug || args.aiConfig.model,
    model: args.aiConfig.model,
    quota: {
      used: args.quota.used,
      limit: args.dailyLimit,
      remaining: args.quota.remaining
    }
  }
}

async function callAi(
  aiConfig: ResolvedAiConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const url = buildAiRequestUrl(aiConfig.baseUrl, aiConfig.providerSlug)
  const apiKeyMasked = aiConfig.apiKey ? maskApiKeySync(aiConfig.apiKey) : '(empty)'
  console.log('[ai-chat] callAi url=', url, 'model=', aiConfig.model, 'apiKey=', apiKeyMasked, 'source=', aiConfig.source, 'stream=', false)

  return callAiProvider(
    {
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      providerSlug: aiConfig.providerSlug,
      timeoutMs: aiConfig.timeoutMs
    },
    messages,
    {
      signal,
      temperature,
      maxTokens
    }
  )
}

async function callAiStream(
  aiConfig: ResolvedAiConfig,
  messages: ChatMessage[],
  signal: AbortSignal,
  temperature: number,
  maxTokens: number,
  onDelta: (text: string) => void
): Promise<string> {
  const url = buildAiRequestUrl(aiConfig.baseUrl, aiConfig.providerSlug)
  const apiKeyMasked = aiConfig.apiKey ? maskApiKeySync(aiConfig.apiKey) : '(empty)'
  console.log('[ai-chat] callAi url=', url, 'model=', aiConfig.model, 'apiKey=', apiKeyMasked, 'source=', aiConfig.source, 'stream=', true)

  return callAiProviderStream(
    {
      baseUrl: aiConfig.baseUrl,
      model: aiConfig.model,
      apiKey: aiConfig.apiKey,
      providerSlug: aiConfig.providerSlug,
      timeoutMs: aiConfig.timeoutMs
    },
    messages,
    {
      onDelta
    },
    {
      signal,
      temperature,
      maxTokens
    }
  )
}

// ── 主 Handler ──
export async function handleAiChatRequest(req: Request): Promise<Response> {
  try {
    const corsResult = handleCors(req, corsHelpers)
    if (corsResult) return corsResult
    const corsHeaders = buildCorsHeaders(req)!

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
      })
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
      })
      return jsonResponse(200, { ok: true, messages: messages || [] }, corsHeaders)
    }

    // GET /ai-chat/quota — 查询配额 + 当前供应商
    if (req.method === 'GET' && path.endsWith('/quota')) {
      const { dailyLimit, maxMessageLength, maxSessions } = await loadChatConfig()
      const quota = await checkQuota(authUser.userId, dailyLimit)
      let provider: string | null = null
      let currentModel: string | null = null
      try {
        const aiConfig = await resolveAiConfig(authUser.userId)
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
      })
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
        })
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
      })
      return jsonResponse(200, { ok: true }, corsHeaders)
    }

    // POST /ai-chat — 发送消息
    if (req.method !== 'POST') {
      return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)
    }

    const payload = await parseJsonBody(req)
    if (!payload) {
      return jsonResponse(400, { ok: false, error: 'invalid_json' }, corsHeaders)
    }

    const { systemPrompt, dailyLimit, contextLimit, temperature, maxTokens, maxMessageLength } = await loadChatConfig()
    const stream = payload.stream === true

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
      })
      return jsonResponse(400, { ok: false, error: 'invalid_message' }, corsHeaders)
    }

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
      })
      return jsonResponse(429, { ok: false, error: 'ai_chat_quota_exceeded', quota }, corsHeaders)
    }

    // 解析 AI 配置
    let aiConfig: ResolvedAiConfig
    try {
      aiConfig = await resolveAiConfig(authUser.userId)
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
      })
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
      })
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
        })
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
    const timeoutId = setTimeout(() => controller.abort(), aiConfig.timeoutMs || await getDefaultAiTimeoutMs())

    if (stream) {
      const responseStream = new ReadableStream<Uint8Array>({
        start(streamController) {
          void (async () => {
            try {
              streamController.enqueue(encodeSseEvent('meta', {
                sessionId,
                provider: aiConfig.providerSlug || aiConfig.model,
                model: aiConfig.model,
                userMessage: {
                  id: userMsg ? (userMsg as { id?: string }).id || '' : '',
                  role: 'user',
                  content: message,
                  created_at: userMsg ? (userMsg as { created_at?: string }).created_at || new Date().toISOString() : new Date().toISOString()
                },
                quota: {
                  used: quota.used,
                  limit: dailyLimit,
                  remaining: quota.remaining
                }
              }))

              const assistantContent = await callAiStream(
                aiConfig,
                messages,
                controller.signal,
                temperature,
                maxTokens,
                (text) => {
                  streamController.enqueue(encodeSseEvent('delta', { text }))
                }
              )

              const { data: assistantMsg } = await adminClient
                .from('ai_chat_messages')
                .insert({ session_id: sessionId, role: 'assistant', content: assistantContent })
                .select('id, created_at')
                .single()

              await adminClient
                .from('ai_chat_sessions')
                .update({ provider_slug: aiConfig.providerSlug, model: aiConfig.model })
                .eq('id', sessionId)

              const responseBody = buildSendMessageResponse({
                sessionId,
                assistantContent,
                assistantMsg: assistantMsg as { id?: string; created_at?: string } | null,
                userMsg: userMsg as { id?: string; created_at?: string } | null,
                userContent: message,
                aiConfig,
                quota,
                dailyLimit
              })

              logOperation({
                userId: authUser.userId,
                userEmail: authUser.email,
                clientIp,
                operation: 'ai_chat_message',
                apiName: 'ai-chat',
                requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model, stream: true },
                responseBody: { sessionId, assistantMsgId: assistantMsg ? (assistantMsg as { id?: string }).id || null : null },
                responseStatus: 200,
                durationMs: Date.now() - startTime,
                extra: { provider: aiConfig.providerSlug, model: aiConfig.model }
              })
              streamController.enqueue(encodeSseEvent('done', responseBody as unknown as Record<string, unknown>))
            } catch (err) {
              const errorCode = getAiErrorCode(err)
              const errorStatus = getAiErrorStatus(errorCode)
              logEdgeError('ai-chat', errorCode, err)
              logOperation({
                userId: authUser.userId,
                userEmail: authUser.email,
                clientIp,
                operation: 'ai_chat_error',
                apiName: 'ai-chat',
                requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model, stream: true },
                responseBody: { error: errorCode },
                responseStatus: errorStatus,
                durationMs: Date.now() - startTime
              })
              streamController.enqueue(encodeSseEvent('error', { error: errorCode }))
            } finally {
              clearTimeout(timeoutId)
              streamController.close()
            }
          })()
        }
      })

      return createSseResponse(responseStream, corsHeaders)
    }

    let assistantContent: string
    try {
      assistantContent = await callAi(aiConfig, messages, controller.signal, temperature, maxTokens)
    } catch (err) {
      const errorCode = getAiErrorCode(err)
      logEdgeError('ai-chat', errorCode, err)
      const errorStatus = getAiErrorStatus(errorCode)
      logOperation({
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        operation: 'ai_chat_error',
        apiName: 'ai-chat',
        requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model, stream: false },
        responseBody: { error: errorCode },
        responseStatus: errorStatus,
        durationMs: Date.now() - startTime
      })
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

    const responseBody = buildSendMessageResponse({
      sessionId,
      assistantContent,
      assistantMsg: assistantMsg as { id?: string; created_at?: string } | null,
      userMsg: userMsg as { id?: string; created_at?: string } | null,
      userContent: message,
      aiConfig,
      quota,
      dailyLimit
    })
    logOperation({
      userId: authUser.userId,
      userEmail: authUser.email,
      clientIp,
      operation: 'ai_chat_message',
      apiName: 'ai-chat',
      requestBody: { messageLength: message.length, sessionId, provider: aiConfig.providerSlug, model: aiConfig.model, stream: false },
      responseBody: { sessionId, assistantMsgId: assistantMsg ? (assistantMsg as { id: string }).id : null },
      responseStatus: 200,
      durationMs: Date.now() - startTime,
      extra: { provider: aiConfig.providerSlug, model: aiConfig.model }
    })
    return jsonResponse(200, responseBody, corsHeaders)
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    logEdgeError('ai-chat', 'unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
}

Deno.serve(handleAiChatRequest)
