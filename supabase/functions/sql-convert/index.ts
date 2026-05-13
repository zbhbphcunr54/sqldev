import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, handleCors, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp, getRequestContentLength } from '../_shared/request.ts'
import { errorResponse, jsonResponse } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'
import { resolveAiConfig, type ResolvedAiConfig } from '../_shared/ai-resolver.ts'
import { callAiProvider, type AiCallMessages } from '../_shared/ai-client.ts'

const corsHelpers = createCorsHelpers({})
const { defaultCorsHeaders, buildCorsHeaders } = corsHelpers

await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''
const MAX_INPUT_DEFAULT = 100_000
const AI_TIMEOUT_DEFAULT = 120_000

const VALID_SQL_TYPES = new Set(['ddl', 'function', 'procedure', 'auto'])

interface ConvertedResult {
  converted_sql: string
  ai_ratio: number
  manual_needed: boolean
  manual_parts: string[]
  notes: string[]
  accuracy: 'high' | 'medium' | 'low'
}

interface ConvertRequest {
  source_db?: string
  target_db?: string
  sql_type?: string
  input_sql?: string
}

interface ConvertConfig {
  maxInputLength: number
  timeoutMs: number
  rateLimit: {
    windowMs: number
    maxRequests: number
    trackMax: number
    storeMode: string
  }
}

let cachedConfig: ConvertConfig | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000

async function loadConfig(): Promise<ConvertConfig> {
  const [maxInputResult, timeoutResult, rateLimitConfig] = await Promise.all([
    getAppConfig<number>('sql_convert', 'max_input_length', { envVar: 'SQL_CONVERT_MAX_INPUT_LENGTH', defaultValue: MAX_INPUT_DEFAULT, parse: Number }),
    getAppConfig<number>('sql_convert', 'timeout_ms', { envVar: 'SQL_CONVERT_TIMEOUT_MS', defaultValue: AI_TIMEOUT_DEFAULT, parse: Number }),
    getAppConfigsByCategory('rate_limit')
  ])

  return {
    maxInputLength: maxInputResult.value,
    timeoutMs: timeoutResult.value,
    rateLimit: {
      windowMs: Number(rateLimitConfig.get('sql_convert_window_ms') || 60_000),
      maxRequests: Number(rateLimitConfig.get('sql_convert_requests') || 20),
      trackMax: Number(rateLimitConfig.get('sql_convert_track_max') || 2000),
      storeMode: String(rateLimitConfig.get('sql_convert_store_mode') || 'kv')
    }
  }
}

async function getConfig(): Promise<ConvertConfig> {
  const now = Date.now()
  if (!cachedConfig || now - configCacheTime > CONFIG_CACHE_TTL) {
    cachedConfig = await loadConfig()
    configCacheTime = now
  }
  return cachedConfig
}

let rateLimiter: ReturnType<typeof createRateLimiter> | null = null

async function getRateLimiter(config: ConvertConfig['rateLimit']) {
  if (!rateLimiter) {
    rateLimiter = createRateLimiter({
      scope: 'sql-convert',
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      trackMax: config.trackMax,
      storeMode: config.storeMode as 'kv' | 'memory'
    })
  }
  return rateLimiter
}

async function loadTemplate(): Promise<string> {
  const template = await getAppConfig<string>('sql_convert_template', 'unified', {
    defaultValue: '',
    envVar: ''
  })

  return template.value
}

function parseAiResult(raw: string): { result: ConvertedResult | null; rawSql: string } {
  // Try to extract JSON from the response (AI may wrap in markdown fences)
  let jsonStr = raw.trim()

  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  // Attempt direct JSON parse
  try {
    const parsed = JSON.parse(jsonStr)
    if (parsed && typeof parsed.converted_sql === 'string') {
      return {
        result: {
          converted_sql: String(parsed.converted_sql),
          ai_ratio: clampRatio(Number(parsed.ai_ratio)),
          manual_needed: Boolean(parsed.manual_needed),
          manual_parts: Array.isArray(parsed.manual_parts) ? parsed.manual_parts.map(String) : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
          accuracy: validateAccuracy(parsed.accuracy)
        },
        rawSql: parsed.converted_sql
      }
    }
  } catch {
    // Not valid JSON, fall through to raw SQL treatment
  }

  // Fallback: treat entire output as raw SQL
  return {
    result: null,
    rawSql: jsonStr
  }
}

function clampRatio(value: number): number {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function validateAccuracy(value: unknown): 'high' | 'medium' | 'low' {
  if (value === 'high' || value === 'medium' || value === 'low') return value
  return 'medium'
}

function buildPrompt(template: string, sourceDb: string, targetDb: string, sqlType: string, inputSql: string): string {
  return template
    .replace(/\{\{source_db\}\}/g, sourceDb)
    .replace(/\{\{target_db\}\}/g, targetDb)
    .replace(/\{\{sql_type\}\}/g, sqlType)
    .replace(/\{\{input_sql\}\}/g, inputSql)
}

async function loadDatabaseList(): Promise<string[]> {
  const result = await getAppConfig<string>('sql_convert', 'databases', {
    defaultValue: '[]',
    envVar: ''
  })
  try {
    const parsed = JSON.parse(result.value)
    if (Array.isArray(parsed) && parsed.every((v: unknown) => typeof v === 'string')) {
      return parsed as string[]
    }
  } catch {
    // Fall through to default
  }
  return [
    'oracle', 'mysql', 'postgresql', 'kingbasees', 'dm8', 'yashan',
    'gaussdb', 'goldendb', 'oceanbase_oracle', 'oceanbase_mysql',
    'tdsql_mysql', 'tdsql_pg', 'tidb',
    'gbase_8a', 'gbase_8c', 'gbase_8s', 'hivesql'
  ]
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now()
  const origin = req.headers.get('origin') || ''
  const clientIp = getClientIp(req)

  try {
    // CORS preflight
    const corsResult = handleCors(req, corsHelpers)
    if (corsResult) return corsResult

    // Auth
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) {
      return errorResponse(401, 'auth_token_missing', 'Missing authorization token', defaultCorsHeaders)
    }
    const sessionResult = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (sessionResult.state !== 'valid') {
      return errorResponse(401, 'auth_unauthorized', 'Invalid or expired token', defaultCorsHeaders)
    }

    // Config + Rate limit
    const config = await getConfig()
    const rl = await getRateLimiter(config.rateLimit)
    const { allowed } = await rl.check(clientIp)
    if (!allowed) {
      return errorResponse(429, 'rate_limited', 'Too many requests, please try again later', defaultCorsHeaders)
    }

    // Method
    if (req.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', 'Only POST is allowed', defaultCorsHeaders)
    }

    // Size check
    const contentLength = getRequestContentLength(req)
    if (contentLength !== null && contentLength > config.maxInputLength * 2) {
      return errorResponse(413, 'validation_too_large', 'Request body too large', defaultCorsHeaders)
    }

    // Parse body
    let body: ConvertRequest
    try {
      body = await req.json()
    } catch {
      return errorResponse(400, 'validation_invalid_json', 'Invalid JSON body', defaultCorsHeaders)
    }

    const { source_db: sourceDb, target_db: targetDb, sql_type: sqlType, input_sql: inputSql } = body

    // Validate
    if (!sourceDb || typeof sourceDb !== 'string') {
      return errorResponse(400, 'validation_missing_field', 'source_db is required', defaultCorsHeaders)
    }
    if (!targetDb || typeof targetDb !== 'string') {
      return errorResponse(400, 'validation_missing_field', 'target_db is required', defaultCorsHeaders)
    }
    if (sourceDb === targetDb) {
      return errorResponse(400, 'validation_invalid_input', 'source_db and target_db must differ', defaultCorsHeaders)
    }
    if (!sqlType || !VALID_SQL_TYPES.has(sqlType)) {
      return errorResponse(400, 'validation_invalid_input', `sql_type must be one of: ${[...VALID_SQL_TYPES].join(', ')}`, defaultCorsHeaders)
    }
    if (!inputSql || typeof inputSql !== 'string' || !inputSql.trim()) {
      return errorResponse(400, 'validation_missing_field', 'input_sql is required', defaultCorsHeaders)
    }
    if (inputSql.length > config.maxInputLength) {
      return errorResponse(400, 'validation_too_large', `input_sql exceeds max length of ${config.maxInputLength}`, defaultCorsHeaders)
    }

    // Validate databases against configured list
    const validDatabases = await loadDatabaseList()
    if (!validDatabases.includes(sourceDb)) {
      return errorResponse(400, 'validation_unsupported_db', `Unsupported source database: ${sourceDb}`, defaultCorsHeaders)
    }
    if (!validDatabases.includes(targetDb)) {
      return errorResponse(400, 'validation_unsupported_db', `Unsupported target database: ${targetDb}`, defaultCorsHeaders)
    }

    // Load unified prompt template (key: 'unified')
    const template = await loadTemplate()
    if (!template) {
      return errorResponse(500, 'convert_template_missing', 'No unified prompt template configured', defaultCorsHeaders)
    }

    const systemPrompt = buildPrompt(template, sourceDb, targetDb, sqlType, inputSql)

    // Resolve AI config
    let aiConfig: ResolvedAiConfig
    try {
      aiConfig = await resolveAiConfig()
    } catch (err) {
      return errorResponse(503, 'ai_config_unavailable', 'AI configuration is not available', defaultCorsHeaders)
    }

    // Call AI
    const messages: AiCallMessages[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: inputSql }
    ]
    const aiText = await callAiProvider(
      {
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey,
        providerSlug: aiConfig.providerSlug
      },
      messages,
      { signal: AbortSignal.timeout(config.timeoutMs) }
    )

    const durationMs = Date.now() - startTime

    // Parse AI response — try structured JSON first, fall back to raw SQL
    const { result, rawSql } = parseAiResult(aiText)

    const corsHeaders = buildCorsHeaders(origin)

    // Log operation (fire-and-forget)
    logOperation({
      userId: sessionResult.userId,
      userEmail: sessionResult.email,
      clientIp,
      operation: 'sql-convert',
      apiName: 'sql-convert',
      requestBody: { source_db: sourceDb, target_db: targetDb, sql_type: sqlType, input_length: inputSql.length },
      responseStatus: 200,
      durationMs,
      extra: { model: aiConfig.model, provider_slug: aiConfig.providerSlug ?? undefined, ai_ratio: result?.ai_ratio }
    }).catch(() => {})

    return jsonResponse({
      ok: true,
      output_sql: result?.converted_sql ?? rawSql,
      ai_ratio: result?.ai_ratio ?? 0,
      manual_needed: result?.manual_needed ?? true,
      manual_parts: result?.manual_parts ?? [],
      notes: result?.notes ?? [],
      accuracy: result?.accuracy ?? 'medium',
      model: aiConfig.model,
      duration_ms: durationMs
    }, { status: 200, corsHeaders })

  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : String(err)
    const code = message.includes('timeout') || message.includes('abort')
      ? 'ai_timeout'
      : message.includes('rate') ? 'ai_upstream_rate_limited'
      : message.includes('auth') || message.includes('401') || message.includes('403') ? 'ai_upstream_auth_failed'
      : 'ai_provider_error'

    logOperation({
      clientIp,
      operation: 'sql-convert',
      apiName: 'sql-convert',
      responseStatus: code === 'ai_timeout' ? 504 : 502,
      durationMs,
      errorMessage: code
    }).catch(() => {})

    return errorResponse(code === 'ai_timeout' ? 504 : 502, code, 'AI conversion failed, please try again', defaultCorsHeaders)
  }
})

// Re-export for local testing
export { handleCors } from '../_shared/cors.ts'
