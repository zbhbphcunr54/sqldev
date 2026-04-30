import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn()
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: authMocks
  }
}))

describe('invokeEdgeFunction', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    authMocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-token',
          expires_at: Math.floor(Date.now() / 1000) + 3600
        }
      }
    })
    authMocks.refreshSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  it('maps 401 responses to a sanitized ApiError', async () => {
    const { invokeEdgeFunction } = await import('@/api/http')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401
        })
      )
    )

    await expect(invokeEdgeFunction('convert', { kind: 'ddl' })).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
      message: '登录已失效，请重新登录。'
    })
  })

  it('maps 429 responses to rate limit errors', async () => {
    const { invokeEdgeFunction } = await import('@/api/http')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'rate_limited' }), {
          status: 429
        })
      )
    )

    await expect(invokeEdgeFunction('convert', { kind: 'ddl' })).rejects.toMatchObject({
      code: 'rate_limited',
      status: 429,
      message: '请求过于频繁，请稍后重试。'
    })
  })

  it('maps 500 responses to safe fallback messages', async () => {
    const { invokeEdgeFunction } = await import('@/api/http')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'unexpected_internal_stack' }), {
          status: 500
        })
      )
    )

    await expect(invokeEdgeFunction('convert', { kind: 'ddl' })).rejects.toMatchObject({
      code: 'unexpected_internal_stack',
      status: 500,
      message: '请求失败，请稍后重试。'
    })
  })

  it('aborts hanging requests after the configured timeout', async () => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_API_TIMEOUT_MS', '25')
    const { invokeEdgeFunction } = await import('@/api/http')
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
    )

    const assertion = expect(invokeEdgeFunction('convert', { kind: 'ddl' })).rejects.toMatchObject({
      code: 'network_timeout',
      status: 408,
      message: '网络请求超时，请稍后重试。'
    })
    await vi.advanceTimersByTimeAsync(25)

    await assertion
  })
})
