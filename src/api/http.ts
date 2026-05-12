// 通用 Edge Function 调用辅助，支持 GET/POST/PATCH/DELETE
// [2026-05-07] 优化：添加 token 缓存、请求去重、重试机制
import { supabase } from '@/lib/supabase'
import { ApiError, TOKEN_REFRESH_SKEW_SECONDS } from '@/lib/edge'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
// 请求超时时间（毫秒）
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS) || 60_000
// 重试次数
const MAX_RETRIES = 2
// 重试延迟基础值（毫秒）
const RETRY_DELAY_BASE = 500
// 默认 token 有效期（秒）：1小时
const DEFAULT_TOKEN_TTL_SECONDS = 3600

// Token 缓存：避免每次请求都检查过期
interface CachedToken {
  token: string
  expiresAt: number // Unix 秒
}
let cachedToken: CachedToken | null = null

async function getAccessToken(): Promise<string | null> {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (!session) return null

  const nowSeconds = Math.floor(Date.now() / 1000)

  // 检查缓存的 token 是否仍然有效（预留 TOKEN_REFRESH_SKEW_SECONDS 秒缓冲）
  if (
    cachedToken &&
    cachedToken.token === session.access_token &&
    cachedToken.expiresAt > nowSeconds + TOKEN_REFRESH_SKEW_SECONDS
  ) {
    return cachedToken.token
  }

  // Token 过期或不存在，尝试刷新
  if (session.expires_at && session.expires_at <= nowSeconds + TOKEN_REFRESH_SKEW_SECONDS) {
    const {
      data: { session: refreshed }
    } = await supabase.auth.refreshSession()
    const newToken = refreshed?.access_token ?? session.access_token ?? null
    if (newToken) {
      cachedToken = {
        token: newToken,
        expiresAt: refreshed?.expires_at ?? nowSeconds + DEFAULT_TOKEN_TTL_SECONDS
      }
    }
    return newToken
  }

  // 更新缓存
  cachedToken = {
    token: session.access_token,
    expiresAt: session.expires_at ?? nowSeconds + DEFAULT_TOKEN_TTL_SECONDS
  }
  return cachedToken.token
}

// 请求去重：防止用户快速点击发送重复请求
const pendingRequests = new Map<string, Promise<unknown>>()

function stableStringify(value: unknown): string {
  if (value == null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`
}

function getRequestKey(method: string, path: string, body?: unknown): string {
  return `${method}:${path}:${body ? stableStringify(body) : ''}`
}

interface RequestOptions {
  skipRetry?: boolean
}

async function request<T>(
  method: string,
  path: string,
  body: unknown | undefined,
  opts: RequestOptions | undefined,
  retryCount: number
): Promise<T> {
  const token = await getAccessToken()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

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
    globalThis.clearTimeout(timeoutId)

    // 网络错误时尝试重试（除非调用方跳过）
    if (!opts?.skipRetry && retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount)
      await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
      return request<T>(method, path, body, opts, retryCount + 1)
    }

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
    } catch (e) {
      console.warn('[http] JSON parse failed for response body:', e)
    }
  }

  // 5xx 错误时尝试重试（除非调用方跳过）
  if (!opts?.skipRetry && !res.ok && res.status >= 500 && retryCount < MAX_RETRIES) {
    const delay = RETRY_DELAY_BASE * Math.pow(2, retryCount)
    await new Promise((resolve) => globalThis.setTimeout(resolve, delay))
    return request<T>(method, path, body, opts, retryCount + 1)
  }

  if (!res.ok) {
    const errorCode = String(parsed.error || parsed.code || 'request_failed')
    throw new ApiError(mapErrorCodeToMessage(errorCode), errorCode, res.status)
  }

  return parsed as T
}

// 带去重的请求封装
async function deduplicatedRequest<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const key = getRequestKey(method, path, body)

  const existing = pendingRequests.get(key)
  if (existing) {
    return existing as Promise<T>
  }

  const promise = request<T>(method, path, body, opts, 0).finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, promise)

  return promise
}

export const edgeFn = {
  get: <T>(path: string, opts?: RequestOptions): Promise<T> => deduplicatedRequest<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> => deduplicatedRequest<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> => deduplicatedRequest<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> =>
    deduplicatedRequest<T>('PATCH', path, body, opts),
  del: <T = void>(path: string, opts?: RequestOptions): Promise<T> => deduplicatedRequest<T>('DELETE', path, undefined, opts)
}

export { ApiError } from '@/lib/edge'
