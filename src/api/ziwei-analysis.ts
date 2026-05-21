// src/api/ziwei-analysis.ts
import { edgeFn } from '@/api/http'
import { buildZiweiAiPayload, buildZiweiAiPayloadForAnalysis, buildZiweiAiPayloadForQa } from '@/features/ziwei/ai-utils'
import { ApiError, TOKEN_REFRESH_SKEW_SECONDS } from '@/lib/edge'
import { supabase } from '@/lib/supabase'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export interface ZiweiChartData {
  boardCells: Array<Record<string, unknown>>
  center: Record<string, unknown>
  daXianTimeline: Array<Record<string, unknown>>
  liuNianTimeline: Array<Record<string, unknown>>
  text: string
}

export interface ZiweiAnalysisRequest {
  chart: ZiweiChartData
  profileName?: string
  gender?: string
  school?: string
}

export interface ZiweiAnalysisResult {
  overview: string
  sections: Array<{
    title: string
    summary: string
    evidence?: string[]
    advice?: string[]
  }>
  yearFocus?: {
    summary: string
    opportunities?: string[]
    risks?: string[]
  }
  nextActions?: string[]
  disclaimer?: string
}

export interface ZiweiAnalysisResponse {
  ok: boolean
  data?: ZiweiAnalysisResult
  error?: string
}

export interface ZiweiAnalysisStreamHandlers {
  onMeta?: (payload: { model?: string }) => void
  onDelta?: (text: string) => void
  onPartial?: (analysis: ZiweiAnalysisResult) => void
}

export interface ZiweiQaRequest extends ZiweiAnalysisRequest {
  question: string
  analysis?: ZiweiAnalysisResult | null
}

export interface ZiweiQaResponse {
  ok: boolean
  answer?: string
  data?: {
    answer?: string
    analysis?: {
      overview?: string
    }
  }
  error?: string
}

export interface ZiweiQaStreamHandlers {
  onMeta?: (payload: { model?: string }) => void
  onDelta?: (text: string) => void
}

const DEV_ZIWEI_STREAM_DEBUG = import.meta.env.DEV

function logZiweiStreamDebug(scope: 'analysis' | 'qa', stage: string, detail?: Record<string, unknown>): void {
  if (!DEV_ZIWEI_STREAM_DEBUG) return
  if (detail) {
    console.debug(`[ziwei-stream:${scope}] ${stage}`, detail)
    return
  }
  console.debug(`[ziwei-stream:${scope}] ${stage}`)
}

function parseSseChunk(buffer: string): { rest: string; events: Array<{ event: string; data: string }> } {
  let working = buffer
  const events: Array<{ event: string; data: string }> = []

  while (true) {
    const crlfBoundaryIndex = working.indexOf('\r\n\r\n')
    const lfBoundaryIndex = working.indexOf('\n\n')

    let boundaryIndex = -1
    let boundaryLength = 0

    if (crlfBoundaryIndex >= 0 && (lfBoundaryIndex < 0 || crlfBoundaryIndex < lfBoundaryIndex)) {
      boundaryIndex = crlfBoundaryIndex
      boundaryLength = 4
    } else if (lfBoundaryIndex >= 0) {
      boundaryIndex = lfBoundaryIndex
      boundaryLength = 2
    }

    if (boundaryIndex < 0) break

    const rawEvent = working.slice(0, boundaryIndex)
    working = working.slice(boundaryIndex + boundaryLength)

    const lines = rawEvent.split(/\r?\n/).filter(Boolean)
    let event = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }

    events.push({ event, data: dataLines.join('\n') })
  }

  return { rest: working, events }
}

function parseTrailingSseChunk(buffer: string): Array<{ event: string; data: string }> {
  const trailing = String(buffer || '').trim()
  if (!trailing) return []
  return parseSseChunk(`${buffer}${buffer.endsWith('\n') ? '\n' : '\n\n'}`).events
}

function shouldRefreshSession(expiresAt?: number): boolean {
  if (!Number.isFinite(expiresAt)) return false
  const nowSeconds = Math.floor(Date.now() / 1000)
  return Number(expiresAt) <= nowSeconds + TOKEN_REFRESH_SKEW_SECONDS
}

async function getFreshAccessToken(): Promise<string | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  if (!session) return null
  if (!shouldRefreshSession(session.expires_at)) return session.access_token ?? null

  const {
    data: { session: refreshedSession },
    error
  } = await supabase.auth.refreshSession()

  if (error) {
    throw new ApiError(
      mapErrorCodeToMessage('session_refresh_failed'),
      'session_refresh_failed',
      401
    )
  }

  return refreshedSession?.access_token ?? session.access_token ?? null
}

function buildAnalysisChartPayload(chart: ZiweiChartData, profileName?: string) {
  return buildZiweiAiPayloadForAnalysis(
    buildZiweiAiPayload(chart, { profileName })
  )
}

function buildQaChartPayload(chart: ZiweiChartData, profileName?: string) {
  return buildZiweiAiPayloadForQa(
    buildZiweiAiPayload(chart, { profileName })
  )
}

export async function requestZiweiAnalysis(
  request: ZiweiAnalysisRequest
): Promise<ZiweiAnalysisResponse> {
  const chartPayload = buildAnalysisChartPayload(request.chart, request.profileName)

  const response = await edgeFn.post<
    ZiweiAnalysisResponse & { analysis?: ZiweiAnalysisResult }
  >('/ziwei-analysis', {
    ...request,
    chart: chartPayload,
    mode: 'analysis'
  }, { skipRetry: true })

  return {
    ok: response.ok,
    data: response.data ?? response.analysis,
    error: response.error
  }
}

export async function requestZiweiAnalysisStream(
  request: ZiweiAnalysisRequest,
  handlers?: ZiweiAnalysisStreamHandlers
): Promise<ZiweiAnalysisResponse> {
  const accessToken = await getFreshAccessToken()
  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  if (!projectUrl) {
    return { ok: false, error: 'missing_supabase_url' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${projectUrl}/functions/v1/ziwei-analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...request,
      chart: buildAnalysisChartPayload(request.chart, request.profileName),
      mode: 'analysis',
      stream: true
    })
  }).catch(() => null)

  logZiweiStreamDebug('analysis', 'request', {
    hasAccessToken: Boolean(accessToken),
    profileName: request.profileName || '',
    hasChart: Boolean(request.chart)
  })

  if (!res) return { ok: false, error: 'network_error' }

  logZiweiStreamDebug('analysis', 'response', {
    ok: res.ok,
    status: res.status,
    hasBody: Boolean(res.body)
  })

  if (!res.ok || !res.body) {
    let errorCode = 'request_failed'
    try {
      const parsed = await res.json() as { error?: string }
      errorCode = parsed.error || errorCode
    } catch {
      errorCode = res.status === 408 ? 'network_timeout' : 'request_failed'
    }
    return { ok: false, error: errorCode }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: ZiweiAnalysisResponse | null = null
  let latestPartialAnalysis: ZiweiAnalysisResult | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest

    for (const item of parsed.events) {
      if (!item.data) continue

      let data: Record<string, unknown>
      try {
        data = JSON.parse(item.data) as Record<string, unknown>
      } catch {
        continue
      }

      if (item.event === 'meta') {
        logZiweiStreamDebug('analysis', 'event:meta', data)
        handlers?.onMeta?.({ model: typeof data.model === 'string' ? data.model : undefined })
      } else if (item.event === 'partial') {
        const analysis = data.analysis as ZiweiAnalysisResult | undefined
        if (analysis) {
          logZiweiStreamDebug('analysis', 'event:partial', {
            overviewLength: analysis.overview?.length ?? 0,
            sectionCount: analysis.sections?.length ?? 0
          })
          latestPartialAnalysis = analysis
          handlers?.onPartial?.(analysis)
        }
      } else if (item.event === 'delta') {
        const text = typeof data.text === 'string' ? data.text : ''
        if (text) {
          logZiweiStreamDebug('analysis', 'event:delta', { chunkLength: text.length })
          handlers?.onDelta?.(text)
        }
      } else if (item.event === 'done') {
        logZiweiStreamDebug('analysis', 'event:done', {
          hasAnalysis: Boolean(data.analysis)
        })
        finalResult = {
          ok: true,
          data: (data.analysis as ZiweiAnalysisResult | undefined) ?? undefined
        }
      } else if (item.event === 'error') {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'request_failed'
        }
      }
    }
  }

  buffer += decoder.decode()
  for (const item of parseTrailingSseChunk(buffer)) {
    if (!item.data) continue

    let data: Record<string, unknown>
    try {
      data = JSON.parse(item.data) as Record<string, unknown>
    } catch {
      continue
    }

    if (item.event === 'partial') {
      const analysis = data.analysis as ZiweiAnalysisResult | undefined
      if (analysis) {
        logZiweiStreamDebug('analysis', 'tail:partial', {
          overviewLength: analysis.overview?.length ?? 0,
          sectionCount: analysis.sections?.length ?? 0
        })
        latestPartialAnalysis = analysis
        handlers?.onPartial?.(analysis)
      }
    } else if (item.event === 'done') {
      logZiweiStreamDebug('analysis', 'tail:done', {
        hasAnalysis: Boolean(data.analysis)
      })
      finalResult = {
        ok: true,
        data: (data.analysis as ZiweiAnalysisResult | undefined) ?? undefined
      }
    } else if (item.event === 'error') {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'request_failed'
      }
    }
  }

  if (finalResult) {
    logZiweiStreamDebug('analysis', 'result:done')
    return finalResult
  }
  if (latestPartialAnalysis) {
    logZiweiStreamDebug('analysis', 'result:fallback-partial', {
      overviewLength: latestPartialAnalysis.overview?.length ?? 0,
      sectionCount: latestPartialAnalysis.sections?.length ?? 0
    })
    return { ok: true, data: latestPartialAnalysis }
  }
  logZiweiStreamDebug('analysis', 'result:invalid_response')
  return { ok: false, error: 'invalid_response' }
}

export async function requestZiweiQa(request: ZiweiQaRequest): Promise<ZiweiQaResponse> {
  const chartPayload = buildQaChartPayload(request.chart, request.profileName)

  const response = await edgeFn.post<ZiweiQaResponse>('/ziwei-analysis', {
    ...request,
    chart: chartPayload,
    mode: 'qa'
  }, { skipRetry: true })

  return {
    ok: response.ok,
    answer: response.answer ?? response.data?.answer,
    data: response.data,
    error: response.error
  }
}

export async function requestZiweiQaStream(
  request: ZiweiQaRequest,
  handlers?: ZiweiQaStreamHandlers
): Promise<ZiweiQaResponse> {
  const accessToken = await getFreshAccessToken()
  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  if (!projectUrl) {
    return { ok: false, error: 'missing_supabase_url' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const res = await fetch(`${projectUrl}/functions/v1/ziwei-analysis`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      ...request,
      chart: buildQaChartPayload(request.chart, request.profileName),
      mode: 'qa',
      stream: true
    })
  }).catch(() => null)

  logZiweiStreamDebug('qa', 'request', {
    hasAccessToken: Boolean(accessToken),
    questionLength: request.question?.length ?? 0,
    hasChart: Boolean(request.chart)
  })

  if (!res) return { ok: false, error: 'network_error' }

  logZiweiStreamDebug('qa', 'response', {
    ok: res.ok,
    status: res.status,
    hasBody: Boolean(res.body)
  })

  if (!res.ok || !res.body) {
    let errorCode = 'request_failed'
    try {
      const parsed = await res.json() as { error?: string }
      errorCode = parsed.error || errorCode
    } catch {
      errorCode = res.status === 408 ? 'network_timeout' : 'request_failed'
    }
    return { ok: false, error: errorCode }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: ZiweiQaResponse | null = null
  let streamedAnswer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest

    for (const item of parsed.events) {
      if (!item.data) continue

      let data: Record<string, unknown>
      try {
        data = JSON.parse(item.data) as Record<string, unknown>
      } catch {
        continue
      }

      if (item.event === 'meta') {
        logZiweiStreamDebug('qa', 'event:meta', data)
        handlers?.onMeta?.({ model: typeof data.model === 'string' ? data.model : undefined })
      } else if (item.event === 'delta') {
        const text = typeof data.text === 'string' ? data.text : ''
        if (text) {
          logZiweiStreamDebug('qa', 'event:delta', {
            chunkLength: text.length,
            accumulatedLength: streamedAnswer.length + text.length
          })
          streamedAnswer += text
          handlers?.onDelta?.(text)
        }
      } else if (item.event === 'done') {
        logZiweiStreamDebug('qa', 'event:done', {
          answerLength: typeof data.answer === 'string' ? data.answer.length : 0
        })
        finalResult = {
          ok: true,
          answer: typeof data.answer === 'string' ? data.answer : undefined
        }
      } else if (item.event === 'error') {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'request_failed'
        }
      }
    }
  }

  buffer += decoder.decode()
  for (const item of parseTrailingSseChunk(buffer)) {
    if (!item.data) continue

    let data: Record<string, unknown>
    try {
      data = JSON.parse(item.data) as Record<string, unknown>
    } catch {
      continue
    }

    if (item.event === 'delta') {
      const text = typeof data.text === 'string' ? data.text : ''
      if (text) {
        logZiweiStreamDebug('qa', 'tail:delta', {
          chunkLength: text.length,
          accumulatedLength: streamedAnswer.length + text.length
        })
        streamedAnswer += text
        handlers?.onDelta?.(text)
      }
    } else if (item.event === 'done') {
      logZiweiStreamDebug('qa', 'tail:done', {
        answerLength: typeof data.answer === 'string' ? data.answer.length : 0
      })
      finalResult = {
        ok: true,
        answer: typeof data.answer === 'string' ? data.answer : undefined
      }
    } else if (item.event === 'error') {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'request_failed'
      }
    }
  }

  if (finalResult) {
    logZiweiStreamDebug('qa', 'result:done', {
      answerLength: finalResult.answer?.length ?? 0
    })
    return finalResult
  }
  if (streamedAnswer.trim()) {
    logZiweiStreamDebug('qa', 'result:fallback-delta', {
      answerLength: streamedAnswer.trim().length
    })
    return { ok: true, answer: streamedAnswer.trim() }
  }
  logZiweiStreamDebug('qa', 'result:invalid_response')
  return { ok: false, error: 'invalid_response' }
}
