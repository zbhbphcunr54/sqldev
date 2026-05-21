import { computed, ref } from 'vue'
import { aiChatApi, type ChatMessage, type ChatQuota, type ChatSession } from '@/api/ai-chat'
import { ApiError } from '@/api/http'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export interface ChatState {
  open: boolean
  sessionId: string | null
  messages: ChatMessage[]
  sessions: ChatSession[]
  loading: boolean
  sending: boolean
  error: string
  quota: ChatQuota | null
}

function getChatErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    return mapErrorCodeToMessage(err.code || err.message)
  }

  console.error('[useChat] request failed:', err)

  if (err instanceof TypeError) {
    const msg = err.message || ''
    if (
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed')
    ) {
      return mapErrorCodeToMessage('network_error')
    }

    return `${mapErrorCodeToMessage('server_error')}：${msg.slice(0, 80)}`
  }

  return mapErrorCodeToMessage('unknown_error')
}

const open = ref(false)
const sessionId = ref<string | null>(null)
const messages = ref<ChatMessage[]>([])
const sessions = ref<ChatSession[]>([])
const loading = ref(false)
const sending = ref(false)
const error = ref('')
const quota = ref<ChatQuota | null>(null)
const provider = ref('')
const model = ref('')
const maxMessageLength = ref(4000)
const maxSessions = ref(50)

export function useChat() {
  const hasMessages = computed(() => messages.value.length > 0)
  const canSend = computed(() => !sending.value)

  const loadingSessions = ref(false)
  const loadingQuota = ref(false)

  async function loadSessions(): Promise<void> {
    if (loadingSessions.value) return
    loadingSessions.value = true
    try {
      const res = await aiChatApi.getSessions()
      sessions.value = res.sessions
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useChat] Failed to load sessions:', err)
    } finally {
      loadingSessions.value = false
    }
  }

  async function loadQuota(): Promise<void> {
    if (loadingQuota.value) return
    loadingQuota.value = true
    try {
      const res = await aiChatApi.getQuota()
      quota.value = res.quota
      if (res.provider) provider.value = res.provider
      if (res.model) model.value = res.model
      if (res.maxMessageLength) maxMessageLength.value = res.maxMessageLength
      if (res.maxSessions) maxSessions.value = res.maxSessions
    } catch (err) {
      if (import.meta.env.DEV) console.error('[useChat] Failed to load quota:', err)
    } finally {
      loadingQuota.value = false
    }
  }

  async function loadMessages(sid: string): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const res = await aiChatApi.getMessages(sid)
      messages.value = res.messages
    } catch (err) {
      error.value = getChatErrorMessage(err)
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(content: string): Promise<void> {
    const trimmed = content.trim()
    if (!trimmed || sending.value) return

    sending.value = true
    error.value = ''

    const seed = Date.now()
    const localUserId = `local-user-${seed}`
    const localAssistantId = `local-assistant-${seed}`

    messages.value.push({
      id: localUserId,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString()
    })

    messages.value.push({
      id: localAssistantId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString()
    })

    try {
      const res = await aiChatApi.sendMessageStream(trimmed, sessionId.value ?? undefined, {
        onMeta(payload) {
          if (payload.sessionId) sessionId.value = payload.sessionId
          if (payload.provider) provider.value = payload.provider
          if (payload.model) model.value = payload.model
          if (payload.quota) quota.value = payload.quota

          if (payload.userMessage) {
            const userMsg = messages.value.find((item) => item.id === localUserId)
            if (userMsg) {
              userMsg.created_at = payload.userMessage.created_at
            }
          }
        },
        onDelta(text) {
          const assistantMsg = messages.value.find((item) => item.id === localAssistantId)
          if (assistantMsg) {
            assistantMsg.content += text
          }
        }
      })

      sessionId.value = res.sessionId
      provider.value = res.provider
      model.value = res.model
      quota.value = res.quota

      const userMsg = messages.value.find((item) => item.id === localUserId)
      if (userMsg) {
        userMsg.id = res.userMessage.id
        userMsg.content = res.userMessage.content
        userMsg.created_at = res.userMessage.created_at
      }

      const assistantMsg = messages.value.find((item) => item.id === localAssistantId)
      if (assistantMsg) {
        assistantMsg.id = res.message.id
        assistantMsg.content = res.message.content
        assistantMsg.created_at = res.message.created_at
      }
    } catch (err) {
      messages.value = messages.value.filter((item) => item.id !== localUserId && item.id !== localAssistantId)
      error.value = getChatErrorMessage(err)
    } finally {
      sending.value = false
    }
  }

  function toggleOpen(): void {
    open.value = !open.value
    if (open.value) {
      void loadSessions()
      void loadQuota()
    }
  }

  function close(): void {
    open.value = false
  }

  async function selectSession(sid: string): Promise<void> {
    sessionId.value = sid
    await loadMessages(sid)
  }

  async function newChat(): Promise<void> {
    sessionId.value = null
    messages.value = []
    error.value = ''
    provider.value = ''
    model.value = ''
  }

  async function deleteSession(sid: string): Promise<void> {
    const oldSessions = sessions.value
    const wasCurrent = sessionId.value === sid

    sessions.value = sessions.value.filter((item) => item.id !== sid)
    if (wasCurrent) {
      sessionId.value = null
      messages.value = []
      provider.value = ''
      model.value = ''
    }

    try {
      await aiChatApi.deleteSession(sid)
    } catch (err) {
      sessions.value = oldSessions
      if (wasCurrent) {
        sessionId.value = sid
      }
      error.value = getChatErrorMessage(err)
    }
  }

  return {
    open,
    sessionId,
    messages,
    sessions,
    loading,
    sending,
    error,
    quota,
    provider,
    model,
    maxMessageLength,
    maxSessions,
    hasMessages,
    canSend,
    toggleOpen,
    close,
    sendMessage,
    selectSession,
    newChat,
    deleteSession,
    loadSessions,
    loadQuota
  }
}
