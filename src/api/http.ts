// [2026-04-30] 新增：通用 Edge Function 调用辅助，支持 GET/POST/PATCH/DELETE
// [2026-05-03] 重构：统一 fetch 封装，整合 lib/edge.ts 的功能
import { supabase } from '@/lib/supabase'
import { ApiError } from '@/lib/edge'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const DEFAULT_TIMEOUT_MS = 30_000

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session) return null

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (session.expires_at && session.expires_at <= nowSeconds + 60) {
    const {
      data: { session: refreshed }
    } = await supabase.auth.refreshSession()
    return refreshed?.access_token ?? session.access_token ?? null
  }

  return session.access_token ?? null
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(mapErrorCodeToMessage('network_timeout'), 'network_timeout', 408)
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }

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

  return parsed as T
}

export const edgeFn = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  del: (path: string): Promise<void> => request<void>('DELETE', path)
}

export { ApiError } from '@/lib/edge'
