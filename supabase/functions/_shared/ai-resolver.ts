import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAppConfig } from './app-config.ts'

export interface ResolvedAiConfig {
  baseUrl: string
  model: string
  apiKey: string
  timeoutMs: number
  providerSlug: string | null
  source: 'database' | 'environment'
}

interface AiConfigRow {
  id: string
  base_url: string
  model: string
  api_key: string
  timeout_ms: number
  provider_id: string
}

interface AiProviderRow {
  slug: string
}

// 优先级：数据库激活配置 > 数据库默认配置 > 环境变量默认配置
export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables not configured')
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // 优先级 1：数据库激活配置
  const { data: activeConfig } = await adminClient
    .from('ai_configs')
    .select('*')
    .eq('is_active', true)
    .single()

  if (activeConfig) {
    const config = activeConfig as unknown as AiConfigRow

    const { data: provider } = await adminClient
      .from('ai_providers')
      .select('slug')
      .eq('id', config.provider_id)
      .single()

    const providerData = provider as unknown as AiProviderRow | null

    // ai_configs.api_key 可为 NULL，转为空字符串避免 Authorization: Bearer null
    const apiKey = config.api_key ?? ''

    return {
      baseUrl: config.base_url,
      model: config.model,
      apiKey,
      timeoutMs: config.timeout_ms,
      providerSlug: providerData?.slug || null,
      source: 'database'
    }
  }

  // 优先级 2：从 app_configs 读取默认配置
  const [baseUrl, model, apiKey, timeoutMs] = await Promise.all([
    getAppConfig('ai', 'default_base_url', { envVar: 'DEFAULT_AI_BASE_URL', defaultValue: 'https://api.deepseek.com/v1' }),
    getAppConfig('ai', 'default_model', { envVar: 'DEFAULT_AI_MODEL', defaultValue: 'deepseek-chat' }),
    getAppConfig('ai', 'default_api_key', { envVar: 'DEFAULT_AI_API_KEY', defaultValue: '' }),
    getAppConfig<number>('ai', 'default_timeout_ms', { envVar: 'DEFAULT_AI_TIMEOUT_MS', defaultValue: 30000, parse: Number })
  ])

  return {
    baseUrl: baseUrl.value,
    model: model.value,
    apiKey: apiKey.value,
    timeoutMs: timeoutMs.value,
    providerSlug: null,
    source: 'environment'
  }
}
