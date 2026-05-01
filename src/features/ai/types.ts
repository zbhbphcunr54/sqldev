// [2026-04-30] 新增：AI 模块类型定义

/** 供应商定义（来自 ai_providers 表） */
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

/** 全局配置摘要（来自 ai-config Edge Function，api_key 已脱敏） */
export interface AiProviderConfig {
  id: string
  created_by?: string | null
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

/** 创建/更新配置的请求体 */
export interface AiConfigPayload {
  provider_id: string
  name?: string
  base_url?: string
  model?: string
  api_key?: string
  timeout_ms?: number
}

/** 测试结果 */
export interface TestResult {
  ok: boolean
  elapsed_ms: number
  status?: number
  error?: string
}

/** 供应商筛选 Tab */
export type ProviderFilterTab = '全部' | '国内' | '国际'

/** 配置状态 */
export type ConfigStatus = 'active' | 'tested_ok' | 'tested_fail' | 'untested'
