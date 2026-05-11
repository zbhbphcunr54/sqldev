import { ref, computed } from 'vue'
import { aiChatApi, type ChatMessage, type ChatSession, type ChatQuota } from '@/api/ai-chat'
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
    return err.message
  }
  if (err instanceof TypeError) {
    return mapErrorCodeToMessage('network_error')
  }
  return mapErrorCodeToMessage('unknown_error')
}

// Module-level reactive state — singleton shared across all component instances.
// Kept as composable (not Pinia store) because AI chat UI has DOM coupling
// (scroll-to-bottom, auto-resize) that doesn't fit Pinia's SSR/decoupled model.
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
      if (import.meta.env.DEV) console.error('[useChat] loadQuota failed:', err)
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
    if (!content.trim() || sending.value) return
    sending.value = true
    error.value = ''

    // 立即展示用户消息
    messages.value.push({
      id: 'local-' + Date.now(),
      role: 'user',
      content: content.trim(),
      created_at: new Date().toISOString()
    })

    try {
      const res = await aiChatApi.sendMessage(content.trim(), sessionId.value ?? undefined)
      if (!sessionId.value) {
        sessionId.value = res.sessionId
      }
      // 用服务端返回的 ID 替换本地临时 ID
      const localMsg = messages.value.find((m) => m.id.startsWith('local-'))
      if (localMsg) localMsg.id = res.userMessage.id
      messages.value.push(res.message)
      provider.value = res.provider
      model.value = res.model
      quota.value = res.quota
    } catch (err) {
      // 失败时移除本地消息
      messages.value = messages.value.filter((m) => !m.id.startsWith('local-'))
      error.value = getChatErrorMessage(err)
    } finally {
      sending.value = false
    }
  }

  function toggleOpen(): void {
    open.value = !open.value
    if (open.value) {
      loadSessions()
      loadQuota()
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
    try {
      await aiChatApi.deleteSession(sid)
      sessions.value = sessions.value.filter((s) => s.id !== sid)
      if (sessionId.value === sid) {
        sessionId.value = null
        messages.value = []
        provider.value = ''
        model.value = ''
      }
    } catch (err) {
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
