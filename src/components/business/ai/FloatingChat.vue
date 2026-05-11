<script setup lang="ts">
import { computed, nextTick, ref, watch, onUnmounted } from 'vue'
import { useChat } from '@/composables/useChat'
import { useConfirm } from '@/composables/useConfirm'

const { confirm } = useConfirm()

const {
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
  hasMessages,
  canSend,
  toggleOpen,
  close,
  sendMessage,
  selectSession,
  newChat,
  deleteSession
} = useChat()

const inputText = ref('')
const messagesEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLTextAreaElement | null>(null)
const showHistory = ref(false)

const quickPrompts = [
  { label: '查询用户活跃度', text: '帮我写一个查询用户活跃度的 SQL' },
  { label: '解释执行计划', text: '解释一下 EXPLAIN 的输出各字段含义' },
  { label: '优化慢查询', text: '如何定位和优化慢查询？' },
  { label: '设计索引策略', text: '为一个订单表设计合理的索引策略' }
]

const quotaText = computed(() => {
  if (!quota.value) return ''
  const remain = quota.value.remaining
  const limit = quota.value.limit
  return `今日剩余 ${remain}/${limit} 次`
})

function providerLabel(): string {
  if (provider.value && model.value) {
    return `${provider.value} / ${model.value}`
  }
  return ''
}

function onEscKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    close()
  }
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', onEscKeydown)
    nextTick(() => {
      inputEl.value?.focus()
    })
  } else {
    document.removeEventListener('keydown', onEscKeydown)
    showHistory.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onEscKeydown)
})

watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight
      }
    })
  }
)

function autoResize(): void {
  const el = inputEl.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

async function handleSend(): Promise<void> {
  const text = inputText.value.trim()
  if (!text || !canSend.value) return
  inputText.value = ''
  autoResize()
  error.value = ''
  await sendMessage(text)
  if (error.value) {
    inputText.value = text
    autoResize()
  }
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleQuickPrompt(text: string): void {
  inputText.value = text
  handleSend()
}

async function handleSelectSession(sid: string): Promise<void> {
  await selectSession(sid)
  showHistory.value = false
}

async function handleNewChat(): Promise<void> {
  await newChat()
  showHistory.value = false
  nextTick(() => inputEl.value?.focus())
}

async function handleDeleteSession(sid: string): Promise<void> {
  const ok = await confirm('确定删除该对话？', {
    title: '删除会话',
    confirmText: '删除',
    confirmClass: 'danger'
  })
  if (!ok) return
  await deleteSession(sid)
}

function formatTime(iso: string): string {
  if (!iso) return '--'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '--'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function onMaskClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) close()
}
</script>

<template>
  <aside class="ai-chat-root">
    <!-- Floating Action Button -->
    <button
      class="chat-fab"
      :class="{ active: open }"
      :aria-expanded="open"
      aria-label="AI 小助手"
      @click="toggleOpen"
    >
      <svg
        v-if="!open"
        class="fab-icon-magic"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 19L15 9" />
        <path d="M14 4.5l.6 1.9L16.5 7l-1.9.6L14 9.5l-.6-1.9L11.5 7l1.9-.6z" fill="rgba(253,224,71,0.85)" stroke="none" />
        <circle cx="18" cy="4" r="0.8" fill="currentColor" stroke="none" opacity="0.5" />
        <circle cx="10" cy="3" r="0.6" fill="currentColor" stroke="none" opacity="0.35" />
        <circle cx="19" cy="9" r="0.5" fill="currentColor" stroke="none" opacity="0.3" />
      </svg>
      <svg
        v-else
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>

    <!-- Overlay -->
    <Transition name="chat-fade">
      <div
        v-if="open"
        class="chat-overlay"
        role="presentation"
        @click="onMaskClick"
      >
        <div class="chat-panel" role="dialog" aria-modal="true" aria-label="AI 小助手" @click.stop>
          <!-- Header -->
          <div class="chat-header">
            <div class="chat-header-left">
              <div class="chat-avatar" aria-hidden="true">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path
                    d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                  />
                </svg>
              </div>
              <div class="chat-header-info">
                <span class="chat-title">Dev Studio AI 助手</span>
                <span class="chat-subtitle">
                  <span v-if="providerLabel()">{{ providerLabel() }}</span>
                  <span v-else> <span class="status-dot"></span>在线 </span>
                  <template v-if="quotaText"> · {{ quotaText }}</template>
                </span>
              </div>
            </div>
            <div class="chat-header-actions">
              <button
                class="chat-header-btn"
                :class="{ active: showHistory }"
                title="历史对话"
                @click="showHistory = !showHistory"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                </svg>
              </button>
              <button class="chat-header-btn" title="新对话" @click="handleNewChat">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
              <button class="chat-header-btn" title="关闭" @click="close">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Body: History sidebar + Messages -->
          <div class="chat-body">
            <!-- Session history sidebar -->
            <Transition name="chat-slide">
              <div v-if="showHistory" class="chat-history">
                <div class="chat-history-title">历史对话</div>
                <div v-if="sessions.length === 0" class="chat-history-empty">暂无历史对话</div>
                <div v-else class="chat-history-list">
                  <button
                    v-for="s in sessions"
                    :key="s.id"
                    class="chat-history-item"
                    :class="{ active: s.id === sessionId }"
                    @click="handleSelectSession(s.id)"
                  >
                    <span class="chat-history-item-text">{{ s.title || '新对话' }}</span>
                    <button
                      class="chat-history-delete"
                      title="删除"
                      @click.stop="handleDeleteSession(s.id)"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </button>
                </div>
              </div>
            </Transition>

            <!-- Messages area -->
            <div ref="messagesEl" class="chat-messages" role="log" aria-live="polite">
              <!-- Loading -->
              <div v-if="loading" class="chat-status">
                <span class="chat-spinner"></span>
                加载中...
              </div>

              <!-- Welcome: only when idle, no sending -->
              <div v-else-if="!hasMessages && !sending" class="chat-welcome">
                <div class="chat-welcome-icon" aria-hidden="true">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 1 1 7.072 0l-.548.547A3.374 3.374 0 0 0 14 18.469V19a2 2 0 1 1-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h4 class="chat-welcome-title">你好，我是 Dev Studio AI 助手</h4>
                <p class="chat-welcome-desc">
                  我可以帮你写 SQL、解释执行计划、优化查询、<br />排查数据库问题，或者聊聊数据库设计。
                </p>
                <div class="chat-quick-prompts">
                  <button
                    v-for="qp in quickPrompts"
                    :key="qp.label"
                    class="chat-quick-pill"
                    @click="handleQuickPrompt(qp.text)"
                  >
                    {{ qp.label }}
                  </button>
                </div>
              </div>

              <!-- Messages / sending / error -->
              <template v-else>
                <div v-if="!hasMessages && sending" class="chat-status">
                  <span class="chat-spinner"></span>
                  AI 正在思考...
                </div>
                <div v-for="msg in messages" :key="msg.id" class="chat-msg" :class="msg.role">
                  <div class="chat-msg-avatar" aria-hidden="true">
                    <template v-if="msg.role === 'assistant'">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <path
                          d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        />
                      </svg>
                    </template>
                    <template v-else>
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </template>
                  </div>
                  <div class="chat-msg-body">
                    <div class="chat-msg-bubble" v-text="msg.content"></div>
                    <div class="chat-msg-time">{{ formatTime(msg.created_at) }}</div>
                  </div>
                </div>

                <!-- Error -->
                <div v-if="error" class="chat-error">{{ error }}</div>

                <!-- Typing indicator (subsequent messages only; first message uses spinner above) -->
                <div v-if="sending && hasMessages" class="chat-typing">
                  <span></span><span></span><span></span>
                </div>
              </template>
            </div>
          </div>

          <!-- Input -->
          <div class="chat-input-area">
            <div class="chat-input-wrap">
              <textarea
                ref="inputEl"
                v-model="inputText"
                class="chat-input"
                rows="1"
                placeholder="输入你的问题..."
                :maxlength="maxMessageLength"
                :disabled="sending"
                @keydown="handleKeydown"
                @input="autoResize"
              ></textarea>
            </div>
            <button
              class="chat-send-btn"
              :disabled="!inputText.trim() || sending"
              aria-label="发送"
              @click="handleSend"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
          <p v-if="quotaText" class="chat-footer-text">{{ quotaText }}</p>
        </div>
      </div>
    </Transition>
  </aside>
</template>

<style>
/* ── FAB ── */
.ai-chat-root {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 10000;
}

.chat-fab {
  position: relative;
  width: 52px;
  height: 52px;
  border-radius: var(--radius-pill);
  border: 1.5px solid rgba(var(--color-chat-accent-rgb),0.32);
  background: rgba(var(--color-chat-accent-rgb),0.14);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: var(--color-chat-accent-light);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 8px 32px rgba(var(--color-chat-accent-rgb),0.22),
    0 2px 8px rgba(var(--color-chat-accent-rgb),0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition:
    transform var(--duration-normal) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-apple),
    border-color var(--duration-normal) var(--ease-apple),
    background var(--duration-normal) var(--ease-apple);
}
.chat-fab:hover {
  transform: scale(1.1);
  border-color: rgba(var(--color-chat-accent-rgb),0.55);
  background: rgba(var(--color-chat-accent-rgb),0.2);
  box-shadow:
    0 12px 40px rgba(var(--color-chat-accent-rgb),0.32),
    0 0 0 8px rgba(var(--color-chat-accent-rgb),0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
.chat-fab:active {
  transform: scale(0.96);
}
.chat-fab.active {
  background: var(--color-panel);
  color: var(--color-text);
  border-color: var(--color-border);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: var(--shadow-lg);
}
.chat-fab.active:hover {
  color: var(--color-text);
  box-shadow: var(--shadow-xl);
}

.fab-icon-magic {
  filter: drop-shadow(0 0 6px rgba(var(--color-chat-glow-rgb),0.5));
  transition: filter var(--duration-normal) var(--ease-apple);
}
.chat-fab:hover .fab-icon-magic {
  filter: drop-shadow(0 0 10px rgba(var(--color-chat-glow-rgb),0.7));
}

/* ── Light theme FAB ── */
[data-theme='light'] .chat-fab {
  border-color: rgba(var(--color-chat-accent-rgb),0.25);
  background: rgba(var(--color-chat-accent-rgb),0.1);
  color: var(--color-chat-accent);
  box-shadow:
    0 6px 24px rgba(var(--color-chat-accent-rgb),0.15),
    0 1px 4px rgba(var(--color-chat-accent-rgb),0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}
[data-theme='light'] .chat-fab:hover {
  border-color: rgba(var(--color-chat-accent-rgb),0.4);
  background: rgba(var(--color-chat-accent-rgb),0.15);
  box-shadow:
    0 10px 32px rgba(var(--color-chat-accent-rgb),0.22),
    0 0 0 8px rgba(var(--color-chat-accent-rgb),0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
[data-theme='light'] .chat-fab.active {
  border-color: var(--color-border);
  box-shadow: var(--shadow-lg);
}
[data-theme='light'] .fab-icon-magic {
  filter: drop-shadow(0 0 5px rgba(var(--color-chat-accent-rgb),0.35));
}
[data-theme='light'] .chat-fab:hover .fab-icon-magic {
  filter: drop-shadow(0 0 8px rgba(var(--color-chat-accent-rgb),0.5));
}

/* ── Overlay ── */
.chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 10030;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 20px 24px;
}

/* ── Panel ── */
.chat-panel {
  width: min(420px, 94vw);
  height: min(580px, 72vh);
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-panel);
  box-shadow:
    var(--shadow-xl),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  overflow: hidden;
}

/* ── Header ── */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--color-page-border-subtle);
  flex-shrink: 0;
}
.chat-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.chat-avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--color-chat-gradient-start), var(--color-chat-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
}
.chat-header-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.chat-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-text);
}
.chat-subtitle {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 5px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  flex-shrink: 0;
}
.chat-header-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.chat-header-btn {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background var(--duration-fast),
    color var(--duration-fast);
}
.chat-header-btn:hover,
.chat-header-btn.active {
  background: var(--color-accent-bg);
  color: var(--color-text);
}

/* ── Body ── */
.chat-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* ── History sidebar ── */
.chat-history {
  width: 140px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-page-border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.chat-history-title {
  padding: 10px 12px 6px;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}
.chat-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}
.chat-history-empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}
.chat-history-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-subtle);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background var(--duration-fast);
  text-align: left;
}
.chat-history-item:hover {
  background: var(--color-panel-2);
}
.chat-history-item.active {
  background: var(--color-accent-bg);
  color: var(--color-accent);
}
.chat-history-item-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}
.chat-history-delete {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: var(--radius-xs);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0;
  transition:
    opacity var(--duration-fast),
    color var(--duration-fast);
}
.chat-history-item:hover .chat-history-delete {
  opacity: 1;
}
.chat-history-delete:hover {
  color: var(--color-danger);
}

/* ── Messages ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}
.chat-messages::-webkit-scrollbar {
  width: 5px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--scrollbar-radius);
}

/* Welcome */
.chat-welcome {
  text-align: center;
  padding: 28px 8px;
}
.chat-welcome-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-chat-gradient-start), var(--color-chat-accent));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  color: var(--color-btn-primary-text);
}
.chat-welcome-title {
  color: var(--color-text);
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 4px;
}
.chat-welcome-desc {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  line-height: 1.6;
  margin: 0;
}
.chat-quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin-top: 14px;
}
.chat-quick-pill {
  padding: 5px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
  font-size: var(--text-xs);
  cursor: pointer;
  transition:
    background var(--duration-fast),
    border-color var(--duration-fast),
    color var(--duration-fast);
  white-space: nowrap;
}
.chat-quick-pill:hover {
  border-color: var(--color-accent-border);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

/* Message bubbles */
.chat-msg {
  display: flex;
  gap: 8px;
  max-width: 88%;
  animation: chatMsgIn var(--duration-normal) var(--ease-out);
}
@keyframes chatMsgIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.chat-msg.assistant {
  align-self: flex-start;
}
.chat-msg.user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.chat-msg-avatar {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-msg.assistant .chat-msg-avatar {
  background: linear-gradient(135deg, var(--color-chat-gradient-start), var(--color-chat-accent));
  color: var(--color-btn-primary-text);
}
.chat-msg.user .chat-msg-avatar {
  background: var(--color-panel-3);
  color: var(--color-text-muted);
}

.chat-msg-bubble {
  padding: 9px 13px;
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}
.chat-msg.assistant .chat-msg-bubble {
  background: var(--color-panel-2);
  color: var(--color-text);
  border-bottom-left-radius: var(--radius-sm);
}
.chat-msg.user .chat-msg-bubble {
  background: linear-gradient(135deg, var(--color-chat-gradient-start), var(--color-chat-accent));
  color: var(--color-btn-primary-text);
  border-bottom-right-radius: var(--radius-sm);
}
.chat-msg-time {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
  padding: 0 4px;
}
.chat-msg.user .chat-msg-time {
  text-align: right;
}

/* Status & Error */
.chat-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  padding: 20px;
}
.chat-error {
  color: var(--color-danger-text);
  font-size: var(--text-sm);
  text-align: center;
  padding: 8px;
}

/* Spinner */
.chat-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: chatSpin 0.6s linear infinite;
}
@keyframes chatSpin {
  to {
    transform: rotate(360deg);
  }
}

/* Typing */
.chat-typing {
  align-self: flex-start;
  display: flex;
  gap: 5px;
  padding: 10px 13px;
  margin-left: 34px;
}
.chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
  animation: chatDotBounce 1.4s infinite var(--ease-apple);
}
.chat-typing span:nth-child(2) {
  animation-delay: 0.16s;
}
.chat-typing span:nth-child(3) {
  animation-delay: 0.32s;
}
@keyframes chatDotBounce {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-4px);
  }
}

/* ── Input ── */
.chat-input-area {
  padding: 10px 14px;
  border-top: 1px solid var(--color-page-border-subtle);
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}
.chat-input-wrap {
  flex: 1;
  display: flex;
  align-items: flex-end;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 6px 8px;
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}
.chat-input-wrap:focus-within {
  border-color: var(--color-accent-border);
}
.chat-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text);
  font: 13px/1.5 var(--font-body);
  resize: none;
  outline: none;
  min-height: 22px;
  max-height: 120px;
  padding: 2px 4px;
}
.chat-input:focus,
.chat-input:focus-visible {
  outline: none;
  box-shadow: none;
}
.chat-input::placeholder {
  color: var(--color-text-muted);
}
.chat-input:disabled {
  opacity: 0.5;
}

.chat-send-btn {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-chat-gradient-start), var(--color-chat-accent));
  color: var(--color-btn-primary-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition:
    transform var(--duration-fast),
    box-shadow var(--duration-fast),
    opacity var(--duration-fast);
}
.chat-send-btn:hover {
  transform: scale(1.07);
  box-shadow: 0 4px 14px rgba(var(--color-chat-gradient-start-rgb), 0.36);
}
.chat-send-btn:active {
  transform: scale(0.94);
}
.chat-send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* ── Footer ── */
.chat-footer-text {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  text-align: center;
  padding: 0 14px 8px;
  margin: 0;
}

/* ── Transitions ── */
.chat-fade-enter-active,
.chat-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-apple);
}
.chat-fade-enter-from,
.chat-fade-leave-to {
  opacity: 0;
}

.chat-slide-enter-active,
.chat-slide-leave-active {
  transition:
    width var(--duration-normal) var(--ease-apple),
    opacity var(--duration-normal) var(--ease-apple);
}
.chat-slide-enter-from,
.chat-slide-leave-to {
  width: 0;
  opacity: 0;
}

/* ── Mobile ── */
@media (max-width: 480px) {
  .chat-overlay {
    padding: 0;
    align-items: stretch;
  }
  .chat-panel {
    width: 100vw;
    height: 100dvh;
    max-height: none;
    border-radius: 0;
  }
  .chat-fab {
    right: 16px;
    bottom: 16px;
    width: 46px;
    height: 46px;
  }
  .chat-fab svg {
    width: 20px;
    height: 20px;
  }
  .chat-history {
    width: 120px;
  }
}
</style>
