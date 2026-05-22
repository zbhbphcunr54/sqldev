import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, handleCors, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp, getRequestContentLength } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'
import { resolveAiConfig, type ResolvedAiConfig } from '../_shared/ai-resolver.ts'
import { callAiProvider, callAiProviderStream, type AiCallMessages } from '../_shared/ai-client.ts'
import { decodeEscapedSqlText, diffSqlPreview, extractConvertedSqlPreview } from './stream-parser.ts'

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
  stream?: boolean
}

interface ConvertConfig {
  maxInputLength: number
  timeoutMs: number
  temperature: number
  rateLimit: {
    windowMs: number
    maxRequests: number
    trackMax: number
    storeMode: string
  }
}

interface PhaseTimings {
  auth_ms?: number
  config_ms?: number
  rate_limit_ms?: number
  db_list_ms?: number
  template_ms?: number
  ai_config_ms?: number
  ai_call_ms?: number
  parse_ms?: number
}

interface PromptTemplateParts {
  systemPrompt: string
  userPromptTemplate: string
}

function buildAiRequestUrl(baseUrl: string, providerSlug?: string | null): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (providerSlug === 'claude') {
    return `${base}/messages`
  }
  if (/\/v\d+/.test(base)) {
    return `${base}/chat/completions`
  }
  return `${base}/v1/chat/completions`
}


function createSseResponse(stream: ReadableStream<Uint8Array>, corsHeaders: Record<string, string>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}

function encodeSseEvent(event: string, data: Record<string, unknown>): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  return new TextEncoder().encode(payload)
}

let cachedConfig: ConvertConfig | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000

async function loadConfig(): Promise<ConvertConfig> {
  const [maxInputResult, timeoutResult, temperatureResult, rateLimitConfig] = await Promise.all([
    getAppConfig<number>('sql_convert', 'max_input_length', { envVar: 'SQL_CONVERT_MAX_INPUT_LENGTH', defaultValue: MAX_INPUT_DEFAULT, parse: Number }),
    getAppConfig<number>('sql_convert', 'timeout_ms', { envVar: 'SQL_CONVERT_TIMEOUT_MS', defaultValue: AI_TIMEOUT_DEFAULT, parse: Number }),
    getAppConfig<number>('sql_convert', 'temperature', { envVar: 'SQL_CONVERT_TEMPERATURE', defaultValue: 0, parse: Number }),
    getAppConfigsByCategory('rate_limit')
  ])

  return {
    maxInputLength: maxInputResult.value,
    timeoutMs: timeoutResult.value,
    temperature: Math.max(0, Math.min(0.2, Number.isFinite(temperatureResult.value) ? temperatureResult.value : 0)),
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

async function loadTemplate(): Promise<PromptTemplateParts> {
  const [systemResult, userResult] = await Promise.all([
    getAppConfig<string>('sql_convert_template', 'system', { defaultValue: '', envVar: '' }),
    getAppConfig<string>('sql_convert_template', 'user', { defaultValue: '', envVar: '' })
  ])

  return {
    systemPrompt: String(systemResult.value || ''),
    userPromptTemplate: String(userResult.value || '')
  }
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
          converted_sql: decodeEscapedSqlText(String(parsed.converted_sql)),
          ai_ratio: clampRatio(Number(parsed.ai_ratio)),
          manual_needed: Boolean(parsed.manual_needed),
          manual_parts: Array.isArray(parsed.manual_parts) ? parsed.manual_parts.map(String) : [],
          notes: Array.isArray(parsed.notes) ? parsed.notes.map(String) : [],
          accuracy: validateAccuracy(parsed.accuracy)
        },
        rawSql: decodeEscapedSqlText(String(parsed.converted_sql))
      }
    }
  } catch {
    // Not valid JSON, fall through to raw SQL treatment
  }

  // Fallback: treat entire output as raw SQL
  return {
    result: null,
    rawSql: decodeEscapedSqlText(jsonStr)
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

function buildPromptParts(
  template: PromptTemplateParts,
  sourceDb: string,
  targetDb: string,
  sqlType: string,
  inputSql: string
): { systemPrompt: string; userPrompt: string } {
  const userPrompt = template.userPromptTemplate
    .replace(/\{\{source_db\}\}/g, sourceDb)
    .replace(/\{\{target_db\}\}/g, targetDb)
    .replace(/\{\{sql_type\}\}/g, sqlType)
    .replace(/\{\{input_sql\}\}/g, inputSql)

  return {
    systemPrompt: template.systemPrompt,
    userPrompt
  }
}

const DEFAULT_DATABASE_SLUGS = [
  'oracle', 'mysql', 'postgresql', 'kingbasees', 'dm8', 'yashan',
  'gaussdb', 'goldendb', 'oceanbase_oracle', 'oceanbase_mysql',
  'tdsql_mysql', 'tdsql_pg', 'tidb',
  'gbase_8a', 'gbase_8c', 'gbase_8s', 'hivesql'
]

function normalizeDatabaseList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => {
        if (typeof item === 'string') return item.trim()
        if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).slug === 'string') {
          return String((item as Record<string, unknown>).slug).trim()
        }
        return ''
      })
      .filter(Boolean)
    return normalized.length > 0 ? normalized : DEFAULT_DATABASE_SLUGS
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return DEFAULT_DATABASE_SLUGS

    try {
      return normalizeDatabaseList(JSON.parse(trimmed))
    } catch {
      const normalized = trimmed
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      return normalized.length > 0 ? normalized : DEFAULT_DATABASE_SLUGS
    }
  }

  return DEFAULT_DATABASE_SLUGS
}

async function loadDatabaseList(): Promise<string[]> {
  const result = await getAppConfig<unknown>('sql_convert', 'databases', {
    defaultValue: DEFAULT_DATABASE_SLUGS,
    envVar: ''
  })
  return normalizeDatabaseList(result.value)
}

async function measurePhase<T>(
  timings: PhaseTimings,
  key: keyof PhaseTimings,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    return await fn()
  } finally {
    timings[key] = Date.now() - start
  }
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now()
  const clientIp = getClientIp(req)
  const corsHeaders = buildCorsHeaders(req) || defaultCorsHeaders()
  const phaseTimings: PhaseTimings = {}
  let logContext: {
    userId?: string
    userEmail?: string
    sourceDb?: string
    targetDb?: string
    sqlType?: string
    inputLength?: number
    model?: string
    providerSlug?: string | null
    aiRequestBody?: Record<string, unknown>
    aiRequestUrl?: string
  } = {}

  try {
    // CORS preflight
    const corsResult = handleCors(req, corsHelpers)
    if (corsResult) return corsResult

    // Auth
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) {
      return errorResponse(401, 'auth_token_missing', corsHeaders)
    }
    const sessionResult = await measurePhase(phaseTimings, 'auth_ms', () =>
      validateUserSession(token, {
        supabaseUrl: SUPABASE_URL,
        supabaseAnonKey: SUPABASE_ANON_KEY
      })
    )
    if (sessionResult.state !== 'valid') {
      return errorResponse(401, 'auth_unauthorized', corsHeaders)
    }
    logContext = {
      ...logContext,
      userId: sessionResult.userId,
      userEmail: sessionResult.email
    }

    // Config + Rate limit
    const config = await measurePhase(phaseTimings, 'config_ms', () => getConfig())
    const rl = await getRateLimiter(config.rateLimit)
    const rateResult = await measurePhase(phaseTimings, 'rate_limit_ms', () =>
      rl.consume(clientIp)
    )
    if (!rateResult.ok) {
      return errorResponse(429, 'rate_limited', corsHeaders, {
        'Retry-After': String(rateResult.retryAfter)
      })
    }

    // Method
    if (req.method !== 'POST') {
      return errorResponse(405, 'method_not_allowed', corsHeaders)
    }

    // Size check
    const contentLength = getRequestContentLength(req)
    if (contentLength >= 0 && contentLength > config.maxInputLength * 2) {
      return errorResponse(413, 'validation_too_large', corsHeaders)
    }

    // Parse body
    let body: ConvertRequest
    try {
      body = await req.json()
    } catch {
      return errorResponse(400, 'validation_invalid_json', corsHeaders)
    }

    const { source_db: sourceDb, target_db: targetDb, sql_type: sqlType, input_sql: inputSql, stream: streamMode } = body

    // Validate
    if (!sourceDb || typeof sourceDb !== 'string') {
      return errorResponse(400, 'validation_missing_field', corsHeaders)
    }
    if (!targetDb || typeof targetDb !== 'string') {
      return errorResponse(400, 'validation_missing_field', corsHeaders)
    }
    if (sourceDb === targetDb) {
      return errorResponse(400, 'validation_invalid_input', corsHeaders)
    }
    if (!sqlType || !VALID_SQL_TYPES.has(sqlType)) {
      return errorResponse(400, 'validation_invalid_input', corsHeaders)
    }
    if (!inputSql || typeof inputSql !== 'string' || !inputSql.trim()) {
      return errorResponse(400, 'validation_missing_field', corsHeaders)
    }
    if (inputSql.length > config.maxInputLength) {
      return errorResponse(400, 'validation_too_large', corsHeaders)
    }
    logContext = {
      ...logContext,
      sourceDb,
      targetDb,
      sqlType,
      inputLength: inputSql.length
    }

    // Validate databases against configured list
    const validDatabases = await measurePhase(phaseTimings, 'db_list_ms', () =>
      loadDatabaseList()
    )
    if (!validDatabases.includes(sourceDb)) {
      return errorResponse(400, 'validation_unsupported_db', corsHeaders)
    }
    if (!validDatabases.includes(targetDb)) {
      return errorResponse(400, 'validation_unsupported_db', corsHeaders)
    }

    // Load split prompt templates (sql_convert_template.system / sql_convert_template.user)
    const template = await measurePhase(phaseTimings, 'template_ms', () => loadTemplate())
    if (!template.systemPrompt || !template.userPromptTemplate) {
      return errorResponse(500, 'convert_template_missing', corsHeaders)
    }

    const { systemPrompt, userPrompt } = buildPromptParts(template, sourceDb, targetDb, sqlType, inputSql)

    // Resolve AI config
    let aiConfig: ResolvedAiConfig
    try {
      aiConfig = await measurePhase(phaseTimings, 'ai_config_ms', () =>
        resolveAiConfig(logContext.userId)
      )
    } catch (err) {
      logEdgeError('sql-convert', 'resolve_ai_config', err)
      return errorResponse(503, 'ai_config_unavailable', corsHeaders)
    }
    logContext = {
      ...logContext,
      model: aiConfig.model,
      providerSlug: aiConfig.providerSlug
    }

    // Call AI
    const messages: AiCallMessages[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
    const aiRequestBody = {
      model: aiConfig.model,
      provider_slug: aiConfig.providerSlug ?? undefined,
      temperature: config.temperature,
      timeout_ms: config.timeoutMs,
      messages
    }
    const aiRequestUrl = buildAiRequestUrl(aiConfig.baseUrl, aiConfig.providerSlug)
    logContext = {
      ...logContext,
      aiRequestBody,
      aiRequestUrl
    }
    if (streamMode === true) {
      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          try {
            controller.enqueue(encodeSseEvent('meta', {
              model: aiConfig.model,
              provider_slug: aiConfig.providerSlug ?? undefined
            }))

            let streamedRawText = ''
            let streamedSqlText = ''
            const aiText = await measurePhase(phaseTimings, 'ai_call_ms', () =>
              callAiProviderStream(
                {
                  baseUrl: aiConfig.baseUrl,
                  model: aiConfig.model,
                  apiKey: aiConfig.apiKey,
                  providerSlug: aiConfig.providerSlug
                },
                messages,
                {
                  onDelta: (text) => {
                    streamedRawText += text
                    const previewSource = extractConvertedSqlPreview(streamedRawText)
                    if (previewSource === null) return

                    const previewSql = decodeEscapedSqlText(previewSource)
                    const nextChunk = diffSqlPreview(streamedSqlText, previewSql)
                    if (!nextChunk) return

                    streamedSqlText = previewSql
                    controller.enqueue(encodeSseEvent('delta', nextChunk))
                  }
                },
                { signal: AbortSignal.timeout(config.timeoutMs), temperature: config.temperature }
              )
            )

            const { result, rawSql } = await measurePhase(phaseTimings, 'parse_ms', async () =>
              parseAiResult(aiText)
            )
            const durationMs = Date.now() - startTime

            await logOperation({
              userId: logContext.userId,
              userEmail: logContext.userEmail,
              clientIp,
              operation: 'sql_convert',
              apiName: 'sql-convert',
              requestBody: {
                source_db: sourceDb,
                target_db: targetDb,
                sql_type: sqlType,
                input_length: inputSql.length,
                ai_request: aiRequestBody,
                stream: true
              },
              responseStatus: 200,
              durationMs,
              extra: {
                model: aiConfig.model,
                provider_slug: aiConfig.providerSlug ?? undefined,
                ai_request_url: aiRequestUrl,
                temperature: config.temperature,
                ai_ratio: result?.ai_ratio,
                phase_timings: phaseTimings
              }
            }).catch((e: unknown) => { console.warn('[sql-convert] log failed:', e) })

            controller.enqueue(encodeSseEvent('done', {
              output_sql: result?.converted_sql ?? decodeEscapedSqlText(rawSql),
              ai_ratio: result?.ai_ratio ?? 0,
              manual_needed: result?.manual_needed ?? true,
              manual_parts: result?.manual_parts ?? [],
              notes: result?.notes ?? [],
              accuracy: result?.accuracy ?? 'medium',
              model: aiConfig.model,
              duration_ms: durationMs
            }))
            controller.close()
          } catch (err) {
            const durationMs = Date.now() - startTime
            const message = err instanceof Error ? err.message : String(err)
            const code = message.includes('timeout') || message.includes('abort')
              ? 'ai_timeout'
              : message.includes('rate') ? 'ai_upstream_rate_limited'
              : message.includes('auth') || message.includes('401') || message.includes('403') ? 'ai_upstream_auth_failed'
              : 'ai_provider_error'

            await logOperation({
              userId: logContext.userId,
              userEmail: logContext.userEmail,
              clientIp,
              operation: 'sql_convert',
              apiName: 'sql-convert',
              requestBody:
                logContext.sourceDb && logContext.targetDb && logContext.sqlType && logContext.inputLength
                  ? {
                      source_db: logContext.sourceDb,
                      target_db: logContext.targetDb,
                      sql_type: logContext.sqlType,
                      input_length: logContext.inputLength,
                      ai_request: logContext.aiRequestBody,
                      ai_request_url: logContext.aiRequestUrl,
                      stream: true
                    }
                  : undefined,
              responseStatus: code === 'ai_timeout' ? 504 : 502,
              durationMs,
              errorMessage: code,
              extra: {
                model: logContext.model,
                provider_slug: logContext.providerSlug ?? undefined,
                ai_request_url: logContext.aiRequestUrl,
                temperature: config.temperature,
                phase_timings: phaseTimings
              }
            }).catch((e: unknown) => { console.warn('[sql-convert] log failed:', e) })

            controller.enqueue(encodeSseEvent('error', { error: code }))
            controller.close()
          }
        }
      })

      return createSseResponse(stream, corsHeaders)
    }

    const aiText = await measurePhase(phaseTimings, 'ai_call_ms', () =>
      callAiProvider(
        {
          baseUrl: aiConfig.baseUrl,
          model: aiConfig.model,
          apiKey: aiConfig.apiKey,
          providerSlug: aiConfig.providerSlug
        },
        messages,
        { signal: AbortSignal.timeout(config.timeoutMs), temperature: config.temperature }
      )
    )

    // Parse AI response — try structured JSON first, fall back to raw SQL
    const { result, rawSql } = await measurePhase(phaseTimings, 'parse_ms', async () =>
      parseAiResult(aiText)
    )
    const durationMs = Date.now() - startTime

    await logOperation({
      userId: logContext.userId,
      userEmail: logContext.userEmail,
      clientIp,
      operation: 'sql_convert',
      apiName: 'sql-convert',
      requestBody: {
        source_db: sourceDb,
        target_db: targetDb,
        sql_type: sqlType,
        input_length: inputSql.length,
        ai_request: aiRequestBody
      },
      responseStatus: 200,
      durationMs,
      extra: {
        model: aiConfig.model,
        provider_slug: aiConfig.providerSlug ?? undefined,
        ai_request_url: aiRequestUrl,
        temperature: config.temperature,
        ai_ratio: result?.ai_ratio,
        phase_timings: phaseTimings
      }
    }).catch((e: unknown) => { console.warn('[sql-convert] log failed:', e) })

    return jsonResponse(
      200,
      {
        ok: true,
        output_sql: result?.converted_sql ?? rawSql,
        ai_ratio: result?.ai_ratio ?? 0,
        manual_needed: result?.manual_needed ?? true,
        manual_parts: result?.manual_parts ?? [],
        notes: result?.notes ?? [],
        accuracy: result?.accuracy ?? 'medium',
        model: aiConfig.model,
        duration_ms: durationMs
      },
      corsHeaders
    )

  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : String(err)
    const code = message.includes('timeout') || message.includes('abort')
      ? 'ai_timeout'
      : message.includes('rate') ? 'ai_upstream_rate_limited'
      : message.includes('auth') || message.includes('401') || message.includes('403') ? 'ai_upstream_auth_failed'
      : 'ai_provider_error'

    await logOperation({
      userId: logContext.userId,
      userEmail: logContext.userEmail,
      clientIp,
      operation: 'sql_convert',
      apiName: 'sql-convert',
      requestBody:
        logContext.sourceDb && logContext.targetDb && logContext.sqlType && logContext.inputLength
          ? {
              source_db: logContext.sourceDb,
              target_db: logContext.targetDb,
              sql_type: logContext.sqlType,
              input_length: logContext.inputLength,
              ai_request: logContext.aiRequestBody,
              ai_request_url: logContext.aiRequestUrl
            }
          : undefined,
      responseStatus: code === 'ai_timeout' ? 504 : 502,
      durationMs,
      errorMessage: code,
      extra: {
        model: logContext.model,
        provider_slug: logContext.providerSlug ?? undefined,
        ai_request_url: logContext.aiRequestUrl,
        temperature: config.temperature,
        phase_timings: phaseTimings
      }
    }).catch((e: unknown) => { console.warn('[sql-convert] log failed:', e) })

    return errorResponse(code === 'ai_timeout' ? 504 : 502, code, corsHeaders)
  }
})

// Re-export for local testing
export { handleCors } from '../_shared/cors.ts'
