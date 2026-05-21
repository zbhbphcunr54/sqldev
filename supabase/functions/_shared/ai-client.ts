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

interface AiCallStreamHandlers {
  onDelta?: (text: string) => void
}

interface AiCallOptions {
  signal?: AbortSignal
  maxTokens?: number
  temperature?: number
  extraBody?: Record<string, unknown>
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

function extractContentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''
        const record = item as Record<string, unknown>
        if (typeof record.text === 'string') return record.text
        if (typeof record.content === 'string') return record.content
        return ''
      })
      .join('')
  }
  if (content && typeof content === 'object') {
    const record = content as Record<string, unknown>
    if (typeof record.text === 'string') return record.text
    if (typeof record.content === 'string') return record.content
  }
  return ''
}

function extractResponseText(data: Record<string, unknown>): string {
  const choices = Array.isArray(data.choices) ? data.choices : []
  const firstChoice = choices[0]
  if (firstChoice && typeof firstChoice === 'object') {
    const choice = firstChoice as Record<string, unknown>
    if (typeof choice.text === 'string' && choice.text.trim()) return choice.text.trim()
    if (choice.message && typeof choice.message === 'object') {
      const content = extractContentText((choice.message as Record<string, unknown>).content)
      if (content.trim()) return content.trim()
    }
  }

  const rootContent = extractContentText(data.content)
  if (rootContent.trim()) return rootContent.trim()

  const outputText = extractContentText(data.output_text)
  if (outputText.trim()) return outputText.trim()

  if (data.message && typeof data.message === 'object') {
    const messageContent = extractContentText((data.message as Record<string, unknown>).content)
    if (messageContent.trim()) return messageContent.trim()
  }

  if (typeof data.answer === 'string' && data.answer.trim()) return data.answer.trim()
  return ''
}

function buildRequestBody(
  config: AiCallConfig,
  messages: AiCallMessages[],
  options: AiCallOptions | undefined,
  stream: boolean
): Record<string, unknown> {
  if (config.providerSlug === 'claude') {
    const systemPrompt = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join('\n\n')

    const chatMessages = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: message.content
      }))

    const body: Record<string, unknown> = {
      ...(options?.extraBody ?? {}),
      model: config.model,
      messages: chatMessages,
    }

    if (stream) body.stream = true
    if (options?.maxTokens !== undefined) body.max_tokens = options.maxTokens
    if (systemPrompt) body.system = systemPrompt
    if (options?.temperature !== undefined) body.temperature = options.temperature
    return body
  }

  const body: Record<string, unknown> = {
    ...(options?.extraBody ?? {}),
    model: config.model,
    messages
  }
  if (stream) body.stream = true
  if (options?.maxTokens) body.max_tokens = options.maxTokens
  if (options?.temperature !== undefined) body.temperature = options.temperature
  return body
}

export async function callAiProvider(
  config: AiCallConfig,
  messages: AiCallMessages[],
  options?: AiCallOptions
): Promise<string> {
  const url = buildChatUrl(config.baseUrl, config.providerSlug)
  const headers = buildHeaders(config.apiKey, config.providerSlug)
  const body = buildRequestBody(config, messages, options, false)

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
  const content = extractResponseText(data as Record<string, unknown>)
  if (!content) {
    throw new Error('ai_response_invalid')
  }
  return content
}

function extractOpenAiDelta(payload: Record<string, unknown>): string {
  const choice = Array.isArray(payload.choices) ? payload.choices[0] as Record<string, unknown> | undefined : undefined
  const delta = choice && typeof choice === 'object' ? choice.delta as Record<string, unknown> | undefined : undefined
  const content = delta?.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).text === 'string') {
          return String((item as Record<string, unknown>).text)
        }
        return ''
      })
      .join('')
  }
  return ''
}

function extractClaudeDelta(eventName: string, payload: Record<string, unknown>): string {
  if (eventName !== 'content_block_delta') return ''
  const delta = payload.delta
  if (!delta || typeof delta !== 'object') return ''
  const text = (delta as Record<string, unknown>).text
  return typeof text === 'string' ? text : ''
}

function processSseBuffer(
  buffer: string,
  providerSlug: string | null | undefined,
  onDelta?: (text: string) => void
): { rest: string; deltaText: string } {
  let working = buffer
  let combinedDelta = ''

  while (true) {
    const boundaryIndex = working.indexOf('\n\n')
    if (boundaryIndex < 0) break

    const rawEvent = working.slice(0, boundaryIndex)
    working = working.slice(boundaryIndex + 2)

    const lines = rawEvent
      .split(/\r?\n/)
      .map((line) => line.trimEnd())
      .filter(Boolean)

    let eventName = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).trimStart())
      }
    }

    const dataText = dataLines.join('\n')
    if (!dataText || dataText === '[DONE]') continue

    try {
      const payload = JSON.parse(dataText) as Record<string, unknown>
      const deltaText = providerSlug === 'claude'
        ? extractClaudeDelta(eventName, payload)
        : extractOpenAiDelta(payload)

      if (deltaText) {
        combinedDelta += deltaText
        onDelta?.(deltaText)
      }
    } catch {
      // ignore malformed SSE chunk and continue processing remaining data
    }
  }

  return { rest: working, deltaText: combinedDelta }
}

export async function callAiProviderStream(
  config: AiCallConfig,
  messages: AiCallMessages[],
  handlers?: AiCallStreamHandlers,
  options?: AiCallOptions
): Promise<string> {
  const url = buildChatUrl(config.baseUrl, config.providerSlug)
  const headers = buildHeaders(config.apiKey, config.providerSlug)
  const body = buildRequestBody(config, messages, options, true)

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

  if (!res.body) {
    throw new Error('ai_response_invalid')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const processed = processSseBuffer(buffer, config.providerSlug, handlers?.onDelta)
    buffer = processed.rest
    fullText += processed.deltaText
  }

  buffer += decoder.decode()
  if (buffer.trim()) {
    const processed = processSseBuffer(`${buffer}\n\n`, config.providerSlug, handlers?.onDelta)
    fullText += processed.deltaText
  }

  if (!fullText.trim()) {
    throw new Error('ai_response_invalid')
  }

  return fullText.trim()
}
