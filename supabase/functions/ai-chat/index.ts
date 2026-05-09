import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'
import { resolveAiConfig, type ResolvedAiConfig } from '../_shared/ai-resolver.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({})
await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null
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
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000

async function loadChatConfig(): Promise<{ systemPrompt: string; dailyLimit: number }> {
  const now = Date.now()
  if (cachedSystemPrompt !== null && cachedDailyLimit !== null && now - configCacheTime < CONFIG_CACHE_TTL) {
    return { systemPrompt: cachedSystemPrompt, dailyLimit: cachedDailyLimit }
  }
  const [systemPromptResult, dailyLimitResult] = await Promise.all([
    getAppConfig('ai_chat', 'system_prompt', {
      envVar: 'AI_CHAT_SYSTEM_PROMPT',
      defaultValue: '你是 SQLDev 的 AI 数据库助手。'
    }),
    getAppConfig<number>('ai_chat', 'daily_limit', {
      envVar: 'AI_CHAT_DAILY_LIMIT',
      defaultValue: 20,
      parse: Number
    })
  ])
  cachedSystemPrompt = systemPromptResult.value
  cachedDailyLimit = dailyLimitResult.value
  configCacheTime = now
  return { systemPrompt: cachedSystemPrompt, dailyLimit: cachedDailyLimit }
}

// ── 限流器 ──
const rateLimiter = createRateLimiter({
  scope: 'ai_chat',
  windowMs: 60_000,
  maxRequests: 10,
  trackMax: 500,
  storeMode: 'kv'
})

// ── 配额 ──
async function checkQuota(userId: string, dailyLimit: number): Promise<{ allowed: boolean; used: number; remaining: number }> {
  const adminClient = getAdminClient()
  if (!adminClient) return { allowed: true, used: 0, remaining: dailyLimit }
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
  } catch {
    return { allowed: true, used: 0, remaining: dailyLimit }
  }
}

async function incrementQuota(userId: string): Promise<void> {
  const adminClient = getAdminClient()
  if (!adminClient) return
  const today = getTodayUTC8()
  try {
    await adminClient.rpc('increment_ai_chat_quota', { p_user_id: userId, p_date: today })
  } catch (err) {
    console.error('[ai-chat] Failed to increment quota:', err)
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
  signal: AbortSignal
): Promise<string> {
  // 智能拼接 chat completions 端点
  // baseUrl 可能已包含版本号（/v1, /v4 等），也可能不含
  const base = aiConfig.baseUrl.replace(/\/+$/, '')
  const url = /\/v\d+/.test(base) ? base + '/chat/completions' : base + '/v1/chat/completions'
  const apiKeyMasked = aiConfig.apiKey ? '***' + aiConfig.apiKey.slice(-4) : '(empty)'
  console.log('[ai-chat] callAi url=', url, 'model=', aiConfig.model, 'apiKey=', apiKeyMasked, 'source=', aiConfig.source)
  const body = {
    model: aiConfig.model,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
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
        if (res.status >= 500 && attempt < 1) { lastError = new Error('ai_upstream_unavailable'); continue }
        throw new Error(`ai_upstream_error: ${res.status} ${errText.slice(0, 200)}`)
      }
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) {
        throw new Error('ai_response_invalid')
      }
      return content.trim()
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('ai_')) throw err
      if (err instanceof DOMException && err.name === 'AbortError') throw new Error('ai_request_timeout')
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }
  throw lastError || new Error('ai_upstream_unavailable')
}

// ── 主 Handler ──
export async function handleAiChatRequest(req: Request): Promise<Response> {
  try {
    // OPTIONS 预检请求必须优先处理，返回 200 否则浏览器拒绝 CORS
    if (req.method === 'OPTIONS') {
      const origin = req.headers.get('origin') || ''
      return new Response('ok', {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      })
    }

    // CORS origin 校验失败时不阻断请求，回退到 defaultCorsHeaders 允许任意来源
    const corsHeaders = buildCorsHeaders(req) || defaultCorsHeaders()
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { ok: false, error: 'supabase_env_missing' }, corsHeaders)
    }

    const authUser = await validateBearerToken(req.headers.get('authorization'), {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (!authUser) return jsonResponse(401, { ok: false, error: 'unauthorized' }, corsHeaders)

    // 限流
    const clientIp = getClientIp(req)
    const rateResult = await rateLimiter.consume(`${authUser.userId}|${clientIp}`)
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
      if (!adminClient) return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
      const { data } = await adminClient
        .from('ai_chat_sessions')
        .select('id, title, provider_slug, model, created_at, updated_at')
        .eq('user_id', authUser.userId)
        .order('updated_at', { ascending: false })
        .limit(50)
      return jsonResponse(200, { ok: true, sessions: data || [] }, corsHeaders)
    }

    // GET /ai-chat/messages?sessionId=xxx — 获取消息
    if (req.method === 'GET' && path.endsWith('/messages')) {
      const sessionId = url.searchParams.get('sessionId')
      if (!sessionId) return jsonResponse(400, { ok: false, error: 'missing_session_id' }, corsHeaders)
      const adminClient = getAdminClient()
      if (!adminClient) return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
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
      return jsonResponse(200, { ok: true, messages: messages || [] }, corsHeaders)
    }

    // GET /ai-chat/quota — 查询配额 + 当前供应商
    if (req.method === 'GET' && path.endsWith('/quota')) {
      const { dailyLimit } = await loadChatConfig()
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
      return jsonResponse(200, {
        ok: true,
        quota: { ...quota, limit: dailyLimit },
        provider,
        model: currentModel
      }, corsHeaders)
    }

    // DELETE /ai-chat/sessions/:id — 删除会话
    if (req.method === 'DELETE' && path.includes('/sessions/')) {
      const sessionId = path.split('/sessions/')[1]
      if (!sessionId) return jsonResponse(400, { ok: false, error: 'missing_session_id' }, corsHeaders)
      const adminClient = getAdminClient()
      if (!adminClient) return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
      const { error } = await adminClient
        .from('ai_chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', authUser.userId)
      if (error) {
        logEdgeError('ai-chat', 'delete_session', error)
        return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)
      }
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

    const message = typeof payload.message === 'string' ? payload.message.trim() : ''
    if (!message || message.length > 4000) {
      return jsonResponse(400, { ok: false, error: 'invalid_message' }, corsHeaders)
    }

    const { systemPrompt, dailyLimit } = await loadChatConfig()

    // 配额检查
    const quota = await checkQuota(authUser.userId, dailyLimit)
    if (!quota.allowed) {
      return jsonResponse(429, { ok: false, error: 'ai_chat_quota_exceeded', quota }, corsHeaders)
    }

    // 解析 AI 配置
    let aiConfig: ResolvedAiConfig
    try {
      aiConfig = await resolveAiConfig()
    } catch (err) {
      logEdgeError('ai-chat', 'resolve_ai_config', err)
      return jsonResponse(500, { ok: false, error: 'ai_config_not_found' }, corsHeaders)
    }

    if (!aiConfig.apiKey) {
      return jsonResponse(500, { ok: false, error: 'ai_config_not_found' }, corsHeaders)
    }

    const adminClient = getAdminClient()
    if (!adminClient) return jsonResponse(500, { ok: false, error: 'server_error' }, corsHeaders)

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

    // 加载历史消息构建上下文
    const { data: history } = await adminClient
      .from('ai_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(30)

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(history || []).map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }))
    ]

    // 调用 AI
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), aiConfig.timeoutMs || 30000)

    let assistantContent: string
    try {
      assistantContent = await callAi(aiConfig, messages, controller.signal)
    } catch (err) {
      const errorCode = err instanceof Error && err.message.startsWith('ai_')
        ? err.message
        : 'ai_analysis_failed'
      logEdgeError('ai-chat', errorCode, err)
      return jsonResponse(
        errorCode === 'ai_upstream_rate_limited' ? 429
          : errorCode === 'ai_upstream_auth_failed' ? 500
          : errorCode === 'ai_request_timeout' ? 504
          : 502,
        { ok: false, error: errorCode },
        corsHeaders
      )
    } finally {
      clearTimeout(timeoutId)
    }

    // 保存助手消息
    const { data: assistantMsg } = await adminClient
      .from('ai_chat_messages')
      .insert({ session_id: sessionId, role: 'assistant', content: assistantContent })
      .select('id, created_at')
      .single()

    // 原子递增配额
    await incrementQuota(authUser.userId)

    // 更新会话的 provider_slug / model（首次可能未写入）
    await adminClient
      .from('ai_chat_sessions')
      .update({ provider_slug: aiConfig.providerSlug, model: aiConfig.model })
      .eq('id', sessionId)

    return jsonResponse(200, {
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
        used: quota.used + 1,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - quota.used - 1)
      }
    }, corsHeaders)
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    logEdgeError('ai-chat', 'unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
}

Deno.serve(handleAiChatRequest)
