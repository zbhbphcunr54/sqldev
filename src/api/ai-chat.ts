import { edgeFn } from './http'

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
}

export const aiChatApi = {
  // 禁用自动重试：避免 AI API 被重复调用触发供应商限流，失败由用户手动重试
  sendMessage: (message: string, sessionId?: string): Promise<SendMessageResponse> =>
    edgeFn.post<SendMessageResponse>('/ai-chat', { message, sessionId }, { skipRetry: true }),

  // 非关键查询：关闭自动重试，避免 CORS/网络异常时产生大量重复请求
  getSessions: (): Promise<SessionsResponse> =>
    edgeFn.get<SessionsResponse>('/ai-chat/sessions', { skipRetry: true }),

  getMessages: (sessionId: string): Promise<MessagesResponse> =>
    edgeFn.get<MessagesResponse>(`/ai-chat/messages?sessionId=${encodeURIComponent(sessionId)}`),

  deleteSession: (sessionId: string): Promise<{ ok: boolean }> =>
    edgeFn.del<{ ok: boolean }>(`/ai-chat/sessions/${sessionId}`),

  getQuota: (): Promise<QuotaResponse> => edgeFn.get<QuotaResponse>('/ai-chat/quota', { skipRetry: true })
}
