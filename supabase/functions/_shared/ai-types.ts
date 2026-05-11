// Shared AI types used by ai-resolver, ai-config, and other Edge Functions.

export interface AiConfigRow {
  id: string
  created_by: string | null
  provider_id: string
  name: string
  base_url: string
  model: string
  api_key: string
  is_encrypted: boolean
  timeout_ms: number
  is_active: boolean
  last_test_ok: boolean | null
  last_test_ms: number | null
  last_test_at: string | null
  created_at: string
  updated_at: string
}

export interface AiProviderRow {
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
