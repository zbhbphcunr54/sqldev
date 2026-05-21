import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAppConfig, getDefaultAiTimeoutMs } from './app-config.ts'
import { decryptValue } from './crypto.ts'
import type { AiConfigRow, AiProviderRow } from './ai-types.ts'

export interface ResolvedAiConfig {
  baseUrl: string
  model: string
  apiKey: string
  timeoutMs: number
  providerSlug: string | null
  source: 'user_config' | 'global_config' | 'environment'
}

function isMissingScopedColumnsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: string; message?: string; details?: string }
  const haystack = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase()
  return (
    candidate.code === '42703' ||
    (haystack.includes('column') &&
      haystack.includes('does not exist') &&
      (haystack.includes('scope') || haystack.includes('owner_user_id')))
  )
}

async function buildResolvedConfig(
  adminClient: ReturnType<typeof createClient>,
  config: AiConfigRow,
  source: ResolvedAiConfig['source']
): Promise<ResolvedAiConfig> {
  const { data: provider } = await adminClient
    .from('ai_providers')
    .select('slug')
    .eq('id', config.provider_id)
    .single()

  let apiKey = config.api_key ?? ''
  if (config.is_encrypted && apiKey) {
    apiKey = await decryptValue(apiKey)
  }

  return {
    baseUrl: config.base_url,
    model: config.model,
    apiKey,
    timeoutMs: config.timeout_ms,
    providerSlug: (provider as AiProviderRow | null)?.slug || null,
    source
  }
}

async function loadLegacyGlobalConfigs(
  adminClient: ReturnType<typeof createClient>
): Promise<AiConfigRow[]> {
  const { data, error } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[ai-resolver] load_legacy_global_configs_failed', {
      message: error.message
    })
    throw error
  }

  return (data || []) as unknown as AiConfigRow[]
}

async function loadActiveConfigs(
  adminClient: ReturnType<typeof createClient>,
  scope: 'user' | 'global',
  userId?: string
): Promise<AiConfigRow[]> {
  let query = adminClient
    .from('ai_configs')
    .select('*')
    .eq('scope', scope)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })

  if (scope === 'user') {
    if (!userId) return []
    query = query.eq('owner_user_id', userId)
  } else {
    query = query.is('owner_user_id', null)
  }

  const { data, error } = await query
  if (error) {
    if (isMissingScopedColumnsError(error)) {
      console.warn('[ai-resolver] scoped_columns_missing_fallback_legacy', {
        scope,
        userId: scope === 'user' ? userId ?? null : null
      })
      return scope === 'global' ? await loadLegacyGlobalConfigs(adminClient) : []
    }
    console.error('[ai-resolver] load_active_configs_failed', {
      scope,
      userId: scope === 'user' ? userId ?? null : null,
      message: error.message
    })
    return scope === 'global' ? await loadLegacyGlobalConfigs(adminClient).catch(() => []) : []
  }

  return (data || []) as unknown as AiConfigRow[]
}

async function resolveConfigFromDatabase(
  adminClient: ReturnType<typeof createClient>,
  scope: 'user' | 'global',
  userId?: string
): Promise<ResolvedAiConfig | null> {
  const configs = await loadActiveConfigs(adminClient, scope, userId)
  if (configs.length === 0) return null

  if (configs.length > 1) {
    console.warn('[ai-resolver] multiple_active_configs_detected', {
      scope,
      userId: scope === 'user' ? userId ?? null : null,
      count: configs.length,
      configIds: configs.map((config) => config.id)
    })
  }

  for (const config of configs) {
    try {
      return await buildResolvedConfig(
        adminClient,
        config,
        scope === 'user' ? 'user_config' : 'global_config'
      )
    } catch (error) {
      console.error('[ai-resolver] build_resolved_config_failed', {
        scope,
        userId: scope === 'user' ? userId ?? null : null,
        configId: config.id,
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return null
}

export async function resolveAiConfig(userId?: string): Promise<ResolvedAiConfig> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables not configured')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const userConfig = await resolveConfigFromDatabase(adminClient, 'user', userId)
  if (userConfig) return userConfig

  const globalConfig = await resolveConfigFromDatabase(adminClient, 'global')
  if (globalConfig) return globalConfig

  const [baseUrl, model, apiKey] = await Promise.all([
    getAppConfig('ai', 'default_base_url', {
      envVar: 'DEFAULT_AI_BASE_URL',
      defaultValue: 'https://api.deepseek.com/v1'
    }),
    getAppConfig('ai', 'default_model', {
      envVar: 'DEFAULT_AI_MODEL',
      defaultValue: 'deepseek-chat'
    }),
    getAppConfig('ai', 'default_api_key', {
      envVar: 'DEFAULT_AI_API_KEY',
      defaultValue: ''
    })
  ])

  return {
    baseUrl: baseUrl.value,
    model: model.value,
    apiKey: apiKey.value,
    timeoutMs: await getDefaultAiTimeoutMs(),
    providerSlug: null,
    source: 'environment'
  }
}
