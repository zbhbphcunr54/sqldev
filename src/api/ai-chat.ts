import { edgeFn } from './http'
import { ApiError } from '@/lib/edge'
import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface ChatSession {
  id: string
  title: string | null
  provider_slug: string | null
  model: string
  created_at: string
  updated_at: string
}

export interface ChatQuota {
  used: number
  limit: number
  remaining: number
}

export interface SendMessageResponse {
  ok: boolean
  sessionId: string
  message: ChatMessage
  userMessage: ChatMessage
  provider: string
  model: string
  quota: ChatQuota
}

export interface SendMessageStreamHandlers {
  onMeta?: (payload: {
    sessionId?: string
    provider?: string
    model?: string
    userMessage?: ChatMessage
    quota?: ChatQuota
  }) => void
  onDelta?: (text: string) => void
}

export interface SessionsResponse {
  ok: boolean
  sessions: ChatSession[]
}

export interface MessagesResponse {
  ok: boolean
  messages: ChatMessage[]
}

export interface QuotaResponse {
  ok: boolean
  quota: ChatQuota
  provider: string | null
  model: string | null
  maxMessageLength: number
  maxSessions: number
}

function parseSseChunk(buffer: string): { rest: string; events: Array<{ event: string; data: string }> } {
  let working = buffer
  const events: Array<{ event: string; data: string }> = []

  while (true) {
    const boundaryIndex = working.indexOf('\n\n')
    if (boundaryIndex < 0) break

    const rawEvent = working.slice(0, boundaryIndex)
    working = working.slice(boundaryIndex + 2)

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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  return headers
}

export const aiChatApi = {
  sendMessage: (message: string, sessionId?: string): Promise<SendMessageResponse> =>
    edgeFn.post<SendMessageResponse>('/ai-chat', { message, sessionId }, { skipRetry: true }),

  sendMessageStream: async (
    message: string,
    sessionId?: string,
    handlers?: SendMessageStreamHandlers
  ): Promise<SendMessageResponse> => {
    const projectUrl = import.meta.env.VITE_SUPABASE_URL
    if (!projectUrl) {
      throw new ApiError('missing_supabase_url', 'missing_supabase_url', 500)
    }

    const headers = await getAuthHeaders()
    const res = await fetch(`${projectUrl}/functions/v1/ai-chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        sessionId,
        stream: true
      })
    }).catch(() => null)

    if (!res) {
      throw new ApiError('network_error', 'network_error', 0)
    }

    if (!res.ok || !res.body) {
      let errorCode = 'request_failed'
      try {
        const parsed = await res.json() as { error?: string }
        errorCode = parsed.error || errorCode
      } catch {
        errorCode = res.status === 408 ? 'network_timeout' : 'request_failed'
      }
      throw new ApiError(errorCode, errorCode, res.status)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finalResult: SendMessageResponse | null = null

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
          handlers?.onMeta?.({
            sessionId: typeof data.sessionId === 'string' ? data.sessionId : undefined,
            provider: typeof data.provider === 'string' ? data.provider : undefined,
            model: typeof data.model === 'string' ? data.model : undefined,
            userMessage: data.userMessage as ChatMessage | undefined,
            quota: data.quota as ChatQuota | undefined
          })
        } else if (item.event === 'delta') {
          const text = typeof data.text === 'string' ? data.text : ''
          if (text) handlers?.onDelta?.(text)
        } else if (item.event === 'done') {
          finalResult = data as unknown as SendMessageResponse
        } else if (item.event === 'error') {
          const errorCode = typeof data.error === 'string' ? data.error : 'request_failed'
          throw new ApiError(errorCode, errorCode, 500)
        }
      }
    }

    if (!finalResult) {
      throw new ApiError('invalid_response', 'invalid_response', 500)
    }

    return finalResult
  },

  getSessions: (): Promise<SessionsResponse> =>
    edgeFn.get<SessionsResponse>('/ai-chat/sessions', { skipRetry: true }),

  getMessages: (sessionId: string): Promise<MessagesResponse> =>
    edgeFn.get<MessagesResponse>(`/ai-chat/messages?sessionId=${encodeURIComponent(sessionId)}`, {
      skipRetry: true
    }),

  deleteSession: (sessionId: string): Promise<{ ok: boolean }> =>
    edgeFn.del<{ ok: boolean }>(`/ai-chat/sessions/${sessionId}`),

  getQuota: (): Promise<QuotaResponse> =>
    edgeFn.get<QuotaResponse>('/ai-chat/quota', { skipRetry: true })
}
