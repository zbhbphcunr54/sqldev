# APP_CONFIG 数据库配置方案

> 将 Supabase Secrets 环境变量迁移到数据库配置表，实现运行时可管理的统一配置系统。
> 遵循 AI_DEV.md 规范设计。

---

## 1. 背景与目标

### 1.1 现状问题

当前项目使用大量 Supabase Secrets 环境变量管理配置，存在以下问题：

| 问题 | 说明 |
|------|------|
| 修改需重新部署 | 环境变量变更需要 `supabase secrets set` + 函数重部署 |
| 无法运行时管理 | 无法在 UI 上查看、修改、版本化配置 |
| 配置分散 | 不同 Edge Function 使用各自的 secrets |
| 缺乏审计 | 无法追踪谁在何时修改了什么配置 |

### 1.2 目标

| 目标 | 说明 |
|------|------|
| 运行时可管理 | 通过数据库表和 UI 管理配置 |
| 向后兼容 | 环境变量作为回退，不影响现有逻辑 |
| 统一入口 | 所有可配置参数通过 `app_configs` 表管理 |
| 审计追溯 | 记录配置变更历史 |

---

## 2. 数据模型

### 2.1 `app_configs` 表

```sql
-- [2026-05-03] 新建：应用配置表（替代部分 Supabase Secrets）
CREATE TABLE public.app_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT,
  value_type    TEXT NOT NULL DEFAULT 'string',
  description   TEXT,
  is_encrypted  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT app_configs_category_key_unique UNIQUE(category, key)
);

-- 表注释
COMMENT ON TABLE public.app_configs IS '应用配置表，通过 category+key 管理所有可配置参数';
COMMENT ON COLUMN public.app_configs.category IS '配置分类：cors / ziwei / ziwei_qa / ziwei_chart / convert / convert_verify / rate_limit / system';
COMMENT ON COLUMN public.app_configs.key IS '配置键名，语义化命名如 primary_origin / api_key / rate_limit_requests';
COMMENT ON COLUMN public.app_configs.value IS '配置值，字符串格式存储';
COMMENT ON COLUMN public.app_configs.value_type IS '值类型：string / number / boolean / jsonb';
COMMENT ON COLUMN public.app_configs.is_encrypted IS 'true 时 value 存储 AES-256-GCM 加密后的密文（Base64 编码）';
COMMENT ON COLUMN public.app_configs.is_active IS 'false 时配置不生效，用于临时禁用而非删除';

-- RLS 策略
ALTER TABLE public.app_configs ENABLE ROW LEVEL SECURITY;

-- 管理员可读写，普通用户只读非加密配置
CREATE POLICY "app_configs_admin_all" ON public.app_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
    )
  );

CREATE POLICY "app_configs_auth_read" ON public.app_configs
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND is_active = TRUE
    AND is_encrypted = FALSE
  );

-- 索引
CREATE INDEX idx_app_configs_category ON public.app_configs (category);
CREATE INDEX idx_app_configs_key ON public.app_configs (key);
CREATE INDEX idx_app_configs_active ON public.app_configs (is_active) WHERE is_active = TRUE;

-- updated_at 触发器
CREATE TRIGGER trg_app_configs_updated_at
  BEFORE UPDATE ON public.app_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.2 配置分类

| Category | 说明 | 示例 Key |
|----------|------|----------|
| `cors` | CORS 跨域配置 | `primary_origin`, `allowed_origins`, `allow_localhost` |
| `ziwei` | 紫微分析 AI 配置 | `api_key`, `base_url`, `model`, `timeout_ms`, `allowed_emails` |
| `ziwei_qa` | AI 问答配置 | `template`, `max_tokens`, `max_question_chars`, `suggestions` |
| `ziwei_chart` | AI 图表配置 | `template`, `max_chart_chars` |
| `convert` | SQL 转换配置 | `max_request_bytes`, `max_json_depth`, `max_rules_bytes` |
| `convert_verify` | AI 校验配置 | `max_sql_length`, `max_tokens`, `daily_limit` |
| `rate_limit` | 通用限流配置 | `convert_requests`, `feedback_requests` 等 |
| `system` | 系统配置 | `cron_secret` |

### 2.3 配置项映射

| Category | Key | 类型 | 说明 | 当前 Env Var |
|----------|-----|------|------|--------------|
| `cors` | `primary_origin` | string | 主站域名 | `CORS_PRIMARY_ORIGIN` |
| `cors` | `allowed_origins` | jsonb | 额外允许的域名列表 | `CORS_ALLOWED_ORIGINS` |
| `cors` | `allow_localhost` | boolean | 是否允许 localhost | `ALLOW_LOCALHOST_ORIGIN` |
| `ziwei` | `api_key` | string | AI API Key（加密） | `ZIWEI_AI_API_KEY` |
| `ziwei` | `base_url` | string | AI API 地址 | `ZIWEI_AI_BASE_URL` |
| `ziwei` | `model` | string | 默认模型 | `ZIWEI_AI_MODEL` |
| `ziwei` | `timeout_ms` | number | 超时毫秒 | `ZIWEI_AI_TIMEOUT_MS` |
| `ziwei` | `analysis_max_tokens` | number | 分析最大 tokens | `ZIWEI_AI_ANALYSIS_MAX_TOKENS` |
| `ziwei` | `allowed_emails` | jsonb | 邮箱白名单 | `ZIWEI_ALLOWED_EMAILS` |
| `ziwei_qa` | `template` | text | 问答 prompt | `ZIWEI_AI_QA_TEMPLATE` |
| `ziwei_qa` | `max_tokens` | number | 最大 tokens | `ZIWEI_AI_QA_MAX_TOKENS` |
| `ziwei_qa` | `max_question_chars` | number | 问题最大字符 | `ZIWEI_AI_QA_MAX_QUESTION_CHARS` |
| `ziwei_qa` | `suggestions` | jsonb | 下拉建议列表 | `ZIWEI_AI_QA_SUGGESTIONS` |
| `ziwei_chart` | `template` | text | 图表分析 prompt | `ZIWEI_AI_ANALYSIS_TEMPLATE` |
| `ziwei_chart` | `max_chart_chars` | number | 图表最大字符 | `ZIWEI_AI_MAX_CHART_CHARS` |
| `convert` | `max_request_bytes` | number | 请求体最大字节 | `CONVERT_MAX_REQUEST_BYTES` |
| `convert` | `max_json_depth` | number | JSON 最大嵌套深度 | `CONVERT_MAX_JSON_DEPTH` |
| `convert` | `max_rules_bytes` | number | 规则文件最大字节 | `CONVERT_MAX_RULES_BYTES` |
| `convert_verify` | `max_sql_length` | number | SQL 最大字符数 | `CONVERT_VERIFY_MAX_SQL_LENGTH` |
| `convert_verify` | `max_tokens` | number | AI 最大 tokens | `CONVERT_VERIFY_MAX_TOKENS` |
| `convert_verify` | `daily_limit` | number | 每日校验次数 | `CONVERT_VERIFY_DAILY_LIMIT` |
| `rate_limit` | `convert_requests` | number | convert 限流次数 | `CONVERT_RATE_LIMIT_MAX_REQUESTS` |
| `rate_limit` | `convert_window_ms` | number | convert 限流窗口 | `CONVERT_RATE_LIMIT_WINDOW_MS` |
| `rate_limit` | `feedback_requests` | number | feedback 限流次数 | `FEEDBACK_RATE_LIMIT_MAX_REQUESTS` |
| `rate_limit` | `history_requests` | number | history 限流次数 | `HISTORY_RATE_LIMIT_MAX_REQUESTS` |
| `rate_limit` | `ziwei_requests` | number | ziwei 限流次数 | `ZIWEI_AI_RATE_LIMIT_MAX_REQUESTS` |
| `system` | `cron_secret` | string | 定时任务密钥 | `CRON_SECRET` |

---

## 3. 类型定义

### 3.1 配置类型

```typescript
// src/features/app-config/types.ts

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

export interface ResolvedConfig<T = string> {
  value: T
  source: 'database' | 'env' | 'default'
}

export interface GetConfigOptions<T = string> {
  envVar?: string
  defaultValue?: T
  parse?: (value: string) => T
  decrypt?: boolean
}
```

### 3.2 配置分类常量

```typescript
// src/features/app-config/constants.ts

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

export const CONFIG_DESCRIPTIONS: Record<string, string> = {
  'cors.primary_origin': '前端主站域名，用于 CORS 白名单',
  'cors.allowed_origins': '额外允许的 CORS 域名列表，JSON 数组',
  'cors.allow_localhost': '是否允许 localhost 开发调试',
  'ziwei.api_key': 'AI 服务 API Key（加密存储）',
  'ziwei.base_url': 'AI 服务 API 地址',
  'ziwei.model': '默认使用的 AI 模型',
  'ziwei.timeout_ms': 'AI 请求超时时间（毫秒）',
  'ziwei.analysis_max_tokens': '深度解读最大 tokens',
  'ziwei.allowed_emails': '允许访问的邮箱白名单，JSON 数组，空数组表示不限制',
  'ziwei_qa.template': 'AI 问答系统 Prompt 模板',
  'ziwei_qa.max_tokens': '问答最大 tokens',
  'ziwei_qa.max_question_chars': '问题最大字符数',
  'ziwei_qa.suggestions': '问答下拉建议列表，JSON 数组',
  'ziwei_chart.template': 'AI 图表解读 Prompt 模板',
  'ziwei_chart.max_chart_chars': '图表解读最大字符数',
  'convert.max_request_bytes': '转换请求体最大字节数',
  'convert.max_json_depth': 'JSON 嵌套最大深度',
  'convert.max_rules_bytes': '规则文件最大字节数',
  'convert_verify.max_sql_length': 'SQL 语句最大字符数',
  'convert_verify.max_tokens': 'AI 校验最大 tokens',
  'convert_verify.daily_limit': '每日校验次数限制',
  'rate_limit.convert_requests': 'SQL 转换限流次数',
  'rate_limit.feedback_requests': '反馈提交限流次数',
  'rate_limit.history_requests': '历史记录限流次数',
  'rate_limit.ziwei_requests': '紫微分析限流次数',
  'system.cron_secret': '定时任务调用密钥'
}
```

---

## 4. 配置访问模块

### 4.1 `_shared/app-config.ts`

```typescript
// supabase/functions/_shared/app-config.ts
// [2026-05-03] 新增：统一配置访问模块，支持数据库优先+环境变量回退

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { encryptValue, decryptValue } from './crypto.ts'

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

export async function getAppConfig<T = string>(
  category: string,
  key: string,
  options?: {
    envVar?: string
    defaultValue?: T
    parse?: (value: string) => T
  }
): Promise<{ value: T; source: 'database' | 'env' | 'default' }> {
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

// 批量获取同分类配置
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

// 清除配置缓存
export function clearConfigCache(): void {
  configCache.clear()
}
```

### 4.2 加密工具扩展

```typescript
// supabase/functions/_shared/crypto.ts
// [2026-05-03] 扩展：添加配置加密/解密函数

const ALGO = { name: 'AES-GCM', length: 256 }
const IV_LENGTH = 12
const TAG_LENGTH = 16

let cachedKey: CryptoKey | null = null

async function getEncryptKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const keyBase64 = Deno.env.get('AI_CONFIG_ENCRYPT_KEY')
  if (!keyBase64) {
    throw new Error('AI_CONFIG_ENCRYPT_KEY not configured')
  }

  const raw = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0))
  cachedKey = await crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt'])
  return cachedKey
}

// [2026-05-03] 新增：配置值加密
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await getEncryptKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

  const enc = await crypto.subtle.encrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    new TextEncoder().encode(plaintext)
  )

  // 返回 Base64 编码的 iv + 密文
  const combined = new Uint8Array(iv.length + enc.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(enc), iv.length)

  return btoa(String.fromCharCode(...combined))
}

// [2026-05-03] 新增：配置值解密
export async function decryptValue(ciphertext: string): Promise<string> {
  const key = await getEncryptKey()

  // Base64 解码
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  const iv = combined.slice(0, IV_LENGTH)
  const enc = combined.slice(IV_LENGTH)

  const dec = await crypto.subtle.decrypt(
    { ...ALGO, iv, tagLength: TAG_LENGTH * 8 },
    key,
    enc
  )

  return new TextDecoder().decode(dec)
}
```

---

## 5. Edge Function 使用示例

### 5.1 `ziwei-analysis/index.ts`

```typescript
// supabase/functions/ziwei-analysis/index.ts
// [2026-05-03] 修改：使用 app-config 替代环境变量

import { getAppConfig } from '../_shared/app-config.ts'

// 获取 AI 配置（数据库优先）
const { value: apiKey } = await getAppConfig('ziwei', 'api_key', {
  envVar: 'ZIWEI_AI_API_KEY'
})

const { value: baseUrl } = await getAppConfig('ziwei', 'base_url', {
  envVar: 'ZIWEI_AI_BASE_URL',
  defaultValue: 'https://api.openai.com/v1'
})

const { value: model } = await getAppConfig('ziwei', 'model', {
  envVar: 'ZIWEI_AI_MODEL',
  defaultValue: 'gpt-4o-mini'
})

const { value: timeoutMs } = await getAppConfig<number>('ziwei', 'timeout_ms', {
  envVar: 'ZIWEI_AI_TIMEOUT_MS',
  defaultValue: 20000,
  parse: Number
})

const { value: allowedEmails } = await getAppConfig<string[]>('ziwei', 'allowed_emails', {
  envVar: 'ZIWEI_ALLOWED_EMAILS',
  defaultValue: [],
  parse: (v) => v.split(',').map(e => e.trim()).filter(Boolean)
})
```

### 5.2 `convert/index.ts`

```typescript
// supabase/functions/convert/index.ts
// [2026-05-03] 修改：使用 app-config 替代环境变量

import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'

// 单个配置
const { value: maxRequestBytes } = await getAppConfig<number>('convert', 'max_request_bytes', {
  envVar: 'CONVERT_MAX_REQUEST_BYTES',
  defaultValue: 6 * 1024 * 1024,
  parse: Number
})

// 批量获取限流配置
const rateLimitConfig = await getAppConfigsByCategory('rate_limit')
const rateLimitRequests = Number(rateLimitConfig.get('convert_requests') || 20)
const rateLimitWindowMs = Number(rateLimitConfig.get('convert_window_ms') || 60_000)
```

---

## 6. 配置管理 API

### 6.1 `app-config/index.ts`

```typescript
// supabase/functions/app-config/index.ts
// [2026-05-03] 新增：配置管理 Edge Function

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'
import { encryptValue, decryptValue } from '../_shared/crypto.ts'
import { clearConfigCache } from '../_shared/app-config.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''

async function getAdminClient() {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('SERVICE_ROLE_KEY not configured')
  return createClient(SUPABASE_URL, key)
}

function sanitizeError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// GET /app-config - 列出所有配置（管理员）
// GET /app-config?category=ziwei - 按分类列出
async function handleList(
  isAdmin: boolean,
  adminClient: ReturnType<typeof createClient>,
  category?: string
) {
  let query = adminClient.from('app_configs').select('*').order('category').order('key')

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())

  // 非管理员时隐藏加密值
  const results = (data || []).map((row: Record<string, unknown>) => {
    if (!isAdmin && row.is_encrypted) {
      return { ...row, value: '***ENCRYPTED***' }
    }
    return row
  })

  return jsonResponse(200, { ok: true, configs: results }, defaultCorsHeaders())
}

// POST /app-config - 创建配置
async function handleCreate(
  userId: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  const { category, key, value, value_type, description, is_encrypted } = body

  if (!category || !key) {
    return jsonResponse(400, { error: 'category and key are required' }, defaultCorsHeaders())
  }

  let finalValue = String(value || '')
  if (is_encrypted && finalValue) {
    finalValue = await encryptValue(finalValue)
  }

  const { data, error } = await adminClient
    .from('app_configs')
    .insert({
      category: String(category),
      key: String(key),
      value: finalValue,
      value_type: String(value_type || 'string'),
      description: description ? String(description) : null,
      is_encrypted: Boolean(is_encrypted),
      created_by: userId
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return jsonResponse(409, { error: 'config_already_exists' }, defaultCorsHeaders())
    }
    return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  }

  clearConfigCache()
  return jsonResponse(201, { ok: true, config: data }, defaultCorsHeaders())
}

// PATCH /app-config/:id - 更新配置
async function handleUpdate(
  id: string,
  body: Record<string, unknown>,
  adminClient: ReturnType<typeof createClient>
) {
  const updateData: Record<string, unknown> = {}

  if (body.value !== undefined) {
    // 获取现有配置判断是否加密
    const { data: existing } = await adminClient
      .from('app_configs')
      .select('is_encrypted')
      .eq('id', id)
      .single()

    const isEncrypted = existing?.is_encrypted || body.is_encrypted

    if (isEncrypted && String(body.value)) {
      updateData.value = await encryptValue(String(body.value))
      updateData.is_encrypted = true
    } else {
      updateData.value = body.value !== null ? String(body.value) : null
    }
  }

  if (body.value_type !== undefined) updateData.value_type = String(body.value_type)
  if (body.description !== undefined) updateData.description = body.description !== null ? String(body.description) : null
  if (body.is_active !== undefined) updateData.is_active = Boolean(body.is_active)

  const { data, error } = await adminClient
    .from('app_configs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())
  if (!data) return jsonResponse(404, { error: 'config_not_found' }, defaultCorsHeaders())

  clearConfigCache()
  return jsonResponse(200, { ok: true, config: data }, defaultCorsHeaders())
}

// DELETE /app-config/:id - 删除配置
async function handleDelete(id: string, adminClient: ReturnType<typeof createClient>) {
  const { error } = await adminClient.from('app_configs').delete().eq('id', id)
  if (error) return jsonResponse(400, { error: sanitizeError(error) }, defaultCorsHeaders())

  clearConfigCache()
  return jsonResponse(200, { ok: true }, defaultCorsHeaders())
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  try {
    // 认证
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: Deno.env.get('SUPABASE_ANON_KEY') || ''
    })

    if (sessionState.state !== 'valid') {
      return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    }

    const adminClient = await getAdminClient()

    // 检查管理员权限
    const { data: userData } = await adminClient.auth.adminGetUserById(sessionState.userId)
    const isAdmin = userData?.app_metadata?.is_admin === true

    // 非管理员只读
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const category = url.searchParams.get('category') || undefined
      return handleList(isAdmin, adminClient, category)
    }

    if (!isAdmin) {
      return jsonResponse(403, { error: 'admin_required' }, corsHeaders)
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const id = pathParts.length > 2 ? pathParts[pathParts.length - 1] : null

    const body = await req.json().catch(() => null)

    if (req.method === 'POST' && !id) {
      return handleCreate(sessionState.userId, body || {}, adminClient)
    }

    if (req.method === 'PATCH' && id) {
      return handleUpdate(id, body || {}, adminClient)
    }

    if (req.method === 'DELETE' && id) {
      return handleDelete(id, adminClient)
    }

    return jsonResponse(404, { error: 'not_found' }, corsHeaders)
  } catch (err) {
    console.error('app-config error:', err)
    return errorResponse(500, sanitizeError(err), corsHeaders)
  }
})
```

---

## 7. 前端 API 层

### 7.1 `src/api/app-config.ts`

```typescript
// src/api/app-config.ts
// [2026-05-03] 新增：配置管理 API

import { edgeFn } from '@/lib/edge'
import type { AppConfig } from '@/features/app-config'

export const appConfigApi = {
  list: (category?: string) => {
    const url = category ? `/app-config?category=${category}` : '/app-config'
    return edgeFn.get<{ ok: boolean; configs: AppConfig[] }>(url)
  },

  create: (config: {
    category: string
    key: string
    value: string
    value_type?: string
    description?: string
    is_encrypted?: boolean
  }) => edgeFn.post<{ ok: boolean; config: AppConfig }>('/app-config', config),

  update: (
    id: string,
    config: {
      value?: string
      value_type?: string
      description?: string
      is_active?: boolean
    }
  ) => edgeFn.patch<{ ok: boolean; config: AppConfig }>(`/app-config/${id}`, config),

  delete: (id: string) => edgeFn.delete(`/app-config/${id}`)
}
```

### 7.2 `src/features/app-config/types.ts`

```typescript
// src/features/app-config/types.ts
// [2026-05-03] 新增：前端配置类型定义

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
```

### 7.3 `src/features/app-config/index.ts`

```typescript
// src/features/app-config/index.ts
// [2026-05-03] 新增：barrel export

export * from './types'
export * from './constants'
```

---

## 8. 种子数据

### 8.1 迁移脚本

```sql
-- [2026-05-03] 迁移现有 Supabase Secrets 到数据库配置
-- 执行前请确保 app_configs 表已创建

-- CORS 配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'cors', 'primary_origin', env.value, 'string', 'CORS 主站域名'
FROM (VALUES ('CORS_PRIMARY_ORIGIN')) AS env(name)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'cors' AND key = 'primary_origin');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'cors', 'allowed_origins', '[]', 'jsonb', '额外允许的 CORS 域名'
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'cors' AND key = 'allowed_origins');

-- 限流配置（convert）
INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'rate_limit', 'convert_requests', COALESCE(env.val, '20'), 'number', 'SQL 转换限流次数'
FROM (VALUES ('CONVERT_RATE_LIMIT_MAX_REQUESTS')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'rate_limit' AND key = 'convert_requests');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'rate_limit', 'convert_window_ms', COALESCE(env.val, '60000'), 'number', 'SQL 转换限流窗口（毫秒）'
FROM (VALUES ('CONVERT_RATE_LIMIT_WINDOW_MS')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'rate_limit' AND key = 'convert_window_ms');

-- 转换配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'convert', 'max_request_bytes', COALESCE(env.val, '6291456'), 'number', '请求体最大字节'
FROM (VALUES ('CONVERT_MAX_REQUEST_BYTES')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'convert' AND key = 'max_request_bytes');

-- 紫微分析 AI 配置（敏感值从 Secrets 迁移时需要管理员手动录入）
-- 以下为默认值占位，实际部署时管理员需通过 UI 配置真实 API Key
INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'ziwei', 'base_url', 'https://api.openai.com/v1', 'string', 'AI API 地址'
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'ziwei' AND key = 'base_url');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'ziwei', 'model', 'gpt-4o-mini', 'string', '默认 AI 模型'
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'ziwei' AND key = 'model');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'ziwei', 'timeout_ms', '20000', 'number', 'AI 请求超时（毫秒）'
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'ziwei' AND key = 'timeout_ms');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'ziwei', 'allowed_emails', '[]', 'jsonb', '允许访问的邮箱白名单，空数组表示不限制'
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'ziwei' AND key = 'allowed_emails');

-- AI 校验配置
INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'convert_verify', 'max_sql_length', COALESCE(env.val, '50000'), 'number', 'SQL 最大字符数'
FROM (VALUES ('CONVERT_VERIFY_MAX_SQL_LENGTH')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'convert_verify' AND key = 'max_sql_length');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'convert_verify', 'max_tokens', COALESCE(env.val, '4000'), 'number', 'AI 校验最大 tokens'
FROM (VALUES ('CONVERT_VERIFY_MAX_TOKENS')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'convert_verify' AND key = 'max_tokens');

INSERT INTO public.app_configs (category, key, value, value_type, description)
SELECT 'convert_verify', 'daily_limit', COALESCE(env.val, '10'), 'number', '每日校验次数限制'
FROM (VALUES ('CONVERT_VERIFY_DAILY_LIMIT')) AS env(name, val)
WHERE NOT EXISTS (SELECT 1 FROM public.app_configs WHERE category = 'convert_verify' AND key = 'daily_limit');
```

---

## 9. 迁移步骤

### 阶段 1：基础设施（Day 1）

| # | 任务 | 产出 |
|---|------|------|
| 1.1 | 创建 `app_configs` 表 + RLS | migration |
| 1.2 | 创建 `_shared/app-config.ts` 配置访问模块 | 共享模块 |
| 1.3 | 创建 `app-config` Edge Function | 管理 API |
| 1.4 | 更新 `_shared/crypto.ts` 添加加密函数 | 加密工具 |
| 1.5 | 配置 `config.toml` | 函数配置 |

### 阶段 2：迁移配置（Day 2）

| # | 任务 | 产出 |
|---|------|------|
| 2.1 | 创建迁移种子数据 SQL | seed |
| 2.2 | 创建前端 API 层 `src/api/app-config.ts` | API |
| 2.3 | 创建前端类型 `src/features/app-config/` | 类型 |
| 2.4 | 更新 `src/types/database.types.ts` | 类型 |

### 阶段 3：更新 Edge Functions（Day 3）

| # | 任务 | 产出 |
|---|------|------|
| 3.1 | 更新 `ziwei-analysis` 使用 app-config | 函数 |
| 3.2 | 更新 `convert` 使用 app-config | 函数 |
| 3.3 | 更新 `convert-verify` 使用 app-config | 函数 |
| 3.4 | 更新 `feedback` 使用 app-config | 函数 |
| 3.5 | 更新 `cleanup` 使用 app-config | 函数 |

### 阶段 4：前端配置页面（Day 4-5）

| # | 任务 | 产出 |
|---|------|------|
| 4.1 | 创建 `AppConfigPage.vue` | 页面 |
| 4.2 | 创建 `ConfigList.vue` 组件 | 组件 |
| 4.3 | 创建 `ConfigEditModal.vue` 组件 | 组件 |
| 4.4 | 注册路由 `/app-config` | 路由 |
| 4.5 | 集成到 AI 配置页面 Tab | UI |

### 阶段 5：验证与清理（Day 6）

| # | 任务 | 产出 |
|---|------|------|
| 5.1 | 本地测试配置读取/写入 | 测试 |
| 5.2 | 验证环境变量回退 | 测试 |
| 5.3 | 更新 smoke 测试 | 测试 |
| 5.4 | 文档更新 | 文档 |

---

## 10. 仍需保留的 Supabase Secrets

| 变量 | 用途 | 说明 |
|------|------|------|
| `SUPABASE_URL` | 连接地址 | 无法迁移 |
| `SUPABASE_ANON_KEY` | 匿名密钥 | 无法迁移 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务密钥 | 无法迁移 |
| `AI_CONFIG_ENCRYPT_KEY` | 加密密钥 | 敏感密钥，用于加密 `api_key` 等 |
| `CRON_SECRET` | 定时任务密钥 | 可选，安全加固 |

---

## 11. 安全考虑

| 措施 | 说明 |
|------|------|
| RLS | 仅管理员可写，所有登录用户可读非加密配置 |
| 加密 | API Key 等敏感值 AES-256-GCM 加密存储 |
| 审计 | `operation_logs` 记录配置变更 |
| 缓存 | 1 分钟内存缓存，减少 DB 查询 |
| 回退 | 数据库配置缺失时自动回退到环境变量 |
| 清理 | 修改配置后自动清除缓存 |

---

## 12. 验证步骤

```powershell
# 1. 部署数据库迁移
supabase db push

# 2. 部署 Edge Functions
supabase functions deploy app-config
supabase functions deploy ziwei-analysis
supabase functions deploy convert
supabase functions deploy convert-verify

# 3. 运行 smoke 测试
cd sqldev
node tests/smoke.mjs

# 4. 运行类型检查
pnpm typecheck

# 5. 验证配置读取
curl https://<project>.supabase.co/functions/v1/app-config \
  -H "Authorization: Bearer <admin_token>"
```

---

## 13. 风险与回滚

| 风险 | 缓解措施 |
|------|----------|
| 配置读取失败 | 环境变量作为回退，不会中断服务 |
| 迁移脚本错误 | 种子数据使用 `INSERT ... WHERE NOT EXISTS` 幂等 |
| 缓存问题 | `clearConfigCache()` 确保更新后立即生效 |
| 加密密钥丢失 | `AI_CONFIG_ENCRYPT_KEY` 必须备份 |

**回滚方案**：删除新增的 migration，恢复旧的环境变量即可。
