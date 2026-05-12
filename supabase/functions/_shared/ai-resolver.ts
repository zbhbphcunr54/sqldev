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
  source: 'database' | 'environment'
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

    // 解密 API Key（如果 is_encrypted）
    let apiKey = config.api_key ?? ''
    if (config.is_encrypted && apiKey) {
      apiKey = await decryptValue(apiKey)
    }

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
  const [baseUrl, model, apiKey] = await Promise.all([
    getAppConfig('ai', 'default_base_url', { envVar: 'DEFAULT_AI_BASE_URL', defaultValue: 'https://api.deepseek.com/v1' }),
    getAppConfig('ai', 'default_model', { envVar: 'DEFAULT_AI_MODEL', defaultValue: 'deepseek-chat' }),
    getAppConfig('ai', 'default_api_key', { envVar: 'DEFAULT_AI_API_KEY', defaultValue: '' }),
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
