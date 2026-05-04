/**
 * [2026-05-03] AI 配置解析器
 * 供其他 Edge Function 使用，获取全局激活的 AI 配置
 * 优先级：数据库激活配置 > 环境变量默认配置
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptApiKey } from './crypto.ts'

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
  api_key_enc: number[]
  timeout_ms: number
  provider_id: string
}

interface AiProviderRow {
  slug: string
}

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

    // 获取供应商 slug
    const { data: provider } = await adminClient
      .from('ai_providers')
      .select('slug')
      .eq('id', config.provider_id)
      .single()

    const providerData = provider as unknown as AiProviderRow | null

    // 解密 API Key
    const apiKey = await decryptApiKey(new Uint8Array(config.api_key_enc))

    return {
      baseUrl: config.base_url,
      model: config.model,
      apiKey,
      timeoutMs: config.timeout_ms,
      providerSlug: providerData?.slug || null,
      source: 'database'
    }
  }

  // 优先级 2：环境变量默认配置
  return {
    baseUrl: Deno.env.get('DEFAULT_AI_BASE_URL') || 'https://api.deepseek.com/v1',
    model: Deno.env.get('DEFAULT_AI_MODEL') || 'deepseek-chat',
    apiKey: Deno.env.get('DEFAULT_AI_API_KEY') || '',
    timeoutMs: Number(Deno.env.get('DEFAULT_AI_TIMEOUT_MS') || '30000'),
    providerSlug: null,
    source: 'environment'
  }
}
