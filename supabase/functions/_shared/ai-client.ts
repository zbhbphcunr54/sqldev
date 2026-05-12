/**
 * Unified AI provider HTTP client.
 * Used by ai-chat (chat completions) and ai-config (connection test).
 */

export interface AiCallConfig {
  baseUrl: string
  model: string
  apiKey: string
  apiFormat?: string
  providerSlug?: string | null
  timeoutMs?: number
}

export interface AiCallMessages {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function buildChatUrl(baseUrl: string, providerSlug?: string | null): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (providerSlug === 'claude') {
    return base + '/messages'
  }
  if (/\/v\d+/.test(base)) {
    return base + '/chat/completions'
  }
  return base + '/v1/chat/completions'
}

function buildHeaders(apiKey: string, providerSlug?: string | null): Record<string, string> {
  if (providerSlug === 'claude') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }
}

function classifyError(status: number): string {
  if (status === 429) return 'ai_upstream_rate_limited'
  if (status === 401 || status === 403) return 'ai_upstream_auth_failed'
  if (status >= 500) return 'ai_upstream_unavailable'
  return 'ai_upstream_error'
}

export async function callAiProvider(
  config: AiCallConfig,
  messages: AiCallMessages[],
  options?: { signal?: AbortSignal; maxTokens?: number; temperature?: number }
): Promise<string> {
  const url = buildChatUrl(config.baseUrl, config.providerSlug)
  const headers = buildHeaders(config.apiKey, config.providerSlug)

  const body: Record<string, unknown> = {
    model: config.model,
    messages
  }
  if (options?.maxTokens) body.max_tokens = options.maxTokens
  if (options?.temperature !== undefined) body.temperature = options.temperature

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal ?? AbortSignal.timeout(config.timeoutMs ?? 30000)
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    const errorCode = classifyError(res.status)
    console.error(`[ai-client] ${errorCode}: status=${res.status} body=${errText.slice(0, 500)}`)
    throw new Error(errorCode)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('ai_response_invalid')
  }
  return content.trim()
}
