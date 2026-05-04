/**
 * [2026-05-03] AI 配置管理 Edge Function
 * 支持管理员创建、更新、激活、测试 AI 配置
 * 普通用户只能读取脱敏后的配置列表
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { encryptApiKey, maskApiKey } from '../_shared/crypto.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

// 内存级限流（单实例足够，冷启动自动重置）
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 6
const RATE_WINDOW = 60_000

interface AiConfigRow {
  id: string
  created_by: string | null
  provider_id: string
  name: string
  base_url: string
  model: string
  api_key_enc: Uint8Array
  timeout_ms: number
  is_active: boolean
  last_test_ok: boolean | null
  last_test_ms: number | null
  last_test_at: string | null
  created_at: string
  updated_at: string
}

interface AiProviderRow {
  id: string
  slug: string
  label: string
  region: string
  base_url: string
  default_model: string
  models: string[]
  is_enabled: boolean
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

async function getAdminClient() {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY not configured')
  return createClient(SUPABASE_URL, serviceRoleKey)
}

async function getAiConfigsWithMask(adminClient: ReturnType<typeof createClient>): Promise<AiConfigRow[]> {
  const { data, error } = await adminClient
    .from('ai_configs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as unknown as AiConfigRow[]
}

async function getAiProviders(adminClient: ReturnType<typeof createClient>): Promise<AiProviderRow[]> {
  const { data, error } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('is_enabled', true)
    .order('sort_order')

  if (error) throw error
  return (data || []) as unknown as AiProviderRow[]
}

function buildMaskedResponse(
  config: AiConfigRow,
  provider?: AiProviderRow | null
): Record<string, unknown> {
  const maskedKey = config.api_key_enc
    ? maskApiKey(new Uint8Array(config.api_key_enc as unknown as number[]))
    : Promise.resolve('****')

  return {
    id: config.id,
    created_by: config.created_by,
    provider_id: config.provider_id,
    name: config.name,
    base_url: config.base_url,
    model: config.model,
    api_key_masked: maskedKey,
    timeout_ms: config.timeout_ms,
    is_active: config.is_active,
    last_test_ok: config.last_test_ok,
    last_test_ms: config.last_test_ms,
    last_test_at: config.last_test_at,
    created_at: config.created_at,
    updated_at: config.updated_at,
    provider: provider
      ? {
          id: provider.id,
          slug: provider.slug,
          label: provider.label,
          region: provider.region,
          base_url: provider.base_url,
          default_model: provider.default_model,
          models: provider.models,
          is_enabled: provider.is_enabled
        }
      : undefined
  }
}

async function handleGet(userId: string, isAdmin: boolean, adminClient: ReturnType<typeof createClient>) {
  const configs = await getAiConfigsWithMask(adminClient)
  const providers = await getAiProviders(adminClient)

  if (isAdmin) {
    // 管理员返回完整信息
    const results = await Promise.all(
      configs.map(async (config) => {
        const provider = providers.find((p) => p.id === config.provider_id)
        const masked = await buildMaskedResponse(config, provider)
        return masked
      })
    )
    return jsonResponse(200, { ok: true, configs: results }, defaultCorsHeaders())
  } else {
    // 普通用户只返回脱敏信息，不含 last_test_* 等敏感状态
    const results = await Promise.all(
      configs.map(async (config) => {
        const provider = providers.find((p) => p.id === config.provider_id)
        return {
          id: config.id,
          provider_id: config.provider_id,
          name: config.name,
          model: config.model,
          api_key_masked: '****',
          is_active: config.is_active,
          created_at: config.created_at,
          provider: provider
            ? {
                id: provider.id,
                slug: provider.slug,
                label: provider.label,
                region: provider.region,
                base_url: provider.base_url,
                models: provider.models,
                is_enabled: provider.is_enabled
              }
            : undefined
        }
      })
    )
    return jsonResponse(200, { ok: true, configs: results }, defaultCorsHeaders())
  }
}

async function handleCreate(
  userId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  // 校验必要字段
  const providerId = String(body.provider_id || '')
  const apiKey = String(body.api_key || '')
  if (!providerId || !apiKey) {
    return jsonResponse(400, { error: 'provider_id and api_key are required' }, defaultCorsHeaders())
  }

  // 检查配置数量限制
  const { count } = await adminClient
    .from('ai_configs')
    .select('*', { count: 'exact', head: true })
  if ((count || 0) >= 20) {
    return jsonResponse(400, { error: 'ai_config_limit_exceeded' }, defaultCorsHeaders())
  }

  // 获取供应商信息
  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', providerId)
    .single()

  if (providerError || !provider) {
    return jsonResponse(400, { error: 'provider_not_found' }, defaultCorsHeaders())
  }

  const providerData = provider as unknown as AiProviderRow

  // 加密 API Key
  const apiKeyEnc = await encryptApiKey(apiKey)

  // 创建配置
  const { data: config, error: createError } = await adminClient
    .from('ai_configs')
    .insert({
      created_by: userId,
      provider_id: providerId,
      name: String(body.name || ''),
      base_url: String(body.base_url || providerData.base_url),
      model: String(body.model || providerData.default_model),
      api_key_enc: Array.from(apiKeyEnc),
      timeout_ms: Number(body.timeout_ms || 30000)
    })
    .select()
    .single()

  if (createError) {
    return jsonResponse(400, { error: sanitizeError(createError) }, defaultCorsHeaders())
  }

  const masked = await buildMaskedResponse(config as unknown as AiConfigRow, providerData)
  return jsonResponse(201, { ok: true, config: masked }, defaultCorsHeaders())
}

async function handleUpdate(
  id: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  // 获取现有配置
  const { data: existing, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !existing) {
    return jsonResponse(404, { error: 'config_not_found' }, defaultCorsHeaders())
  }

  const existingData = existing as unknown as AiConfigRow

  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = String(body.name)
  if (body.base_url !== undefined) updateData.base_url = String(body.base_url)
  if (body.model !== undefined) updateData.model = String(body.model)
  if (body.timeout_ms !== undefined) updateData.timeout_ms = Number(body.timeout_ms)

  // 如果提供了新的 api_key，则重新加密
  if (body.api_key && String(body.api_key).length > 0) {
    const apiKeyEnc = await encryptApiKey(String(body.api_key))
    updateData.api_key_enc = Array.from(apiKeyEnc)
  }

  if (Object.keys(updateData).length === 0) {
    return jsonResponse(400, { error: 'no_fields_to_update' }, defaultCorsHeaders())
  }

  const { data: config, error: updateError } = await adminClient
    .from('ai_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return jsonResponse(400, { error: sanitizeError(updateError) }, defaultCorsHeaders())
  }

  const providers = await getAiProviders(adminClient)
  const provider = providers.find((p) => p.id === existingData.provider_id)
  const masked = await buildMaskedResponse(config as unknown as AiConfigRow, provider)
  return jsonResponse(200, { ok: true, config: masked }, defaultCorsHeaders())
}

async function handleDelete(id: string, adminClient: ReturnType<typeof createClient>) {
  const { error } = await adminClient.from('ai_configs').delete().eq('id', id)
  if (error) {
    return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  }
  return jsonResponse(200, { ok: true }, defaultCorsHeaders())
}

async function handleActivate(id: string, adminClient: ReturnType<typeof createClient>) {
  // 取消所有激活配置
  await adminClient.from('ai_configs').update({ is_active: false }).eq('is_active', true)

  // 激活指定配置
  const { data: config, error } = await adminClient
    .from('ai_configs')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  }

  return jsonResponse(200, { ok: true, config }, defaultCorsHeaders())
}

async function handleTest(
  id: string,
  userId: string,
  adminClient: ReturnType<typeof createClient>
) {
  // 限流检查
  const now = Date.now()
  const hits = (rateLimitMap.get(userId) || []).filter((t) => now - t < RATE_WINDOW)
  if (hits.length >= RATE_LIMIT) {
    return jsonResponse(429, { error: 'rate_limit_exceeded' }, defaultCorsHeaders())
  }
  hits.push(now)
  rateLimitMap.set(userId, hits)

  // 获取配置
  const { data: config, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !config) {
    return jsonResponse(404, { error: 'config_not_found' }, defaultCorsHeaders())
  }

  const configData = config as unknown as AiConfigRow

  // 获取供应商信息
  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', configData.provider_id)
    .single()

  if (providerError || !provider) {
    return jsonResponse(400, { error: 'provider_not_found' }, defaultCorsHeaders())
  }

  const providerData = provider as unknown as AiProviderRow

  // 解密 API Key
  const apiKey = await (async () => {
    const encData = new Uint8Array(configData.api_key_enc as unknown as number[])
    const { decryptApiKey: decrypt } = await import('../_shared/crypto.ts')
    return decrypt(encData)
  })()

  // 根据 api_format 发送测试请求
  const start = Date.now()
  try {
    let res: Response
    if (providerData.slug === 'claude') {
      // Anthropic 格式
      res = await fetch(`${configData.base_url}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: configData.model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        }),
        signal: AbortSignal.timeout(configData.timeout_ms)
      })
    } else if (providerData.api_format === 'custom') {
      // 自定义格式（文心、混元、星火）- 简化为通用请求
      res = await fetch(`${configData.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: configData.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 16
        }),
        signal: AbortSignal.timeout(configData.timeout_ms)
      })
    } else {
      // OpenAI 兼容格式
      res = await fetch(`${configData.base_url}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: configData.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 16
        }),
        signal: AbortSignal.timeout(configData.timeout_ms)
      })
    }

    const elapsed = Date.now() - start
    const ok = res.ok

    // 更新测试结果
    await adminClient
      .from('ai_configs')
      .update({
        last_test_ok: ok,
        last_test_ms: elapsed,
        last_test_at: new Date().toISOString()
      })
      .eq('id', id)

    return jsonResponse(
      200,
      {
        ok,
        elapsed_ms: elapsed,
        status: res.status,
        message: ok ? '连接成功' : `HTTP ${res.status}`
      },
      defaultCorsHeaders()
    )
  } catch (err) {
    const elapsed = Date.now() - start

    await adminClient
      .from('ai_configs')
      .update({
        last_test_ok: false,
        last_test_ms: elapsed,
        last_test_at: new Date().toISOString()
      })
      .eq('id', id)

    return jsonResponse(
      200,
      { ok: false, elapsed_ms: elapsed, error: sanitizeError(err) },
      defaultCorsHeaders()
    )
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }

    // 认证
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })

    if (sessionState.state !== 'valid') {
      return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    }

    const isAdmin = (await (async () => {
      const adminClient = await getAdminClient()
      const { data: user } = await adminClient.auth.adminGetUserById(sessionState.userId)
      return user?.app_metadata?.is_admin === true
    })())

    const adminClient = await getAdminClient()

    // 路由处理
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    // path: /functions/v1/ai-config 或 /functions/v1/ai-config/:id
    const id = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null
    const isAction =
      pathParts.length > 2 && pathParts[pathParts.length - 1] !== id

    // GET /ai-config
    if (req.method === 'GET' && !id) {
      return handleGet(sessionState.userId, isAdmin, adminClient)
    }

    // POST /ai-config
    if (req.method === 'POST' && !id) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleCreate(sessionState.userId, body, adminClient)
    }

    // DELETE /ai-config/:id
    if (req.method === 'DELETE' && id) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleDelete(id, adminClient)
    }

    // PATCH /ai-config/:id
    if (req.method === 'PATCH' && id && !isAction) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleUpdate(id, body, adminClient)
    }

    // POST /ai-config/:id/activate
    if (req.method === 'POST' && id && pathParts[pathParts.length - 1] === 'activate') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleActivate(id, adminClient)
    }

    // POST /ai-config/:id/test
    if (req.method === 'POST' && id && pathParts[pathParts.length - 1] === 'test') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleTest(id, sessionState.userId, adminClient)
    }

    return jsonResponse(404, { error: 'not_found' }, corsHeaders)
  } catch (err) {
    console.error('ai-config error:', err)
    return errorResponse(500, sanitizeError(err), corsHeaders)
  }
})
