// [2026-05-03] 新增：应用配置类型定义

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'jsonb'

export interface AppConfig {
  id: string
  category: string
  key: string
  value: string | null
  value_type: ConfigValueType
  description: string | null
  is_encrypted: boolean
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateConfigPayload {
  category: string
  key: string
  value: string
  value_type?: ConfigValueType
  description?: string
  is_encrypted?: boolean
}

export interface UpdateConfigPayload {
  value?: string
  value_type?: ConfigValueType
  description?: string
  is_active?: boolean
}

export interface GetConfigOptions<T = string> {
  envVar?: string
  defaultValue?: T
  parse?: (value: string) => T
}

export interface ResolvedConfig<T = string> {
  value: T
  source: 'database' | 'env' | 'default'
}

// 配置分类
export const CONFIG_CATEGORIES = {
  CORS: 'cors',
  ZIWEI: 'ziwei',
  ZIWEI_QA: 'ziwei_qa',
  ZIWEI_CHART: 'ziwei_chart',
  CONVERT: 'convert',
  CONVERT_VERIFY: 'convert_verify',
  RATE_LIMIT: 'rate_limit',
  SYSTEM: 'system'
} as const

export type ConfigCategory = (typeof CONFIG_CATEGORIES)[keyof typeof CONFIG_CATEGORIES]

export const CATEGORY_LABELS: Record<string, string> = {
  cors: 'CORS 跨域',
  ziwei: '紫微分析',
  ziwei_qa: 'AI 问答',
  ziwei_chart: 'AI 图表',
  convert: 'SQL 转换',
  convert_verify: 'AI 校验',
  rate_limit: '限流配置',
  system: '系统配置'
}

export const VALUE_TYPE_LABELS: Record<string, string> = {
  string: '字符串',
  number: '数字',
  boolean: '布尔值',
  jsonb: 'JSON'
}
