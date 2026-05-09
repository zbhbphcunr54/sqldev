/**
 * [2026-05-03] AI 配置管理 Edge Function
 * 支持管理员创建、更新、激活、测试 AI 配置
 * 普通用户只能读取脱敏后的配置列表
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { getAppConfig } from '../_shared/app-config.ts'

await initCorsConfig()

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  allowMethods: 'POST, PATCH, DELETE, OPTIONS, GET'
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

// 内存级限流（单实例足够，冷启动自动重置）
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT = 6
const RATE_WINDOW = 60_000

// 单个 config 冷却时间，防止同一 API Key 短时间内连续测试

interface AiConfigRow {
  id: string
  created_by: string | null
  provider_id: string
  name: string
  base_url: string
  model: string
  api_key: string
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
  api_format?: string
  is_enabled: boolean
  sort_order: number
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (obj.message) return String(obj.message)
    if (obj.code) return String(obj.code)
    if (obj.hint) return String(obj.hint)
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '0.0.0.0'
}

async function getAdminClient() {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY not configured')
  return createClient(SUPABASE_URL, serviceRoleKey)
}

async function getAiConfigs(adminClient: ReturnType<typeof createClient>): Promise<AiConfigRow[]> {
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

async function getAllAiProviders(adminClient: ReturnType<typeof createClient>): Promise<AiProviderRow[]> {
  const { data, error } = await adminClient
    .from('ai_providers')
    .select('*')
    .order('sort_order')

  if (error) throw error
  return (data || []) as unknown as AiProviderRow[]
}

function buildMaskedResponse(
  config: AiConfigRow,
  provider?: AiProviderRow | null
): Record<string, unknown> {
  let apiKeyMasked = '****'
  if (config.api_key) {
    const rawKey = config.api_key
    if (rawKey.length > 16) {
      apiKeyMasked = rawKey.slice(0, 8) + '...' + rawKey.slice(-8)
    } else if (rawKey.length > 8) {
      apiKeyMasked = rawKey.slice(0, 4) + '...' + rawKey.slice(-4)
    } else {
      apiKeyMasked = '****'
    }
  }

  return {
    id: config.id,
    created_by: config.created_by,
    provider_id: config.provider_id,
    name: config.name,
    base_url: config.base_url,
    model: config.model,
    api_key_masked: apiKeyMasked,
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

function makeResponse(req: Request) {
  const headers = buildCorsHeaders(req)
  return (status: number, body: Record<string, unknown>) => {
    if (!headers) {
      return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    }
    return jsonResponse(status, body, headers)
  }
}

async function handleGet(
  userId: string,
  isAdmin: boolean,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const [configs, providers] = await Promise.all([
    getAiConfigs(adminClient),
    isAdmin ? getAllAiProviders(adminClient) : getAiProviders(adminClient)
  ])

  if (isAdmin) {
    const results = configs.map((config) => {
      const provider = providers.find((p) => p.id === config.provider_id)
      return buildMaskedResponse(config, provider)
    })
    const resp = { ok: true, providers, configs: results }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_list',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 200,
      durationMs: 0,
      extra: { provider_count: providers.length, config_count: configs.length, is_admin: isAdmin }
    })
    return respond(200, resp)
  } else {
    const results = configs.map((config) => {
      const provider = providers.find((p) => p.id === config.provider_id)
      return {
        id: config.id,
        created_by: config.created_by,
        provider_id: config.provider_id,
        name: config.name,
        base_url: config.base_url,
        model: config.model,
        api_key_masked: '****',
        timeout_ms: config.timeout_ms,
        is_active: config.is_active,
        last_test_ok: null,
        last_test_ms: null,
        last_test_at: null,
        created_at: config.created_at,
        updated_at: config.updated_at,
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
    const resp = { ok: true, providers, configs: results }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_list',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 200,
      durationMs: 0,
      extra: { provider_count: providers.length, config_count: configs.length, is_admin: isAdmin }
    })
    return respond(200, resp)
  }
}

async function handleCreate(
  userId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const providerId = String(body.provider_id || '')
  const apiKey = String(body.api_key || '')
  if (!providerId || !apiKey) {
    const resp = { error: 'provider_id and api_key are required' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'provider_id and api_key are required'
    })
    return respond(400, resp)
  }

  const { count } = await adminClient
    .from('ai_configs')
    .select('*', { count: 'exact', head: true })
  if ((count || 0) >= 20) {
    const resp = { error: 'ai_config_limit_exceeded' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'ai_config_limit_exceeded'
    })
    return respond(400, resp)
  }

  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', providerId)
    .single()

  if (providerError || !provider) {
    const resp = { error: 'provider_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'provider_not_found'
    })
    return respond(400, resp)
  }

  const providerData = provider as unknown as AiProviderRow

  const { data: config, error: createError } = await adminClient
    .from('ai_configs')
    .insert({
      created_by: userId,
      provider_id: providerId,
      name: String(body.name || ''),
      base_url: String(body.base_url || providerData.base_url),
      model: String(body.model || providerData.default_model),
      api_key: apiKey,
      timeout_ms: Number(body.timeout_ms || 30000)
    })
    .select()
    .single()

  if (createError) {
    const resp = { error: sanitizeError(createError) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(createError)
    })
    return respond(400, resp)
  }

  const masked = buildMaskedResponse(config as unknown as AiConfigRow, providerData)
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_create',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: masked,
    responseStatus: 201,
    durationMs: 0,
    extra: { config_id: (config as unknown as AiConfigRow).id, provider_slug: providerData.slug }
  })
  return respond(201, { ok: true, config: masked })
}

async function handleUpdate(
  id: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const { data: existing, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !existing) {
    const resp = { error: 'config_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'config_not_found',
      extra: { config_id: id }
    })
    return respond(404, resp)
  }

  const existingData = existing as unknown as AiConfigRow

  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = String(body.name)
  if (body.base_url !== undefined) updateData.base_url = String(body.base_url)
  if (body.model !== undefined) updateData.model = String(body.model)
  if (body.timeout_ms !== undefined) updateData.timeout_ms = Number(body.timeout_ms)
  if (body.api_key !== undefined && String(body.api_key).length > 0) {
    updateData.api_key = String(body.api_key)
  }

  if (Object.keys(updateData).length === 0) {
    const resp = { error: 'no_fields_to_update' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'no_fields_to_update',
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const { data: config, error: updateError } = await adminClient
    .from('ai_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    const resp = { error: sanitizeError(updateError) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(updateError),
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const providers = await getAiProviders(adminClient)
  const provider = providers.find((p) => p.id === existingData.provider_id)
  const masked = buildMaskedResponse(config as unknown as AiConfigRow, provider)
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_update',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: masked,
    responseStatus: 200,
    durationMs: 0,
    extra: { config_id: id }
  })
  return respond(200, { ok: true, config: masked })
}

async function handleDelete(
  id: string,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const { error } = await adminClient.from('ai_configs').delete().eq('id', id)
  if (error) {
    const resp = { error: sanitizeError(error) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_delete',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(error),
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const resp = { ok: true }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_delete',
    apiName: 'ai-config',
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { config_id: id }
  })
  return respond(200, resp)
}

async function handleActivate(
  id: string,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  await adminClient.from('ai_configs').update({ is_active: false }).eq('is_active', true)

  const { data: config, error } = await adminClient
    .from('ai_configs')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const resp = { error: sanitizeError(error) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_activate',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(error),
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const resp = { ok: true, config }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_activate',
    apiName: 'ai-config',
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { config_id: id }
  })
  return respond(200, resp)
}

async function handleDeactivate(
  id: string,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const { data: config, error } = await adminClient
    .from('ai_configs')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    const resp = { error: sanitizeError(error) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_deactivate',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(error),
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const resp = { ok: true, config }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_deactivate',
    apiName: 'ai-config',
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { config_id: id }
  })
  return respond(200, resp)
}

async function handleReorderProviders(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)
  const orders = body.orders as { provider_id: string; sort_order: number }[]

  if (!Array.isArray(orders) || orders.length === 0) {
    const resp = { error: 'orders is required and must be non-empty' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_reorder',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'invalid_orders'
    })
    return respond(400, resp)
  }

  for (const item of orders) {
    if (!item.provider_id || typeof item.sort_order !== 'number') {
      const resp = { error: 'invalid_order_format' }
      logOperation({
        userId, userEmail, clientIp,
        operation: 'ai_provider_reorder',
        apiName: 'ai-config',
        requestBody: body,
        responseBody: resp,
        responseStatus: 400,
        durationMs: 0,
        errorMessage: 'invalid_order_format'
      })
      return respond(400, resp)
    }
  }

  const updates = orders.map((item) =>
    adminClient
      .from('ai_providers')
      .update({ sort_order: item.sort_order })
      .eq('id', item.provider_id)
  )

  const results = await Promise.all(updates)
  const hasError = results.some((r: { error: unknown }) => r.error)

  if (hasError) {
    const resp = { error: 'failed_to_reorder_providers' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_reorder',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'failed_to_reorder_providers',
      extra: { provider_ids: orders.map((o) => o.provider_id) }
    })
    return respond(400, resp)
  }

  const resp = { ok: true }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_provider_reorder',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { provider_ids: orders.map((o) => o.provider_id) }
  })
  return respond(200, resp)
}

async function handleUpdateProvider(
  providerId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const { data: existing, error: getError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', providerId)
    .single()

  if (getError || !existing) {
    const resp = { error: 'provider_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'provider_not_found',
      extra: { provider_id: providerId }
    })
    return respond(404, resp)
  }

  const updateData: Record<string, unknown> = {}

  if (body.label !== undefined) updateData.label = String(body.label)
  if (body.base_url !== undefined) updateData.base_url = String(body.base_url)
  if (body.region !== undefined) updateData.region = String(body.region)
  if (body.api_format !== undefined) updateData.api_format = String(body.api_format)
  if (body.models !== undefined) {
    updateData.models = Array.isArray(body.models) ? body.models : []
    // 删除已被移除的模型对应的 config，防止孤儿数据
    const newModels: string[] = updateData.models as string[]
    const oldModels: string[] = (existing as unknown as AiProviderRow).models || []
    const removed = oldModels.filter((m) => !newModels.includes(m))
    if (removed.length > 0) {
      await adminClient
        .from('ai_configs')
        .delete()
        .eq('provider_id', providerId)
        .in('model', removed)
    }
  }

  if (Object.keys(updateData).length === 0) {
    const resp = { error: 'no_fields_to_update' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'no_fields_to_update',
      extra: { provider_id: providerId }
    })
    return respond(400, resp)
  }

  const { data: updated, error: updateError } = await adminClient
    .from('ai_providers')
    .update(updateData)
    .eq('id', providerId)
    .select()
    .single()

  if (updateError) {
    const resp = { error: sanitizeError(updateError) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(updateError),
      extra: { provider_id: providerId }
    })
    return respond(400, resp)
  }

  const resp = { ok: true, provider: updated }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_provider_update',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { provider_id: providerId }
  })
  return respond(200, resp)
}

async function handleCreateProvider(
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const label = String(body.label || '')
  const slug = String(body.slug || '')
  const baseUrl = String(body.base_url || '')
  const models = Array.isArray(body.models) ? body.models as string[] : []

  if (!label || !slug) {
    const resp = { error: 'label and slug are required' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'label and slug are required'
    })
    return respond(400, resp)
  }

  // Get max sort_order for new provider
  const { data: existing, error: countError } = await adminClient
    .from('ai_providers')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextSortOrder = countError || !existing || existing.length === 0
    ? 0
    : (existing[0].sort_order ?? 0) + 1

  const defaultModel = models.length > 0 ? String(models[0]) : ''
  const region = String(body.region || 'international')

  const { data: provider, error: createError } = await adminClient
    .from('ai_providers')
    .insert({
      label,
      slug,
      region,
      base_url: baseUrl,
      default_model: defaultModel,
      models,
      api_format: String(body.api_format || 'custom'),
      is_enabled: true,
      sort_order: nextSortOrder
    })
    .select()
    .single()

  if (createError) {
    const resp = { error: sanitizeError(createError) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: sanitizeError(createError)
    })
    return respond(400, resp)
  }

  const resp = { ok: true, provider }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_provider_create',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: resp,
    responseStatus: 201,
    durationMs: 0,
    extra: { provider_id: (provider as unknown as AiProviderRow).id, provider_slug: slug }
  })
  return respond(201, resp)
}

async function handleDeleteProvider(
  providerId: string,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('id, label')
    .eq('id', providerId)
    .single()

  if (providerError || !provider) {
    const resp = { error: 'provider_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_delete',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'provider_not_found',
      extra: { provider_id: providerId }
    })
    return respond(404, resp)
  }

  const { error: configsError } = await adminClient
    .from('ai_configs')
    .delete()
    .eq('provider_id', providerId)

  if (configsError) {
    console.error('Failed to delete configs for provider:', configsError)
    const resp = { error: 'failed_to_delete_configs' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_delete',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 500,
      durationMs: 0,
      errorMessage: 'failed_to_delete_configs',
      extra: { provider_id: providerId }
    })
    return respond(500, resp)
  }

  const { error: deleteError } = await adminClient
    .from('ai_providers')
    .delete()
    .eq('id', providerId)

  if (deleteError) {
    console.error('Failed to delete provider:', deleteError)
    const resp = { error: 'failed_to_delete_provider' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_provider_delete',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 500,
      durationMs: 0,
      errorMessage: 'failed_to_delete_provider',
      extra: { provider_id: providerId }
    })
    return respond(500, resp)
  }

  const resp = { ok: true, message: `Deleted provider: ${provider.label}` }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_provider_delete',
    apiName: 'ai-config',
    responseBody: resp,
    responseStatus: 200,
    durationMs: 0,
    extra: { provider_id: providerId, provider_label: provider.label }
  })
  return respond(200, resp)
}

async function handleTest(
  id: string,
  userId: string,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userEmail: string,
  clientIp: string
) {
  const respond = makeResponse(req)

  const now = Date.now()
  const hits = (rateLimitMap.get(userId) || []).filter((t) => now - t < RATE_WINDOW)
  if (hits.length >= RATE_LIMIT) {
    const resp = { ok: false, elapsed_ms: 0, error: '请求过于频繁，请稍后再试' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_test',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 429,
      durationMs: 0,
      errorMessage: 'rate_limited',
      extra: { config_id: id }
    })
    return respond(200, resp)
  }
  hits.push(now)
  rateLimitMap.set(userId, hits)

  const cooldown = (await getAppConfig('ai', 'test_cooldown_seconds', { defaultValue: 10 })).value

  const { data: config, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !config) {
    const resp = { ok: false, elapsed_ms: 0, error: '配置不存在' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_test',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'config_not_found',
      extra: { config_id: id }
    })
    return respond(200, resp)
  }

  const configData = config as unknown as AiConfigRow

  // 冷却检查：同一 provider + api_key 下所有 config 共享冷却期
  const { data: siblingConfigs } = await adminClient
    .from('ai_configs')
    .select('id, last_test_at')
    .eq('provider_id', configData.provider_id)
    .eq('api_key', configData.api_key)
    .not('last_test_at', 'is', null)

  if (siblingConfigs && siblingConfigs.length > 0) {
    const recentTimestamps = (siblingConfigs as Array<{ id: string; last_test_at: string }>)
      .map((r) => new Date(r.last_test_at).getTime())
    const latest = Math.max(...recentTimestamps)
    const elapsed = (now - latest) / 1000
    if (elapsed < cooldown) {
      const wait = Math.ceil(cooldown - elapsed)
      const resp = { ok: false, elapsed_ms: 0, error: `请等待 ${wait} 秒后再测试`, cooldown_remaining: wait }
      logOperation({
        userId, userEmail, clientIp,
        operation: 'ai_config_test',
        apiName: 'ai-config',
        responseBody: resp,
        responseStatus: 429,
        durationMs: 0,
        errorMessage: 'cooldown_active',
        extra: { config_id: id, cooldown_seconds: cooldown, elapsed_seconds: Math.floor(elapsed) }
      })
      return respond(200, resp)
    }
  }

  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', configData.provider_id)
    .single()

  if (providerError || !provider) {
    const resp = { ok: false, elapsed_ms: 0, error: '供应商不存在' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_test',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'provider_not_found',
      extra: { config_id: id }
    })
    return respond(200, resp)
  }

  const providerData = provider as unknown as AiProviderRow
  const apiKey = configData.api_key

  // 提前写入 last_test_at 占位，防止竞态（后续请求可以立即看到）
  await adminClient
    .from('ai_configs')
    .update({ last_test_at: new Date().toISOString() })
    .eq('id', id)

  const start = Date.now()
  try {
    let res: Response
    if (providerData.slug === 'claude') {
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

    await adminClient
      .from('ai_configs')
      .update({
        last_test_ok: ok,
        last_test_ms: elapsed
      })
      .eq('id', id)

    const resp = {
      ok,
      elapsed_ms: elapsed,
      status: res.status,
      message: ok ? '连接成功' : `HTTP ${res.status}`
    }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_test',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: ok ? 200 : 502,
      durationMs: elapsed,
      errorMessage: ok ? undefined : `HTTP ${res.status}`,
      extra: { config_id: id, provider_slug: providerData.slug, model: configData.model }
    })
    return respond(200, resp)
  } catch (err) {
    const elapsed = Date.now() - start

    await adminClient
      .from('ai_configs')
      .update({
        last_test_ok: false,
        last_test_ms: elapsed
      })
      .eq('id', id)

    const resp = { ok: false, elapsed_ms: elapsed, error: sanitizeError(err) }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_test',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 500,
      durationMs: elapsed,
      errorMessage: sanitizeError(err),
      extra: { config_id: id, provider_slug: providerData.slug, model: configData.model }
    })
    return respond(200, resp)
  }
}

Deno.serve(async (req) => {
  await initCorsConfig()
  const corsHeaders = buildCorsHeaders(req)
  const origin = req.headers.get('origin') || ''
  console.log('[CORS] Final - origin:', origin, 'corsHeaders:', JSON.stringify(corsHeaders))

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

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

    const adminClient = await getAdminClient()
    const { data: adminUser } = await adminClient
      .from('admin_users')
      .select('email')
      .eq('email', sessionState.email)
      .maybeSingle()
    const isAdmin = !!adminUser

    const logCtx = {
      userId: sessionState.userId,
      userEmail: sessionState.email,
      clientIp: getClientIp(req)
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const aiConfigIndex = pathParts.lastIndexOf('ai-config')
    const tail = aiConfigIndex >= 0 ? pathParts.slice(aiConfigIndex + 1) : pathParts
    const isProviders = tail.length === 1 && tail[0] === 'providers'
    const isProvidersWithId = tail.length === 2 && tail[0] === 'providers'
    const providerId = isProvidersWithId ? tail[1] : null
    const id = tail.length >= 1 && tail[0] !== 'providers' ? tail[0] : null
    const action = tail.length >= 2 ? tail[1] : null

    // GET /ai-config/providers
    if (req.method === 'GET' && isProviders) {
      const providers = isAdmin
        ? await getAllAiProviders(adminClient)
        : await getAiProviders(adminClient)
      const resp = { ok: true, providers }
      logOperation({
        userId: logCtx.userId, userEmail: logCtx.userEmail, clientIp: logCtx.clientIp,
        operation: 'ai_provider_list',
        apiName: 'ai-config',
        responseBody: resp,
        responseStatus: 200,
        durationMs: 0,
        extra: { provider_count: providers.length, is_admin: isAdmin }
      })
      return jsonResponse(200, resp, corsHeaders)
    }

    // POST /ai-config/providers (create provider)
    if (req.method === 'POST' && isProviders) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleCreateProvider(body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // DELETE /ai-config/providers/:id
    if (req.method === 'DELETE' && isProvidersWithId) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleDeleteProvider(providerId!, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // PATCH /ai-config/providers/:id
    if (req.method === 'PATCH' && isProvidersWithId) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleUpdateProvider(providerId!, body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // GET /ai-config
    if (req.method === 'GET' && !id) {
      return handleGet(logCtx.userId, isAdmin, adminClient, req, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config/providers/reorder
    if (tail.length === 2 && tail[0] === 'providers' && tail[1] === 'reorder' && req.method === 'POST') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleReorderProviders(body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config
    if (req.method === 'POST' && !id) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleCreate(logCtx.userId, body, adminClient, req, logCtx.userEmail, logCtx.clientIp)
    }

    // DELETE /ai-config/:id
    if (req.method === 'DELETE' && id && !action) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleDelete(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // PATCH /ai-config/:id
    if (req.method === 'PATCH' && id && !action) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleUpdate(id, body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config/:id/activate
    if (req.method === 'POST' && id && action === 'activate') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleActivate(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config/:id/deactivate
    if (req.method === 'POST' && id && action === 'deactivate') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleDeactivate(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config/:id/test
    if (req.method === 'POST' && id && action === 'test') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleTest(id, logCtx.userId, adminClient, req, logCtx.userEmail, logCtx.clientIp)
    }

    return jsonResponse(404, { error: 'not_found' }, corsHeaders)
  } catch (err) {
    console.error('ai-config error:', err)
    return errorResponse(500, sanitizeError(err), corsHeaders)
  }
})
