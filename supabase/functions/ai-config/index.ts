/**
 * [2026-05-03] AI 閰嶇疆绠＄悊 Edge Function
 * 鏀寔绠＄悊鍛樺垱寤恒€佹洿鏂般€佹縺娲汇€佹祴璇?AI 閰嶇疆
 * 鏅€氱敤鎴峰彧鑳借鍙栬劚鏁忓悗鐨勯厤缃垪琛?
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkIsAdmin, extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig, handleCors } from '../_shared/cors.ts'
import { errorResponse, jsonResponse, sanitizeError } from '../_shared/response.ts'
import { logOperation as baseLogOperation } from '../_shared/operation-logger.ts'
import { getAppConfig, getDefaultAiTimeoutMs } from '../_shared/app-config.ts'
import { getClientIp } from '../_shared/request.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { encryptValue, decryptValue, maskApiKeySync } from '../_shared/crypto.ts'
import type { AiConfigRow, AiProviderRow } from '../_shared/ai-types.ts'

type AiConfigScope = 'personal' | 'global' | 'all'

await initCorsConfig()

const corsHelpers = createCorsHelpers({
  allowMethods: 'POST, PATCH, DELETE, OPTIONS, GET'
})
const { defaultCorsHeaders, buildCorsHeaders } = corsHelpers

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const ALLOWED_OPERATIONS = new Set([
  'ai_config_create',
  'ai_config_append_model',
  'ai_config_test',
  'ai_config_delete',
  'ai_provider_create',
  'ai_provider_update',
  'ai_provider_delete'
])

// 鍏ㄥ眬闄愭祦鍣紙寤惰繜鍒濆鍖栵紝璇诲彇缁熶竴閰嶇疆锛?
let configRateLimiter: ReturnType<typeof createRateLimiter> | null = null

async function getRateLimiter(): Promise<ReturnType<typeof createRateLimiter>> {
  if (configRateLimiter) return configRateLimiter
  const [maxRequests, windowMs] = await Promise.all([
    getAppConfig<number>('rate_limit', 'max_requests', { defaultValue: 10, parse: Number }),
    getAppConfig<number>('rate_limit', 'window_ms', { defaultValue: 60000, parse: Number })
  ])
  configRateLimiter = createRateLimiter({
    scope: 'ai_config',
    windowMs: windowMs.value,
    maxRequests: maxRequests.value,
    trackMax: 500,
    storeMode: 'kv'
  })
  return configRateLimiter
}

function normalizeAiConfigModel(value: unknown): string {
  return String(value ?? '').trim().toLowerCase()
}

function formatAiConfigModel(value: unknown): string {
  return String(value ?? '').trim()
}

function isAiConfigDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string; details?: string }
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase()
  return (
    candidate.code === '23505' ||
    message.includes('uq_ai_configs_provider_model_normalized') ||
    message.includes('uq_ai_configs_global_provider_model_normalized') ||
    message.includes('uq_ai_configs_user_provider_model_normalized')
  )
}

async function findDuplicateAiConfig(
  adminClient: ReturnType<typeof createClient>,
  scope: 'global' | 'user',
  ownerUserId: string | null,
  providerId: string,
  model: string,
  excludeId?: string
): Promise<AiConfigRow | null> {
  const normalizedModel = normalizeAiConfigModel(model)
  if (!providerId || !normalizedModel) return null

  const { data, error } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('scope', scope)
    .eq('provider_id', providerId)

  const scopedData = (data || []).filter((item) => {
    const row = item as unknown as AiConfigRow
    if (scope === 'user') return row.owner_user_id === ownerUserId
    return row.owner_user_id === null
  })

  if (error) return null

  return ((scopedData as unknown as AiConfigRow[]).find((item) => {
    if (excludeId && item.id === excludeId) return false
    return normalizeAiConfigModel(item.model) === normalizedModel
  }) || null)
}

function logOperation(entry: Parameters<typeof baseLogOperation>[0]): Promise<void> {
  let operation = entry.operation

  if (operation === 'ai_config_create') {
    const requestBody =
      entry.requestBody && typeof entry.requestBody === 'object' && !Array.isArray(entry.requestBody)
        ? (entry.requestBody as Record<string, unknown>)
        : {}
    const providerId =
      typeof requestBody.provider_id === 'string' ? requestBody.provider_id.trim() : ''
    const apiKey = typeof requestBody.api_key === 'string' ? requestBody.api_key.trim() : ''
    if (providerId && !apiKey) {
      operation = 'ai_config_append_model'
    }
  }

  if (!ALLOWED_OPERATIONS.has(operation)) {
    return Promise.resolve()
  }

  return baseLogOperation({
    ...entry,
    operation
  }).catch(() => {})
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

function normalizeScope(value: unknown): AiConfigScope {
  if (value === 'global' || value === 'all') return value
  return 'personal'
}

function toDbScope(scope: Exclude<AiConfigScope, 'all'>): 'global' | 'user' {
  return scope === 'global' ? 'global' : 'user'
}

function canManageScope(scope: Exclude<AiConfigScope, 'all'>, isAdmin: boolean): boolean {
  return scope === 'personal' || isAdmin
}

function ensureConfigOwnership(
  config: AiConfigRow,
  userId: string,
  isAdmin: boolean
): boolean {
  if (config.scope === 'user') return config.owner_user_id === userId
  return isAdmin && config.scope === 'global'
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
    if (config.is_encrypted) {
      apiKeyMasked = '[encrypted] ****'
    } else {
      apiKeyMasked = maskApiKeySync(config.api_key)
    }
  }

  return {
    id: config.id,
    created_by: config.created_by,
    scope: config.scope,
    owner_user_id: config.owner_user_id,
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
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userId: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)
  const scope = normalizeScope(new URL(req.url).searchParams.get('scope'))

  const [configs, providers] = await Promise.all([
    getAiConfigs(adminClient),
    getAllAiProviders(adminClient)
  ])

  const configsWithKeys = await Promise.all(
    configs.map(async (config) => {
      if (config.is_encrypted && config.api_key) {
        try {
          const decrypted = await decryptValue(config.api_key)
          return { ...config, api_key: decrypted, is_encrypted: false }
        } catch {
          // Keep encrypted value and fall back to conservative masked display.
        }
      }
      return config
    })
  )

  const results = configsWithKeys.map((config) => {
    const provider = providers.find((p) => p.id === config.provider_id)
    return buildMaskedResponse(config, provider)
  })

  const personalConfigs = results.filter((config) => config.scope === 'user' && config.owner_user_id === userId)
  const hasGlobalActive = results.some((config) => config.scope === 'global' && config.is_active)
  const globalConfigs = isAdmin
    ? results.filter((config) => config.scope === 'global')
    : []

  if (scope === 'personal') {
    return respond(200, {
      ok: true,
      providers,
      configs: personalConfigs,
      personal_configs: personalConfigs,
      global_configs: [],
      has_global_active: hasGlobalActive
    })
  }

  if (scope === 'global') {
    if (!isAdmin) return respond(403, { error: 'forbidden' })
    return respond(200, {
      ok: true,
      providers,
      configs: globalConfigs,
      personal_configs: personalConfigs,
      global_configs: globalConfigs,
      has_global_active: hasGlobalActive
    })
  }

  const resp = {
    ok: true,
    providers,
    personal_configs: personalConfigs,
    global_configs: globalConfigs,
    has_global_active: hasGlobalActive
  }
  return respond(200, resp)
}

async function handleCreate(
  userId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>,
  req: Request,
  userEmail: string,
  clientIp: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)
  const scope = normalizeScope(body.scope)
  if (scope === 'all') {
    return respond(400, { error: 'invalid_scope' })
  }
  if (!canManageScope(scope, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }
  const dbScope = toDbScope(scope)
  const ownerUserId = dbScope === 'user' ? userId : null

  const providerId = String(body.provider_id || '')
  let apiKey = String(body.api_key || '')
  if (!providerId) {
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
  // 杩藉姞妯″瀷锛氭湭浼?api_key 鏃惰嚜鍔ㄥ鐢ㄥ悓渚涘簲鍟嗗凡鏈夐厤缃殑 key
  let reusedKey = false
  if (!apiKey) {
    const reuseConfigId = typeof body.reuse_config_id === 'string' ? body.reuse_config_id.trim() : ''
    const apiKeyMaskedHint =
      typeof body.api_key_masked === 'string' ? body.api_key_masked.trim() : ''

    let existingQuery = adminClient
      .from('ai_configs')
      .select('id, api_key, api_key_masked')
      .eq('scope', dbScope)
      .eq('provider_id', providerId)

    existingQuery =
      dbScope === 'user'
        ? existingQuery.eq('owner_user_id', userId)
        : existingQuery.is('owner_user_id', null)

    if (reuseConfigId) {
      existingQuery = existingQuery.eq('id', reuseConfigId)
    } else if (apiKeyMaskedHint) {
      existingQuery = existingQuery.eq('api_key_masked', apiKeyMaskedHint)
    } else {
      existingQuery = existingQuery.limit(1)
    }

    const { data: existing } = await existingQuery.single()
    if (!existing) {
      const resp = { error: 'provider_id and api_key are required' }
      logOperation({
        userId, userEmail, clientIp,
        operation: 'ai_config_create',
        apiName: 'ai-config',
        requestBody: body,
        responseBody: resp,
        responseStatus: 400,
        durationMs: 0,
        errorMessage: 'no_existing_key_for_provider'
      })
      return respond(400, resp)
    }
    // 澶嶇敤宸叉湁瀵嗘枃锛岄伩鍏嶄簩娆″姞瀵?
    apiKey = (existing as { api_key: string }).api_key
    reusedKey = true
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
  const model = formatAiConfigModel(body.model || providerData.default_model)

  if (!model) {
    const resp = { error: 'model_required' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'model_required'
    })
    return respond(400, resp)
  }

  const duplicateConfig = await findDuplicateAiConfig(adminClient, dbScope, ownerUserId, providerId, model)
  if (duplicateConfig) {
    const resp = { error: 'ai_config_model_duplicate' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 409,
      durationMs: 0,
      errorMessage: 'ai_config_model_duplicate',
      extra: { provider_id: providerId, model }
    })
    return respond(409, resp)
  }

  const { data: config, error: createError } = await adminClient
    .from('ai_configs')
    .insert({
      created_by: userId,
      scope: dbScope,
      owner_user_id: ownerUserId,
      provider_id: providerId,
      name: String(body.name || ''),
      base_url: String(body.base_url || providerData.base_url),
      model,
      api_key: reusedKey ? apiKey : await encryptValue(apiKey),
      is_encrypted: true,
      timeout_ms: Number(body.timeout_ms) || await getDefaultAiTimeoutMs()
    })
    .select()
    .single()

  if (createError) {
    const errorCode = isAiConfigDuplicateError(createError)
      ? 'ai_config_model_duplicate'
      : sanitizeError(createError)
    const resp = { error: errorCode }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_create',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: errorCode === 'ai_config_model_duplicate' ? 409 : 400,
      durationMs: 0,
      errorMessage: errorCode
    })
    return respond(errorCode === 'ai_config_model_duplicate' ? 409 : 400, resp)
  }

  // 鐢ㄥ師濮嬫槑鏂囷紙鎴栧鐢ㄥ瘑鏂囷級鏋勯€犳纭殑 api_key_masked
  const configRow = config as unknown as AiConfigRow
  let apiKeyMasked: string
  if (reusedKey) {
    // apiKey 鏄鐢ㄧ殑瀵嗘枃锛岄渶鍏堣В瀵嗘墠鑳芥纭劚鏁?
    const decrypted = await decryptValue(apiKey)
    apiKeyMasked = maskApiKeySync(decrypted)
  } else {
    apiKeyMasked = maskApiKeySync(apiKey)
  }
  const masked = {
    ...buildMaskedResponse(configRow, providerData),
    api_key_masked: apiKeyMasked
  }
  logOperation({
    userId, userEmail, clientIp,
    operation: 'ai_config_create',
    apiName: 'ai-config',
    requestBody: body,
    responseBody: masked,
    responseStatus: 201,
    durationMs: 0,
    extra: { config_id: configRow.id, provider_slug: providerData.slug }
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
  clientIp: string,
  isAdmin: boolean
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
  if (!ensureConfigOwnership(existingData, userId, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }

  const updateData: Record<string, unknown> = {}

  if (body.name !== undefined) updateData.name = String(body.name)
  if (body.base_url !== undefined) updateData.base_url = String(body.base_url)
  if (body.model !== undefined) updateData.model = formatAiConfigModel(body.model)
  if (body.timeout_ms !== undefined) updateData.timeout_ms = Number(body.timeout_ms)
  if (body.api_key !== undefined && String(body.api_key).length > 0) {
    updateData.api_key = await encryptValue(String(body.api_key))
    updateData.is_encrypted = true
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

  const nextModel =
    updateData.model !== undefined ? String(updateData.model) : formatAiConfigModel(existingData.model)
  if (!nextModel) {
    const resp = { error: 'model_required' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 400,
      durationMs: 0,
      errorMessage: 'model_required',
      extra: { config_id: id }
    })
    return respond(400, resp)
  }

  const duplicateConfig = await findDuplicateAiConfig(
    adminClient,
    existingData.scope,
    existingData.owner_user_id,
    existingData.provider_id,
    nextModel,
    id
  )
  if (duplicateConfig) {
    const resp = { error: 'ai_config_model_duplicate' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: 409,
      durationMs: 0,
      errorMessage: 'ai_config_model_duplicate',
      extra: { config_id: id, provider_id: existingData.provider_id, model: nextModel }
    })
    return respond(409, resp)
  }

  const { data: config, error: updateError } = await adminClient
    .from('ai_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    const errorCode = isAiConfigDuplicateError(updateError)
      ? 'ai_config_model_duplicate'
      : sanitizeError(updateError)
    const resp = { error: errorCode }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_update',
      apiName: 'ai-config',
      requestBody: body,
      responseBody: resp,
      responseStatus: errorCode === 'ai_config_model_duplicate' ? 409 : 400,
      durationMs: 0,
      errorMessage: errorCode,
      extra: { config_id: id }
    })
    return respond(errorCode === 'ai_config_model_duplicate' ? 409 : 400, resp)
  }

  const providers = await getAllAiProviders(adminClient)
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
  clientIp: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)

  const { data: existing } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return respond(404, { error: 'config_not_found' })
  }

  const existingData = existing as unknown as AiConfigRow
  if (!ensureConfigOwnership(existingData, userId, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }

  const { data, error } = await adminClient.from('ai_configs').delete().eq('id', id).select('id').single()
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

  if (!data) {
    const resp = { error: 'config_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_delete',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'config_not_found',
      extra: { config_id: id }
    })
    return respond(404, resp)
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
  clientIp: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)

  const { data: target, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !target) {
    const resp = { error: 'config_not_found' }
    logOperation({
      userId, userEmail, clientIp,
      operation: 'ai_config_activate',
      apiName: 'ai-config',
      responseBody: resp,
      responseStatus: 404,
      durationMs: 0,
      errorMessage: 'config_not_found',
      extra: { config_id: id }
    })
    return respond(404, resp)
  }

  const targetData = target as unknown as AiConfigRow
  if (!ensureConfigOwnership(targetData, userId, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }

  let clearQuery = adminClient
    .from('ai_configs')
    .update({ is_active: false })
    .eq('scope', targetData.scope)
    .eq('is_active', true)

  clearQuery =
    targetData.scope === 'user'
      ? clearQuery.eq('owner_user_id', userId)
      : clearQuery.is('owner_user_id', null)

  await clearQuery

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
  clientIp: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)

  const { data: existing } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (!existing) {
    return respond(404, { error: 'config_not_found' })
  }

  const existingData = existing as unknown as AiConfigRow
  if (!ensureConfigOwnership(existingData, userId, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }

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

  const { error: updateError } = await adminClient.rpc('reorder_providers', {
    p_orders: orders.map((o) => ({ provider_id: o.provider_id, sort_order: o.sort_order }))
  })

  if (updateError) {
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
  // 璁＄畻闇€瑕佸垹闄ょ殑瀛ゅ効妯″瀷锛堝湪 provider 鏇存柊鎴愬姛鍚庢墠鎵ц鍒犻櫎锛?
  let removedModels: string[] = []
  if (body.models !== undefined) {
    updateData.models = Array.isArray(body.models) ? body.models : []
    const newModels: string[] = updateData.models as string[]
    const oldModels: string[] = (existing as unknown as AiProviderRow).models || []
    removedModels = oldModels.filter((m) => !newModels.includes(m))
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

  // 鍒犻櫎宸茶绉婚櫎鐨勬ā鍨嬪搴旂殑 config锛坧rovider 宸叉洿鏂版垚鍔燂紝瀹夊叏鍒犻櫎瀛ゅ効鏁版嵁锛?
  if (removedModels.length > 0) {
    await adminClient
      .from('ai_configs')
      .delete()
      .eq('provider_id', providerId)
      .in('model', removedModels)
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
  clientIp: string,
  isAdmin: boolean
) {
  const respond = makeResponse(req)

  const now = Date.now()

  const cooldown = (await getAppConfig('ai', 'test_cooldown_seconds', { defaultValue: 10 })).value

  const { data: config, error: getError } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('id', id)
    .single()

  if (getError || !config) {
    const resp = { ok: false, elapsed_ms: 0, error: 'config_not_found' }
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
    return respond(404, resp)
  }

  const configData = config as unknown as AiConfigRow
  if (!ensureConfigOwnership(configData, userId, isAdmin)) {
    return respond(403, { error: 'forbidden' })
  }

  // 鍐峰嵈妫€鏌ワ細鍚屼竴 provider + api_key 涓嬫墍鏈?config 鍏变韩鍐峰嵈鏈?
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
      const resp = {
        ok: false,
        elapsed_ms: 0,
        error: `请等待 ${wait} 秒后再测试`,
        cooldown_remaining: wait
      }
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
      return respond(429, resp)
    }
  }

  const { data: provider, error: providerError } = await adminClient
    .from('ai_providers')
    .select('*')
    .eq('id', configData.provider_id)
    .single()

  if (providerError || !provider) {
    const resp = { ok: false, elapsed_ms: 0, error: 'provider_not_found' }
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
    return respond(400, resp)
  }

  const providerData = provider as unknown as AiProviderRow
  const apiKey = configData.is_encrypted && configData.api_key
    ? await decryptValue(configData.api_key)
    : configData.api_key

  // 鎻愬墠鍐欏叆 last_test_at 鍗犱綅锛岄槻姝㈢珵鎬侊紙鍚庣画璇锋眰鍙互绔嬪嵆鐪嬪埌锛?
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
  const corsResult = handleCors(req, corsHelpers)
  if (corsResult) return corsResult
  const corsHeaders = buildCorsHeaders(req)!

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
    const isAdmin = await checkIsAdmin(adminClient, sessionState.email, {
      sessionAdminHint: sessionState.isAdminHint
    })
    
    const logCtx = {
      userId: sessionState.userId,
      userEmail: sessionState.email,
      clientIp: getClientIp(req)
    }

    // 鍐欐搷浣滈檺娴侊紙POST / PATCH / DELETE锛岀粺涓€鍏ㄥ眬闄愭祦閰嶇疆锛?
    if (req.method !== 'GET' && req.method !== 'OPTIONS') {
      const rl = await getRateLimiter()
      const rateResult = await rl.consume(`${sessionState.userId}|${logCtx.clientIp}`)
      if (!rateResult.ok) {
        return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
          'Retry-After': String(rateResult.retryAfter)
        })
      }
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const scope = normalizeScope(url.searchParams.get('scope'))
    const aiConfigIndex = pathParts.lastIndexOf('ai-config')
    const tail = aiConfigIndex >= 0 ? pathParts.slice(aiConfigIndex + 1) : pathParts
    const isProviders = tail.length === 1 && tail[0] === 'providers'
    const isProvidersWithId = tail.length === 2 && tail[0] === 'providers'
    const providerId = isProvidersWithId ? tail[1] : null
    const id = tail.length >= 1 && tail[0] !== 'providers' ? tail[0] : null
    const action = tail.length >= 2 ? tail[1] : null

    // GET /ai-config/providers
    if (req.method === 'GET' && isProviders) {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const providers = await getAllAiProviders(adminClient)
      const resp = { ok: true, providers }
      logOperation({
        userId: logCtx.userId, userEmail: logCtx.userEmail, clientIp: logCtx.clientIp,
        operation: 'ai_provider_list',
        apiName: 'ai-config',
        responseBody: resp,
        responseStatus: 200,
        durationMs: 0,
        extra: { provider_count: providers.length }
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
      return handleGet(adminClient, req, logCtx.userId, isAdmin)
    }

    // POST /ai-config/providers/reorder
    if (tail.length === 2 && tail[0] === 'providers' && tail[1] === 'reorder' && req.method === 'POST') {
      if (!isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      const body = await req.json().catch(() => ({}))
      return handleReorderProviders(body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp)
    }

    // POST /ai-config
    if (req.method === 'POST' && !id) {
      const body = await req.json().catch(() => ({}))
      if (scope === 'global' && !isAdmin) return jsonResponse(403, { error: 'forbidden' }, corsHeaders)
      return handleCreate(logCtx.userId, body, adminClient, req, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    // DELETE /ai-config/:id
    if (req.method === 'DELETE' && id && !action) {
      return handleDelete(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    // PATCH /ai-config/:id
    if (req.method === 'PATCH' && id && !action) {
      const body = await req.json().catch(() => ({}))
      return handleUpdate(id, body, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    // POST /ai-config/:id/activate
    if (req.method === 'POST' && id && action === 'activate') {
      return handleActivate(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    // POST /ai-config/:id/deactivate
    if (req.method === 'POST' && id && action === 'deactivate') {
      return handleDeactivate(id, adminClient, req, logCtx.userId, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    // POST /ai-config/:id/test
    if (req.method === 'POST' && id && action === 'test') {
      return handleTest(id, logCtx.userId, adminClient, req, logCtx.userEmail, logCtx.clientIp, isAdmin)
    }

    return jsonResponse(404, { error: 'not_found' }, corsHeaders)
  } catch (err) {
    console.error('ai-config error:', err)
    return errorResponse(500, sanitizeError(err), corsHeaders)
  }
})

