<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { submitFeedback, type FeedbackRequest } from '@/api/feedback'
import { ApiError } from '@/api/http'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const props = withDefaults(
  defineProps<{
    source?: FeedbackRequest['source']
  }>(),
  { source: 'workbench' }
)

const open = ref(false)
const category = ref<FeedbackRequest['category']>('feature')
const content = ref('')
const contact = ref('')
const loading = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })

const MAX_LENGTH = 1200
const charCount = computed(() => content.value.length)
const isOverLimit = computed(() => charCount.value > MAX_LENGTH)
const canSubmit = computed(() => content.value.trim().length >= 6 && !isOverLimit.value)

const categoryOptions: { label: string; value: FeedbackRequest['category'] }[] = [
  { label: '新功能建议', value: 'feature' },
  { label: '体验优化', value: 'ux' },
  { label: 'Bug 反馈', value: 'bug' },
  { label: '其他', value: 'other' }
]

watch(open, (isOpen) => {
  document.body.classList.toggle('feedback-open', isOpen)
})

onUnmounted(() => {
  document.body.classList.remove('feedback-open')
})

function getFeedbackErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return mapErrorCodeToMessage('unauthorized')
    if (error.status === 400 || error.code === 'invalid_payload') {
      return mapErrorCodeToMessage('feedback_invalid_payload')
    }
    if (error.status === 429 || error.code === 'rate_limited') {
      return mapErrorCodeToMessage('rate_limited')
    }
    if (error.status >= 500) return mapErrorCodeToMessage('feedback_service_unavailable')
    return error.message
  }
  if (error instanceof TypeError) return mapErrorCodeToMessage('feedback_network_failed')
  return mapErrorCodeToMessage('feedback_submit_failed')
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await submitFeedback({
      category: category.value,
      content: contact.value
        ? content.value.trim() + '\n\n联系方式：' + contact.value.trim()
        : content.value.trim(),
      source: props.source
    })
    content.value = ''
    contact.value = ''
    status.value = { type: 'success', text: mapErrorCodeToMessage('feedback_success') }
  } catch (error) {
    console.error('[SQLDev] Feedback submit failed', error)
    status.value = { type: 'error', text: getFeedbackErrorMessage(error) }
  } finally {
    loading.value = false
  }
}

function closeFeedback(): void {
  open.value = false
}
</script>

<template>
  <aside>
    <!-- FAB -->
    <button
      class="feedback-fab"
      :aria-expanded="open"
      aria-label="打开建议反馈面板"
      @click="open = !open"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect
          x="1.5"
          y="2.5"
          width="13"
          height="11"
          rx="1.5"
          stroke="currentColor"
          stroke-width="1.4"
        />
        <path d="M5 8h6M8 5v6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
      </svg>
      <span>反馈</span>
    </button>

    <!-- Overlay -->
    <Transition name="feedback-fade">
      <div
        v-if="open"
        class="feedback-overlay"
        role="presentation"
        @click.self="closeFeedback"
        @keydown.esc="closeFeedback"
      >
        <section
          class="feedback-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
        >
          <!-- Header -->
          <div class="feedback-modal-head">
            <h3 id="feedback-title">产品建议</h3>
            <button class="feedback-close" type="button" aria-label="关闭" @click="closeFeedback">
              <svg
                width="18"
                height="18"
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
          </div>
          <p class="feedback-modal-desc">告诉我们你希望改进的功能、体验或问题，我们会持续优化。</p>

          <!-- Category -->
          <label class="feedback-label" for="feedback-category">建议类型</label>
          <select id="feedback-category" v-model="category" class="feedback-select">
            <option v-for="opt in categoryOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <!-- Content -->
          <label class="feedback-label" for="feedback-content">建议内容</label>
          <textarea
            id="feedback-content"
            v-model="content"
            class="feedback-textarea"
            placeholder="例如：希望增加批量翻译、结果差异对比、规则模板共享..."
          ></textarea>
          <div class="feedback-meta-row">
            <span class="feedback-hint">请尽量描述场景和期望结果，便于我们快速落地。</span>
            <span class="feedback-count" :class="{ over: isOverLimit }"
              >{{ charCount }}/{{ MAX_LENGTH }}</span
            >
          </div>

          <!-- Contact -->
          <label class="feedback-label" for="feedback-contact">联系方式（选填）</label>
          <input
            id="feedback-contact"
            v-model="contact"
            class="feedback-input"
            placeholder="邮箱 / 微信 / 其他联系方式"
          />

          <!-- Status -->
          <p
            v-if="status.text"
            class="feedback-status"
            :class="{ success: status.type === 'success', error: status.type === 'error' }"
          >
            {{ status.text }}
          </p>

          <!-- Actions -->
          <div class="feedback-actions">
            <button class="feedback-btn" type="button" @click="closeFeedback">取消</button>
            <button
              class="feedback-btn primary"
              type="button"
              :disabled="!canSubmit || loading"
              @click="handleSubmit"
            >
              {{ loading ? '提交中...' : '提交建议' }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </aside>
</template>

<style>
/* ── FAB ── */
.feedback-fab {
  position: fixed;
  right: 0;
  top: 50%;
  z-index: 130;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 30px;
  padding: 9px 5px;
  border: none;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: var(--color-panel);
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    box-shadow var(--duration-normal) var(--ease-apple),
    background var(--duration-normal) var(--ease-apple);
}
.feedback-fab svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--color-danger);
  transition: color var(--duration-normal) var(--ease-apple);
}
.feedback-fab span {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  color: var(--color-danger);
  font-family: var(--font-body);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: 0.15em;
  transition: color var(--duration-normal) var(--ease-apple);
}
.feedback-fab:hover {
  box-shadow:
    0 4px 18px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.06);
  background: var(--color-panel-2);
}
body.feedback-open .feedback-fab {
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  background: var(--color-panel-2);
}
.feedback-fab:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus-ring);
}

body.feedback-open {
  overflow: hidden;
}

/* ── Overlay ── */
.feedback-overlay {
  position: fixed;
  inset: 0;
  z-index: 10030;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
}

/* ── Modal ── */
.feedback-modal {
  width: min(480px, 96vw);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-panel);
  box-shadow: var(--shadow-xl);
  padding: 28px 28px 24px;
  max-height: 90vh;
  overflow-y: auto;
}

.feedback-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.feedback-modal-head h3 {
  margin: 0;
  color: var(--color-text);
  font-size: var(--text-xl);
  font-weight: 700;
}

.feedback-close {
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
.feedback-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.feedback-modal-desc {
  margin: 0 0 18px;
  color: var(--color-text-subtle);
  font-size: var(--text-base);
}

/* ── Form ── */
.feedback-label {
  display: block;
  margin: 14px 0 6px;
  color: var(--color-text);
  font-size: var(--text-base);
  font-weight: 600;
}
.feedback-label:first-of-type {
  margin-top: 0;
}

.feedback-select,
.feedback-input,
.feedback-textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel);
  color: var(--color-text);
  padding: 9px 12px;
  font: 500 var(--text-base)/1.5 var(--font-body, sans-serif);
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}
.feedback-select {
  height: 40px;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5l5 5 5-5' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  cursor: pointer;
}
.feedback-input {
  height: 40px;
}

.feedback-textarea {
  height: 160px;
  resize: vertical;
  min-height: 120px;
}
.feedback-select::placeholder,
.feedback-input::placeholder,
.feedback-textarea::placeholder {
  color: var(--color-text-muted);
}
.feedback-select:focus,
.feedback-input:focus,
.feedback-textarea:focus {
  border-color: var(--color-accent);
  outline: none;
  box-shadow: var(--shadow-focus-ring);
}

/* ── Meta row ── */
.feedback-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 6px;
}
.feedback-hint {
  color: var(--color-accent);
  font-size: var(--text-xs);
}
.feedback-count {
  color: var(--color-text-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.feedback-count.over {
  color: var(--color-danger);
}

/* ── Status ── */
.feedback-status {
  min-height: 18px;
  margin: 10px 0 0;
  color: var(--color-text-subtle);
  font-size: var(--text-sm);
}
.feedback-status.error {
  color: var(--color-danger-text);
}
.feedback-status.success {
  color: var(--color-success);
}

/* ── Actions ── */
.feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}
.feedback-btn {
  padding: 8px 24px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-panel);
  color: var(--color-text);
  font: 600 var(--text-base) var(--font-body, sans-serif);
  cursor: pointer;
  transition:
    background var(--duration-fast),
    border-color var(--duration-fast);
}
.feedback-btn:hover {
  background: var(--color-panel-2);
}
.feedback-btn.primary {
  border-color: var(--color-text);
  font-weight: 600;
}
.feedback-btn.primary:hover {
  background: var(--color-panel-2);
}
.feedback-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ── Transition ── */
.feedback-fade-enter-active,
.feedback-fade-leave-active {
  transition: opacity var(--duration-normal) var(--ease-apple);
}
.feedback-fade-enter-from,
.feedback-fade-leave-to {
  opacity: 0;
}

/* ── Scrollbar ── */
.feedback-modal::-webkit-scrollbar {
  width: 5px;
}
.feedback-modal::-webkit-scrollbar-track {
  background: transparent;
}
.feedback-modal::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--scrollbar-radius);
}

/* ── Mobile ── */
@media (max-width: 480px) {
  .feedback-modal {
    padding: 20px 16px;
  }
  .feedback-fab {
    width: 32px;
    padding: 8px 4px;
  }
}
</style>
