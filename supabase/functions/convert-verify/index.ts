import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractBearerToken, validateUserSession } from '../_shared/auth.ts'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { errorResponse, jsonResponse, logEdgeError } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import { resolveAiConfig } from '../_shared/ai-resolver.ts'
import { getAppConfig, getAppConfigsByCategory } from '../_shared/app-config.ts'
import { buildVerifySystemPrompt, buildVerifyUserPrompt } from './prompt-template.ts'
import { requestAiVerify, type VerifyAiProviderConfig, type VerifyResult } from './provider.ts'
import { computeHash } from './hash.ts'
import { checkQuota, incrementQuota, getQuotaInfo } from './quota.ts'
import { loadVerifyProfile } from './profile.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

// [2026-05-03] 修改：从 app-config 读取配置
interface ConvertVerifyConfig {
  maxSqlLength: number
  maxTokens: number
  rateLimit: {
    maxRequests: number
  }
}

let cachedConfig: ConvertVerifyConfig | null = null
let configCacheTime = 0
const CONFIG_CACHE_TTL = 60_000

async function loadConfig(): Promise<ConvertVerifyConfig> {
  const [maxSqlLengthResult, maxTokensResult, rateLimitConfig] = await Promise.all([
    getAppConfig<number>('convert_verify', 'max_sql_length', { envVar: 'CONVERT_VERIFY_MAX_SQL_LENGTH', defaultValue: 50000, parse: Number }),
    getAppConfig<number>('convert_verify', 'max_tokens', { envVar: 'CONVERT_VERIFY_MAX_TOKENS', defaultValue: 4000, parse: Number }),
    getAppConfigsByCategory('rate_limit')
  ])

  return {
    maxSqlLength: maxSqlLengthResult.value,
    maxTokens: maxTokensResult.value,
    rateLimit: {
      maxRequests: Number(rateLimitConfig.get('convert_verify_requests') || rateLimitConfig.get('convert_verify_requests') || 10)
    }
  }
}

async function getConfig() {
  const now = Date.now()
  if (!cachedConfig || now - configCacheTime > CONFIG_CACHE_TTL) {
    cachedConfig = await loadConfig()
    configCacheTime = now
  }
  return cachedConfig
}

const rateLimiter = createRateLimiter({
  scope: 'convert-verify',
  windowMs: 60_000,
  maxRequests: 10, // 初始值，会在运行时更新
  trackMax: 500,
  storeMode: 'kv'
})

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

async function findCachedResult(
  adminClient: ReturnType<typeof createClient>,
  inputHash: string,
  outputHash: string
): Promise<VerifyResult | null> {
  try {
    const { data } = await adminClient
      .from('convert_verify_results')
      .select('overall_score, syntax_issues, semantic_issues, logic_risks, suggestions, summary')
      .eq('input_hash', inputHash)
      .eq('output_hash', outputHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!data) return null

    return {
      overallScore: data.overall_score ?? 0,
      syntaxIssues: data.syntax_issues ?? [],
      semanticIssues: data.semantic_issues ?? [],
      logicRisks: data.logic_risks ?? [],
      suggestions: data.suggestions ?? [],
      summary: data.summary ?? ''
    }
  } catch {
    return null
  }
}

async function saveVerifyResult(
  adminClient: ReturnType<typeof createClient>,
  params: {
    userId: string
    kind: string
    fromDb: string
    toDb: string
    inputSql: string
    outputSql: string
    inputHash: string
    outputHash: string
    result: VerifyResult
    durationMs: number
    model: string
  }
): Promise<void> {
  try {
    await adminClient.from('convert_verify_results').insert({
      user_id: params.userId,
      kind: params.kind,
      from_db: params.fromDb,
      to_db: params.toDb,
      input_sql: truncateText(params.inputSql, 100_000),
      output_sql: truncateText(params.outputSql, 100_000),
      input_hash: params.inputHash,
      output_hash: params.outputHash,
      ai_model: params.model,
      overall_score: params.result.overallScore,
      syntax_issues: params.result.syntaxIssues,
      semantic_issues: params.result.semanticIssues,
      logic_risks: params.result.logicRisks,
      suggestions: params.result.suggestions,
      summary: params.result.summary,
      duration_ms: params.durationMs
    })
  } catch (err) {
    console.error('Failed to save verify result:', err)
  }
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }

  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  const startTime = Date.now()
  const clientIp = getClientIp(req)

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }

    // [2026-05-03] 加载配置
    const config = await getConfig()

    // GET ?action=quota
    if (req.method === 'GET') {
      const url = new URL(req.url)
      if (url.searchParams.get('action') === 'quota') {
        const token = extractBearerToken(req.headers.get('authorization'))
        if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

        const sessionState = await validateUserSession(token, {
          supabaseUrl: SUPABASE_URL,
          supabaseAnonKey: SUPABASE_ANON_KEY
        })
        if (sessionState.state !== 'valid') return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

        const quota = await getQuotaInfo(sessionState.userId)
        return jsonResponse(200, { ok: true, quota }, corsHeaders)
      }
      return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
    }

    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'method_not_allowed' }, corsHeaders)
    }

    // Rate limit check
    let limit
    try {
      limit = await rateLimiter.consume(`${clientIp}`)
    } catch (err) {
      logEdgeError('convert-verify', 'rate_limit_failed', err)
      limit = { ok: true, remaining: config.rateLimit.maxRequests }
    }
    if (!limit.ok) {
      return jsonResponse(429, { error: 'rate_limited' }, corsHeaders, {
        'Retry-After': String(limit.retryAfter)
      })
    }

    // Auth check
    const token = extractBearerToken(req.headers.get('authorization'))
    if (!token) return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)

    const sessionState = await validateUserSession(token, {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (sessionState.state === 'invalid') return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
    if (sessionState.state === 'error') return jsonResponse(503, { error: 'auth_unavailable' }, corsHeaders)

    const userId = sessionState.userId
    const userEmail = sessionState.email

    // Parse body
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return jsonResponse(400, { error: 'invalid_body' }, corsHeaders)
    }

    const kind = String(body.kind || '')
    const fromDb = String(body.fromDb || '')
    const toDb = String(body.toDb || '')
    const inputSql = String(body.inputSql || '')
    const outputSql = String(body.outputSql || '')
    const profileId = body.profileId ? String(body.profileId) : undefined

    // Validate
    if (!['ddl', 'func', 'proc'].includes(kind)) {
      return jsonResponse(400, { error: 'invalid_kind' }, corsHeaders)
    }
    if (!inputSql || !outputSql) {
      return jsonResponse(400, { error: 'missing_sql' }, corsHeaders)
    }
    if (inputSql.length > config.maxSqlLength || outputSql.length > config.maxSqlLength) {
      return jsonResponse(400, { error: 'sql_too_long' }, corsHeaders)
    }

    // Check quota
    const quotaInfo = await checkQuota(userId, kind)
    if (!quotaInfo.allowed) {
      return jsonResponse(429, {
        ok: false,
        error: 'quota_exceeded',
        message: `今日 ${kind.toUpperCase()} 校验次数已用完（${quotaInfo.used}/${quotaInfo.limit}），明天 00:00 重置`,
        quota: { kind, used: quotaInfo.used, limit: quotaInfo.limit, remaining: 0 }
      }, corsHeaders)
    }

    // Compute hashes
    const inputHash = await computeHash(inputSql)
    const outputHash = await computeHash(outputSql)

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    let cached = false
    let verifyResult: VerifyResult | null = null

    // Cache lookup
    if (serviceRoleKey) {
      const adminClient = createClient(SUPABASE_URL, serviceRoleKey)
      const cachedResult = await findCachedResult(adminClient, inputHash, outputHash)
      if (cachedResult) {
        cached = true
        verifyResult = cachedResult
      }
    }

    // Call AI if not cached
    if (!cached) {
      const profile = await loadVerifyProfile(userId, fromDb, toDb, profileId)
      const systemPrompt = buildVerifySystemPrompt(kind, fromDb, toDb, profile)
      const userPrompt = buildVerifyUserPrompt(inputSql, outputSql)

      // 使用 AI 配置系统获取配置
      const aiConfig = await resolveAiConfig()

      if (!aiConfig.apiKey) {
        return jsonResponse(503, {
          error: 'ai_not_configured',
          message: 'AI 配置未设置，请管理员在 AI 配置页面添加并激活配置'
        }, corsHeaders)
      }

      const providerConfig: VerifyAiProviderConfig = {
        endpoint: aiConfig.baseUrl,
        apiKey: aiConfig.apiKey,
        model: aiConfig.model,
        timeoutMs: aiConfig.timeoutMs,
        maxTokens: config.maxTokens,
        apiFormat: aiConfig.providerSlug === 'claude' ? 'anthropic' : 'openai_compat'
      }

      verifyResult = await requestAiVerify(providerConfig, systemPrompt, userPrompt)

      // Save result
      if (serviceRoleKey) {
        const adminClient = createClient(SUPABASE_URL, serviceRoleKey)
        const durationMs = Date.now() - startTime
        await saveVerifyResult(adminClient, {
          userId,
          kind,
          fromDb,
          toDb,
          inputSql,
          outputSql,
          inputHash,
          outputHash,
          result: verifyResult,
          durationMs,
          model: aiConfig.model
        })
        // Increment quota only when not cached
        await incrementQuota(userId, kind)
      }
    }

    // Operation log
    await logOperation({
      userId,
      userEmail,
      clientIp,
      operation: 'convert_verify',
      apiName: 'convert-verify',
      requestBody: { kind, fromDb, toDb, profileId },
      responseBody: { overallScore: verifyResult?.overallScore, cached },
      responseStatus: 200,
      durationMs: Date.now() - startTime,
      extra: { kind, fromDb, toDb, cached }
    })

    // Return response
    const updatedQuota = await checkQuota(userId, kind)

    // 获取 AI 配置信息
    const aiConfig = await resolveAiConfig().catch(() => null)

    return jsonResponse(200, {
      ok: true,
      overallScore: verifyResult?.overallScore ?? 0,
      syntaxIssues: verifyResult?.syntaxIssues ?? [],
      semanticIssues: verifyResult?.semanticIssues ?? [],
      logicRisks: verifyResult?.logicRisks ?? [],
      suggestions: verifyResult?.suggestions ?? [],
      summary: verifyResult?.summary ?? '',
      cached,
      model: aiConfig?.model,
      durationMs: Date.now() - startTime,
      quota: {
        kind,
        used: updatedQuota.used,
        limit: updatedQuota.limit,
        remaining: updatedQuota.remaining
      }
    }, corsHeaders)
  } catch (err) {
    logEdgeError('convert-verify', 'internal_error', err)
    await logOperation({
      clientIp,
      operation: 'convert_verify_error',
      apiName: 'convert-verify',
      responseStatus: 500,
      durationMs: Date.now() - startTime,
      errorMessage: err instanceof Error ? err.message : 'internal_error'
    })
    return errorResponse(500, 'verify_failed', corsHeaders)
  }
})
