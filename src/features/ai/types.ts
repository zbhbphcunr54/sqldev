/** Provider definition from `ai_providers`. */
export interface AiProviderDef {
  id: string
  slug: string
  label: string
  region: 'cn' | 'international'
  base_url: string
  api_format: string
  default_model: string
  models: string[]
  icon_url?: string
  doc_url?: string
  is_enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

/** Masked AI config summary returned by the edge function. */
export interface AiProviderConfig {
  id: string
  created_by?: string | null
  scope?: 'global' | 'user'
  owner_user_id?: string | null
  provider_id: string
  name: string
  base_url: string
  model: string
  api_key_masked: string
  timeout_ms: number
  is_active: boolean
  last_test_ok: boolean | null
  last_test_ms: number | null
  last_test_at: string | null
  created_at: string
  updated_at: string
  provider?: AiProviderDef
}

/** Payload used to create or update an AI config. */
export interface AiConfigPayload {
  provider_id: string
  name?: string
  base_url?: string
  model?: string
  api_key?: string
  timeout_ms?: number
  api_key_masked?: string
  reuse_config_id?: string
}

/** Connectivity test result. */
export interface TestResult {
  ok: boolean
  elapsed_ms: number
  status?: number
  error?: string
  cooldown_remaining?: number
}

export type ProviderFilterTab = '全部' | '国内' | '国际'

export type ConfigStatus = 'active' | 'tested_ok' | 'tested_fail' | 'untested'
