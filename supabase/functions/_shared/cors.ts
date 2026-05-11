import { getAppConfig } from './app-config.ts'

const LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i

export interface CorsOptions {
  primaryOriginEnvKey?: string
  allowedOriginsEnvKey?: string
  allowLocalhostEnvKey?: string
  allowHeaders?: string
  allowMethods?: string
}

interface CorsConfig {
  primaryOrigin: string
  allowedOrigins: string[]
  allowLocalhost: boolean
  allowHeaders: string
  allowMethods: string
}

// 运行时配置缓存
let runtimeConfig: CorsConfig | null = null
let configInitialized = false

async function loadCorsFromDb(): Promise<Partial<CorsConfig>> {
  try {
    console.log('[CORS] Loading from database...')
    const [primaryOrigin, allowedOrigins, allowLocalhost, allowHeaders, allowMethods] = await Promise.all([
      getAppConfig('cors', 'primary_origin', { envVar: 'CORS_PRIMARY_ORIGIN' }),
      getAppConfig('cors', 'allowed_origins', { envVar: 'CORS_ALLOWED_ORIGINS' }),
      getAppConfig<boolean>('cors', 'allow_localhost', { envVar: 'ALLOW_LOCALHOST_ORIGIN', parse: (v) => v === 'true' }),
      getAppConfig('cors', 'allow_headers', { envVar: 'CORS_ALLOW_HEADERS' }),
      getAppConfig('cors', 'allow_methods', { envVar: 'CORS_ALLOW_METHODS' })
    ])

    console.log('[CORS] primaryOrigin:', primaryOrigin, 'source:', primaryOrigin.source)
    console.log('[CORS] allowedOrigins:', allowedOrigins, 'source:', allowedOrigins.source)
    console.log('[CORS] allowLocalhost:', allowLocalhost, 'source:', allowLocalhost.source)

    return {
      primaryOrigin: primaryOrigin.value || '',
      allowedOrigins: allowedOrigins.value
        ? allowedOrigins.value.split(',').map(s => s.trim()).filter(Boolean)
        : [],
      allowLocalhost: allowLocalhost.value,
      allowHeaders: allowHeaders.value || undefined,
      allowMethods: allowMethods.value || undefined
    }
  } catch (e) {
    console.error('[CORS] loadCorsFromDb failed:', e)
    return {}
  }
}

export async function initCorsConfig(): Promise<void> {
  if (configInitialized) return

  const dbConfig = await loadCorsFromDb()

  runtimeConfig = {
    primaryOrigin: dbConfig.primaryOrigin || '',
    allowedOrigins: dbConfig.allowedOrigins || [],
    allowLocalhost: dbConfig.allowLocalhost ?? true,
    allowHeaders: dbConfig.allowHeaders || 'authorization, x-client-info, apikey, content-type',
    allowMethods: dbConfig.allowMethods || 'GET, POST, PATCH, DELETE, OPTIONS'
  }

  configInitialized = true
}

export function createCorsHelpers(options: CorsOptions) {
  const primaryOriginEnvKey = options.primaryOriginEnvKey || 'CORS_PRIMARY_ORIGIN'
  const allowedOriginsEnvKey = options.allowedOriginsEnvKey || 'CORS_ALLOWED_ORIGINS'
  const allowLocalhostEnvKey = options.allowLocalhostEnvKey || 'ALLOW_LOCALHOST_ORIGIN'
  const allowHeaders = options.allowHeaders || 'authorization, x-client-info, apikey, content-type'
  const allowMethods = options.allowMethods || 'GET, POST, PATCH, DELETE, OPTIONS'

  // 优先使用 runtimeConfig（从 DB 加载），env vars 作为回退
  const _primaryOrigin = configInitialized && runtimeConfig
    ? runtimeConfig.primaryOrigin
    : (Deno.env.get(primaryOriginEnvKey) || '')
  const _allowedOriginsRaw = configInitialized && runtimeConfig
    ? runtimeConfig.allowedOrigins
    : ((Deno.env.get(allowedOriginsEnvKey) || _primaryOrigin)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean))
  const _allowLocalhost = configInitialized && runtimeConfig
    ? runtimeConfig.allowLocalhost
    : (Deno.env.get(allowLocalhostEnvKey) !== 'false')

  const primaryOrigin = _primaryOrigin
  const allowedOrigins = _allowedOriginsRaw.length > 0 ? _allowedOriginsRaw : (_primaryOrigin ? [_primaryOrigin] : [])
  const allowLocalhost = _allowLocalhost
  const allowSet = new Set(allowedOrigins)

  const corsBaseHeaders = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': allowMethods
  }

  function defaultCorsHeaders(): Record<string, string> {
    return {
      ...corsBaseHeaders,
      'Access-Control-Allow-Origin': primaryOrigin || '*',
      Vary: 'Origin'
    }
  }

  function buildCorsHeaders(req: Request): Record<string, string> | null {
    const origin = (req.headers.get('origin') || '').trim()

    // 检查 origin 是否在 allowedOrigins 中
    if (allowedOrigins.includes(origin)) {
      return {
        ...corsBaseHeaders,
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin'
      }
    }

    // 允许本地开发 origin（localhost / 127.0.0.1）
    if (allowLocalhost && LOCAL_ORIGIN_RE.test(origin)) {
      return {
        ...corsBaseHeaders,
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin'
      }
    }

    return null
  }

  return {
    defaultCorsHeaders,
    buildCorsHeaders
  }
}
