/**
 * [2026-05-03] 统一配置访问模块
 * 支持数据库优先 + 环境变量回退
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptValue } from './crypto.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

// 内存缓存，TTL 60 秒
const configCache = new Map<string, { value: unknown; timestamp: number }>()
const CACHE_TTL = 60_000

interface DbConfig {
  id: string
  category: string
  key: string
  value: string | null
  value_type: 'string' | 'number' | 'boolean' | 'jsonb'
  is_encrypted: boolean
  is_active: boolean
}

function getAdminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase not configured')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

function parseValue<T>(
  value: string | null,
  valueType: string,
  parseFn?: (v: string) => T
): T {
  if (parseFn && value !== null) return parseFn(value)

  if (value === null) return null as unknown as T

  switch (valueType) {
    case 'number':
      return Number(value) as T
    case 'boolean':
      return (value === 'true') as unknown as T
    case 'jsonb':
      try {
        return JSON.parse(value) as T
      } catch {
        return [] as unknown as T
      }
    default:
      return value as T
  }
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

/**
 * 获取单个配置
 * 优先级：数据库 > 环境变量 > 默认值
 */
export async function getAppConfig<T = string>(
  category: string,
  key: string,
  options?: GetConfigOptions<T>
): Promise<ResolvedConfig<T>> {
  const cacheKey = `${category}:${key}`
  const cached = configCache.get(cacheKey)

  // 缓存命中
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { value: cached.value as T, source: 'database' }
  }

  const adminClient = getAdminClient()

  // 1. 从数据库读取
  try {
    const { data } = await adminClient
      .from('app_configs')
      .select('value, value_type, is_encrypted, is_active')
      .eq('category', category)
      .eq('key', key)
      .eq('is_active', true)
      .single()

    if (data) {
      const dbConfig = data as unknown as DbConfig
      let parsedValue: T

      if (dbConfig.is_encrypted && dbConfig.value) {
        // 解密后解析
        const decrypted = await decryptValue(dbConfig.value)
        parsedValue = parseValue(decrypted, dbConfig.value_type, options?.parse)
      } else {
        parsedValue = parseValue(dbConfig.value, dbConfig.value_type, options?.parse)
      }

      configCache.set(cacheKey, { value: parsedValue, timestamp: Date.now() })
      return { value: parsedValue, source: 'database' }
    }
  } catch {
    // 数据库查询失败，继续尝试环境变量
  }

  // 2. 环境变量回退
  if (options?.envVar) {
    const envValue = Deno.env.get(options.envVar)
    if (envValue !== undefined && envValue !== '') {
      const parsed = parseValue<T>(envValue, 'string', options.parse)
      return { value: parsed, source: 'env' }
    }
  }

  // 3. 默认值
  if (options?.defaultValue !== undefined) {
    return { value: options.defaultValue, source: 'default' }
  }

  throw new Error(`Config not found: ${category}:${key}`)
}

/**
 * 批量获取同分类配置
 */
export async function getAppConfigsByCategory(
  category: string
): Promise<Map<string, unknown>> {
  const adminClient = getAdminClient()
  const result = new Map<string, unknown>()

  const { data } = await adminClient
    .from('app_configs')
    .select('key, value, value_type, is_encrypted')
    .eq('category', category)
    .eq('is_active', true)

  if (data) {
    for (const row of data as unknown as DbConfig[]) {
      const value = row.is_encrypted && row.value
        ? await decryptValue(row.value)
        : row.value

      result.set(row.key, parseValue(value, row.value_type))
    }
  }

  return result
}

/**
 * 清除配置缓存
 */
export function clearConfigCache(): void {
  configCache.clear()
}
