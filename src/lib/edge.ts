// [2026-04-30] 新增：通用 Edge Function 调用辅助
// [2026-05-03] 重构：ApiError 已移至 lib/edge.ts，edgeFn 已整合到 api/http.ts
import { supabase } from '@/lib/supabase'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000
const TOKEN_REFRESH_SKEW_SECONDS = 60

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'api_error', status = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

function readRequestTimeoutMs(): number {
  const raw = Number(import.meta.env.VITE_API_TIMEOUT_MS)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_REQUEST_TIMEOUT_MS
  return Math.min(raw, 120_000)
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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(mapErrorCodeToMessage('network_timeout'), 'network_timeout', 408)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export async function invokeEdgeFunction<TReq extends Record<string, unknown>, TRes>(
  functionName: string,
  body: TReq,
  options?: { method?: 'POST' | 'GET' }
): Promise<TRes> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  const accessToken = await getFreshAccessToken()
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  if (!projectUrl) {
    throw new ApiError('Missing env: VITE_SUPABASE_URL', 'missing_supabase_url', 500)
  }

  const url = `${projectUrl}/functions/v1/${functionName}`
  const method = options?.method || 'POST'
  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers,
      body: method === 'POST' ? JSON.stringify(body) : undefined
    },
    readRequestTimeoutMs()
  )

  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  }

  if (!res.ok) {
    const errorCode = String(parsed.error || parsed.code || 'request_failed')
    throw new ApiError(mapErrorCodeToMessage(errorCode), errorCode, res.status)
  }

  return parsed as TRes
}
