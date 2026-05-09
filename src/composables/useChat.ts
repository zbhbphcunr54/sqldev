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

// Module-level reactive state — singleton shared across all component instances
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

export function useChat() {
  const hasMessages = computed(() => messages.value.length > 0)
  const canSend = computed(() => !sending.value)

  function getErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      return err.message
    }
    if (err instanceof TypeError) {
      return mapErrorCodeToMessage('network_error')
    }
    return mapErrorCodeToMessage('unknown_error')
  }

  let loadingSessions = false
  let loadingQuota = false

  async function loadSessions(): Promise<void> {
    if (loadingSessions) return
    loadingSessions = true
    try {
      const res = await aiChatApi.getSessions()
      sessions.value = res.sessions
    } catch {
      // 静默失败，不影响聊天功能
    } finally {
      loadingSessions = false
    }
  }

  async function loadQuota(): Promise<void> {
    if (loadingQuota) return
    loadingQuota = true
    try {
      const res = await aiChatApi.getQuota()
      console.log('[useChat] loadQuota response:', res)
      quota.value = res.quota
      if (res.provider) provider.value = res.provider
      if (res.model) model.value = res.model
      console.log('[useChat] quota set to:', quota.value)
    } catch (err) {
      console.error('[useChat] loadQuota failed:', err)
    } finally {
      loadingQuota = false
    }
  }

  async function loadMessages(sid: string): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const res = await aiChatApi.getMessages(sid)
      messages.value = res.messages
    } catch (err) {
      error.value = getErrorMessage(err)
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
      error.value = getErrorMessage(err)
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
      error.value = getErrorMessage(err)
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
