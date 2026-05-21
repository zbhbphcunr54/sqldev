import { validateBearerToken } from '../_shared/auth.ts'
import { createCorsHelpers, initCorsConfig } from '../_shared/cors.ts'
import { createRateLimiter } from '../_shared/rate-limit.ts'
import { getClientIp } from '../_shared/request.ts'
import { jsonResponse, logEdgeError } from '../_shared/response.ts'
import { logOperation } from '../_shared/operation-logger.ts'
import {
  getAppConfig,
  getAppConfigsByCategory,
  getDefaultAiTimeoutMs
} from '../_shared/app-config.ts'
import { resolveAiConfig } from '../_shared/ai-resolver.ts'
import { buildQaConfig } from './prompt-template.ts'
import {
  buildAnalysisMessages,
  buildQaMessages,
  buildZiweiAiRequestUrl,
  requestAiAnalysis,
  requestAiAnalysisStream,
  requestAiQa,
  requestAiQaStream,
  type ZiweiAiProviderConfig
} from './provider.ts'
import {
  buildStreamingAnalysisPartial,
  buildAnalysisFallbackFromPartialJson,
  buildFallbackFromText,
  extractAnalysisPreview,
  isPlainObject,
  isValidChartPayloadStructure,
  mapAiErrorStatus,
  normalizeAnalysis,
  normalizeAiErrorCode,
  normalizeChartPayload,
  parseJsonLoose,
  toSafeString
} from './response-parser.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({})

await initCorsConfig()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

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

async function loadAiConfig(userId: string): Promise<{
  aiConfig: ZiweiAiProviderConfig
  allowedEmails: string[]
  rateLimit: { windowMs: number; maxRequests: number; trackMax: number }
  qaSuggestions: string[]
}> {
  const resolvedAiConfig = await resolveAiConfig(userId)
  const fallbackTimeoutMs = resolvedAiConfig.timeoutMs || await getDefaultAiTimeoutMs()

  const [
    timeoutResult,
    maxChartCharsResult,
    qaMaxQuestionResult,
    analysisTemperatureResult,
    qaTemperatureResult,
    analysisSystemResult,
    analysisUserResult,
    qaSystemResult,
    qaUserResult,
    qaSuggestionsResult,
    allowedEmailsResult,
    rateLimitResult
  ] = await Promise.all([
    getAppConfig<number>('ziwei', 'timeout_ms', {
      envVar: 'ZIWEI_AI_TIMEOUT_MS',
      defaultValue: fallbackTimeoutMs,
      parse: Number
    }),
    getAppConfig<number>('ziwei_chart', 'max_chart_chars', {
      envVar: 'ZIWEI_AI_MAX_CHART_CHARS',
      defaultValue: 15000,
      parse: Number
    }),
    getAppConfig<number>('ziwei_qa', 'max_question_chars', {
      envVar: 'ZIWEI_AI_QA_MAX_QUESTION_CHARS',
      defaultValue: 220,
      parse: Number
    }),
    getAppConfig<number>('ziwei_chart', 'temperature', {
      envVar: 'ZIWEI_AI_ANALYSIS_TEMPERATURE',
      defaultValue: 0.2,
      parse: Number
    }),
    getAppConfig<number>('ziwei_qa', 'temperature', {
      envVar: 'ZIWEI_AI_QA_TEMPERATURE',
      defaultValue: 0.2,
      parse: Number
    }),
    getAppConfig<string>('ziwei_chart_template', 'system', {
      envVar: 'ZIWEI_AI_ANALYSIS_SYSTEM_TEMPLATE',
      defaultValue: ''
    }),
    getAppConfig<string>('ziwei_chart_template', 'user', {
      envVar: 'ZIWEI_AI_ANALYSIS_USER_TEMPLATE',
      defaultValue: ''
    }),
    getAppConfig<string>('ziwei_qa_template', 'system', {
      envVar: 'ZIWEI_AI_QA_SYSTEM_TEMPLATE',
      defaultValue: ''
    }),
    getAppConfig<string>('ziwei_qa_template', 'user', {
      envVar: 'ZIWEI_AI_QA_USER_TEMPLATE',
      defaultValue: ''
    }),
    getAppConfig<string[]>('ziwei_qa', 'suggestions', {
      envVar: 'ZIWEI_AI_QA_SUGGESTIONS',
      defaultValue: [],
      parse: (v) => (v ? JSON.parse(v) : [])
    }),
    getAppConfig<string[]>('ziwei', 'allowed_emails', {
      envVar: 'ZIWEI_ALLOWED_EMAILS',
      defaultValue: [],
      parse: (v) => v.split(',').map((e) => e.trim()).filter(Boolean)
    }),
    getAppConfigsByCategory('rate_limit')
  ])

  const aiConfig: ZiweiAiProviderConfig = {
    aiConfig: resolvedAiConfig,
    timeoutMs: timeoutResult.value,
    maxChartChars: maxChartCharsResult.value,
    qaMaxQuestionChars: qaMaxQuestionResult.value,
    analysisTemperature: Math.max(0, Math.min(0.2, Number.isFinite(analysisTemperatureResult.value) ? analysisTemperatureResult.value : 0.2)),
    qaTemperature: Math.max(0, Math.min(0.2, Number.isFinite(qaTemperatureResult.value) ? qaTemperatureResult.value : 0.2)),
    analysisSystemTemplate: String(analysisSystemResult.value || ''),
    analysisUserTemplate: String(analysisUserResult.value || ''),
    qaSystemTemplate: String(qaSystemResult.value || ''),
    qaUserTemplate: String(qaUserResult.value || '')
  }

  const rateLimit = {
    windowMs: Number(rateLimitResult.get('ziwei_window_ms') || rateLimitResult.get('ziwei_window') || 60000),
    maxRequests: Number(rateLimitResult.get('ziwei_requests') || 6),
    trackMax: 2000
  }

  return {
    aiConfig,
    allowedEmails: allowedEmailsResult.value,
    rateLimit,
    qaSuggestions: qaSuggestionsResult.value
  }
}

function hasTemplateContent(value: string): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

const configCache = new Map<string, {
  value: Awaited<ReturnType<typeof loadAiConfig>>
  timestamp: number
}>()
const CONFIG_CACHE_TTL = 60_000

async function getAiConfig(userId: string) {
  const now = Date.now()
  const cached = configCache.get(userId)
  if (cached && now - cached.timestamp <= CONFIG_CACHE_TTL) {
    return cached.value
  }

  const value = await loadAiConfig(userId)
  configCache.set(userId, { value, timestamp: now })
  return value
}

const rateLimiterCache = new Map<string, { limiter: ReturnType<typeof createRateLimiter> }>()

async function getRateLimiter(windowMs: number, maxRequests: number) {
  const key = `${windowMs}:${maxRequests}`
  if (!rateLimiterCache.has(key)) {
    const limiter = createRateLimiter({
      scope: 'ziwei_analysis',
      windowMs,
      maxRequests,
      trackMax: 2000,
      storeMode: 'kv'
    })
    rateLimiterCache.set(key, { limiter })
  }
  return rateLimiterCache.get(key)!.limiter
}

async function writeZiweiAiLog(params: {
  mode: 'analysis' | 'qa'
  userId: string
  userEmail?: string
  clientIp: string
  payload: Record<string, unknown>
  chartPayloadLength: number
  responseStatus: number
  durationMs: number
  responseBody: Record<string, unknown>
  errorMessage?: string
  aiRequest?: Record<string, unknown>
  aiRequestUrl?: string
  temperature?: number
}): Promise<void> {
  const question = toSafeString(params.payload.question, 220)
  await logOperation({
    userId: params.userId,
    userEmail: params.userEmail,
    clientIp: params.clientIp,
    operation: params.mode === 'qa' ? 'ziwei_qa' : 'ziwei_analysis',
    apiName: 'ziwei-analysis',
    requestBody: {
      mode: params.mode,
      style: toSafeString(params.payload.style, 16) || 'pro',
      chart_length: params.chartPayloadLength,
      question_length: question.length || undefined,
      ai_request: params.aiRequest
    },
    responseBody: params.responseBody,
    responseStatus: params.responseStatus,
    durationMs: params.durationMs,
    errorMessage: params.errorMessage,
    extra: {
      ai_request_url: params.aiRequestUrl,
      temperature: params.temperature
    }
  }).catch(() => {})
}

export async function handleZiweiAnalysisRequest(req: Request): Promise<Response> {
  try {
    const corsHeaders = buildCorsHeaders(req)
    if (!corsHeaders) return new Response('Forbidden', { status: 403, headers: defaultCorsHeaders() })
    if (req.method === 'OPTIONS') return new Response('ok', { status: 200, headers: corsHeaders })
    if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'method_not_allowed' }, corsHeaders)

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return jsonResponse(500, { ok: false, error: 'supabase_env_missing' }, corsHeaders)
    }

    const authUser = await validateBearerToken(req.headers.get('authorization'), {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY
    })
    if (!authUser) return jsonResponse(401, { ok: false, error: 'unauthorized' }, corsHeaders)
    const startTime = Date.now()

    const config = await getAiConfig(authUser.userId)

    if (config.allowedEmails.length > 0) {
      const email = String(authUser.email || '').trim().toLowerCase()
      if (!email || !config.allowedEmails.includes(email)) {
        return jsonResponse(403, { ok: false, error: 'forbidden_user' }, corsHeaders)
      }
    }

    let payload: Record<string, unknown> | null = null
    try {
      payload = await req.json()
    } catch (_err) {
      return jsonResponse(400, { ok: false, error: 'invalid_json' }, corsHeaders)
    }
    if (!isPlainObject(payload)) return jsonResponse(400, { ok: false, error: 'invalid_payload' }, corsHeaders)

    const styleRaw = toSafeString(payload.style, 16)
    const style: 'simple' | 'pro' = styleRaw === 'simple' ? 'simple' : 'pro'
    const modeRaw = toSafeString(payload.mode, 16)
    const mode: 'analysis' | 'qa' | 'config' = modeRaw === 'qa' ? 'qa' : modeRaw === 'config' ? 'config' : 'analysis'
    const stream = payload.stream === true
    const signature = toSafeString(payload.signature, 160) || null

    if (mode === 'config') {
      return jsonResponse(200, { ok: true, signature, config: buildQaConfig(JSON.stringify(config.qaSuggestions)) }, corsHeaders)
    }

    const rateLimiter = await getRateLimiter(config.rateLimit.windowMs, config.rateLimit.maxRequests)
    const clientIp = getClientIp(req)
    const rate = await rateLimiter.consume(`${authUser.userId}|${clientIp}`)
    if (!rate.ok) {
      return jsonResponse(429, { ok: false, error: 'rate_limited' }, corsHeaders, { 'Retry-After': String(rate.retryAfter) })
    }

    if (!isValidChartPayloadStructure(payload.chart)) {
      return jsonResponse(400, { ok: false, error: 'invalid_chart_payload' }, corsHeaders)
    }

    const chartPayload = normalizeChartPayload(payload.chart, config.aiConfig.maxChartChars || 15000)
    if (!chartPayload || chartPayload.length < 120) {
      return jsonResponse(400, { ok: false, error: 'chart_payload_too_small' }, corsHeaders)
    }

    if (
      !hasTemplateContent(config.aiConfig.analysisSystemTemplate) ||
      !hasTemplateContent(config.aiConfig.analysisUserTemplate) ||
      !hasTemplateContent(config.aiConfig.qaSystemTemplate) ||
      !hasTemplateContent(config.aiConfig.qaUserTemplate)
    ) {
      return jsonResponse(500, { ok: false, error: 'ziwei_template_missing' }, corsHeaders)
    }

    try {
      if (mode === 'qa') {
        const question = toSafeString(payload.question, config.aiConfig.qaMaxQuestionChars || 220)
        if (!question) return jsonResponse(400, { ok: false, error: 'invalid_question' }, corsHeaders)

        const messages = buildQaMessages(config.aiConfig, chartPayload, question)
        const aiRequest = {
          model: config.aiConfig.aiConfig.model,
          provider_slug: config.aiConfig.aiConfig.providerSlug ?? undefined,
          temperature: config.aiConfig.qaTemperature,
          timeout_ms: config.aiConfig.timeoutMs,
          messages
        }
        const aiRequestUrl = buildZiweiAiRequestUrl(config.aiConfig.aiConfig)

        if (stream) {
          const streamResponse = new ReadableStream<Uint8Array>({
            start: async (controller) => {
              let answerText = ''
              try {
                controller.enqueue(encodeSseEvent('meta', {
                  model: config.aiConfig.aiConfig.model
                }))

                answerText = await requestAiQaStream(config.aiConfig, chartPayload, question, (text) => {
                  if (!text) return
                  controller.enqueue(encodeSseEvent('delta', { text }))
                })

                await writeZiweiAiLog({
                  mode: 'qa',
                  userId: authUser.userId,
                  userEmail: authUser.email,
                  clientIp,
                  payload,
                  chartPayloadLength: chartPayload.length,
                  responseStatus: 200,
                  durationMs: Date.now() - startTime,
                  responseBody: { ok: true },
                  aiRequest,
                  aiRequestUrl,
                  temperature: config.aiConfig.qaTemperature
                })

                controller.enqueue(encodeSseEvent('done', {
                  ok: true,
                  signature,
                  model: config.aiConfig.aiConfig.model,
                  answer: answerText
                }))
                controller.close()
              } catch (err) {
                const errorCode = normalizeAiErrorCode(err)
                logEdgeError('ziwei-analysis', errorCode, err)
                await writeZiweiAiLog({
                  mode: 'qa',
                  userId: authUser.userId,
                  userEmail: authUser.email,
                  clientIp,
                  payload,
                  chartPayloadLength: chartPayload.length,
                  responseStatus: mapAiErrorStatus(errorCode),
                  durationMs: Date.now() - startTime,
                  responseBody: { ok: false, error: errorCode },
                  errorMessage: errorCode
                })
                controller.enqueue(encodeSseEvent('error', { error: errorCode }))
                controller.close()
              }
            }
          })

          return createSseResponse(streamResponse, corsHeaders)
        }

        const answer = await requestAiQa(config.aiConfig, chartPayload, question)
        await writeZiweiAiLog({
          mode: 'qa',
          userId: authUser.userId,
          userEmail: authUser.email,
          clientIp,
          payload,
          chartPayloadLength: chartPayload.length,
          responseStatus: 200,
          durationMs: Date.now() - startTime,
          responseBody: { ok: true },
          aiRequest,
          aiRequestUrl,
          temperature: config.aiConfig.qaTemperature
        })
        return jsonResponse(200, { ok: true, signature, model: config.aiConfig.aiConfig.model, answer }, corsHeaders)
      }

      const messages = buildAnalysisMessages(config.aiConfig, chartPayload, style)
      const aiRequest = {
        model: config.aiConfig.aiConfig.model,
        provider_slug: config.aiConfig.aiConfig.providerSlug ?? undefined,
        temperature: config.aiConfig.analysisTemperature,
        timeout_ms: config.aiConfig.timeoutMs,
        messages
      }
      const aiRequestUrl = buildZiweiAiRequestUrl(config.aiConfig.aiConfig)

      if (stream) {
        const streamResponse = new ReadableStream<Uint8Array>({
          start: async (controller) => {
            let rawText = ''
            let streamedPreview = ''
            let lastPartialPayload = ''
            try {
              controller.enqueue(encodeSseEvent('meta', {
                model: config.aiConfig.aiConfig.model
              }))

              rawText = await requestAiAnalysisStream(config.aiConfig, chartPayload, style, (text) => {
                if (!text) return
                rawText += text

                const partialAnalysis = buildStreamingAnalysisPartial(rawText)
                if (partialAnalysis) {
                  const payload = JSON.stringify(partialAnalysis)
                  if (payload !== lastPartialPayload) {
                    lastPartialPayload = payload
                    controller.enqueue(encodeSseEvent('partial', { analysis: partialAnalysis }))
                  }
                }

                const previewText = extractAnalysisPreview(rawText)
                if (!previewText) return

                const nextChunk = previewText.slice(streamedPreview.length)
                if (!nextChunk) return

                streamedPreview = previewText
                controller.enqueue(encodeSseEvent('delta', { text: nextChunk }))
              })

              const finalPreview = extractAnalysisPreview(rawText)
              if (finalPreview && finalPreview.length > streamedPreview.length) {
                controller.enqueue(encodeSseEvent('delta', {
                  text: finalPreview.slice(streamedPreview.length)
                }))
                streamedPreview = finalPreview
              }

              let analysis = normalizeAnalysis(parseJsonLoose(rawText))
              if (!analysis) analysis = buildAnalysisFallbackFromPartialJson(rawText)
              if (!analysis) analysis = buildFallbackFromText(rawText)
              if (!analysis) throw new Error('ai_response_invalid')

              await writeZiweiAiLog({
                mode: 'analysis',
                userId: authUser.userId,
                userEmail: authUser.email,
                clientIp,
                payload,
                chartPayloadLength: chartPayload.length,
                responseStatus: 200,
                durationMs: Date.now() - startTime,
                responseBody: { ok: true },
                aiRequest,
                aiRequestUrl,
                temperature: config.aiConfig.analysisTemperature
              })

              controller.enqueue(encodeSseEvent('done', {
                ok: true,
                signature,
                model: config.aiConfig.aiConfig.model,
                analysis
              }))
              controller.close()
            } catch (err) {
              const errorCode = normalizeAiErrorCode(err)
              logEdgeError('ziwei-analysis', errorCode, err)
              await writeZiweiAiLog({
                mode: 'analysis',
                userId: authUser.userId,
                userEmail: authUser.email,
                clientIp,
                payload,
                chartPayloadLength: chartPayload.length,
                responseStatus: mapAiErrorStatus(errorCode),
                durationMs: Date.now() - startTime,
                responseBody: { ok: false, error: errorCode },
                errorMessage: errorCode
              })
              controller.enqueue(encodeSseEvent('error', { error: errorCode }))
              controller.close()
            }
          }
        })

        return createSseResponse(streamResponse, corsHeaders)
      }

      const analysis = await requestAiAnalysis(config.aiConfig, chartPayload, style)
      await writeZiweiAiLog({
        mode: 'analysis',
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        payload,
        chartPayloadLength: chartPayload.length,
        responseStatus: 200,
        durationMs: Date.now() - startTime,
        responseBody: { ok: true },
        aiRequest,
        aiRequestUrl,
        temperature: config.aiConfig.analysisTemperature
      })
      return jsonResponse(200, { ok: true, signature, model: config.aiConfig.aiConfig.model, analysis }, corsHeaders)
    } catch (err) {
      const errorCode = normalizeAiErrorCode(err)
      logEdgeError('ziwei-analysis', errorCode, err)
      await writeZiweiAiLog({
        mode: mode === 'qa' ? 'qa' : 'analysis',
        userId: authUser.userId,
        userEmail: authUser.email,
        clientIp,
        payload,
        chartPayloadLength: chartPayload.length,
        responseStatus: mapAiErrorStatus(errorCode),
        durationMs: Date.now() - startTime,
        responseBody: { ok: false, error: errorCode },
        errorMessage: errorCode
      })
      return jsonResponse(mapAiErrorStatus(errorCode), { ok: false, error: errorCode }, corsHeaders)
    }
  } catch (err) {
    const fallbackCors = buildCorsHeaders(req) || defaultCorsHeaders()
    logEdgeError('ziwei-analysis', 'unhandled_error', err)
    return jsonResponse(500, { ok: false, error: 'internal_error' }, fallbackCors)
  }
}
