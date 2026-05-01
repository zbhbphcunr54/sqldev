// [2026-04-30] 新增：AI 模块常量

export const PROVIDER_FILTER_TABS = ['全部', '国内', '国际'] as const

export const REGION_MAP: Record<string, string> = {
  cn: '国内',
  international: '国际'
}

export const DEFAULT_TIMEOUT_MS = 30000
export const MIN_TIMEOUT_MS = 5000
export const MAX_TIMEOUT_MS = 120000
export const MAX_CONFIGS_GLOBAL = 20
