<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { submitFeedback, type FeedbackRequest } from '@/api/feedback'
import { ApiError } from '@/api/http'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import FormSelect from '@/components/common/FormSelect.vue'

const SUCCESS_MESSAGES: Record<string, string> = {
  feedback_success: '建议已提交，感谢你的反馈。'
}

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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

watch(open, (isOpen) => {
  document.body.classList.toggle('feedback-open', isOpen)
  if (isOpen) {
    status.value = { type: 'idle', text: '' }
    // 预热 Edge Function，用户填表单期间完成冷启动
    if (supabaseUrl) {
      // Warm Edge Function to overlap user typing with cold start
      fetch(`${supabaseUrl}/functions/v1/feedback`, { method: 'OPTIONS' }).catch(() => {
        // Warmup failure is non-critical — user may still submit successfully
      })
    }
  }
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
    status.value = { type: 'success', text: SUCCESS_MESSAGES.feedback_success }
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
      :class="{ 'feedback-fab--active': open }"
      :aria-expanded="open"
      aria-label="打开建议反馈面板"
      @click="open = !open"
    >
      <span class="feedback-fab__glow"></span>
      <span class="feedback-fab__inner">
        <svg
          class="feedback-fab__icon"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="feedback-fab__text">反馈</span>
      </span>
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
          <label class="feedback-label">建议类型</label>
          <FormSelect v-model="category" :options="categoryOptions" placeholder="选择建议类型" />

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
            role="alert"
            aria-live="assertive"
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
  left: 0;
  top: 65%;
  z-index: 130;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  padding: 0;
  border: none;
  border-radius: 0 6px 6px 0;
  background: transparent;
  cursor: pointer;
  transform: translateY(-50%);
  overflow: visible;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.feedback-fab:hover {
  transform: translateY(-50%) translateX(2px);
}
.feedback-fab__glow {
  position: absolute;
  inset: -3px;
  border-radius: 0 8px 8px 0;
  background: linear-gradient(135deg, var(--color-brand-500), var(--color-purple));
  opacity: 0;
  filter: blur(8px);
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.feedback-fab:hover .feedback-fab__glow {
  opacity: 0.45;
}
.feedback-fab__inner {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 38px;
  padding: 12px 7px;
  border-radius: 0 6px 6px 0;
  background: linear-gradient(160deg, var(--color-brand-600), var(--color-brand-500));
  box-shadow:
    0 4px 16px rgba(0, 113, 227, 0.25),
    0 1px 3px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  transition:
    box-shadow 0.3s ease,
    background 0.3s ease;
}
.feedback-fab:hover .feedback-fab__inner {
  box-shadow:
    0 8px 28px rgba(0, 113, 227, 0.35),
    0 2px 6px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  background: linear-gradient(160deg, var(--color-accent-hover), var(--color-brand-500));
}
.feedback-fab__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #fff;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.feedback-fab:hover .feedback-fab__icon {
  transform: scale(1.1);
}
.feedback-fab__text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  color: #fff;
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.feedback-fab--active .feedback-fab__inner {
  background: linear-gradient(160deg, var(--color-brand-700), var(--color-brand-600));
}
.feedback-fab:focus-visible {
  outline: none;
}
.feedback-fab:focus-visible .feedback-fab__inner {
  box-shadow:
    0 0 0 3px rgba(0, 113, 227, 0.3),
    0 4px 16px rgba(0, 113, 227, 0.25);
}

/* ── Dark theme adjustments ── */
[data-theme='dark'] .feedback-fab__inner {
  box-shadow:
    0 4px 16px rgba(0, 113, 227, 0.35),
    0 1px 3px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
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
  box-shadow:
    0 24px 80px rgba(0, 0, 0, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.08),
    0 0 0 1px rgba(0, 0, 0, 0.04);
  padding: 28px 28px 24px;
  max-height: 90vh;
  overflow-y: auto;
  animation: feedback-modal-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes feedback-modal-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
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

.feedback-input,
.feedback-textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-panel-2);
  color: var(--color-text);
  padding: 9px 12px;
  font: 500 var(--text-base)/1.5 var(--font-body, sans-serif);
  transition:
    border-color var(--duration-fast),
    box-shadow var(--duration-fast);
}
.feedback-input {
  height: 40px;
}

.feedback-textarea {
  height: 160px;
  resize: vertical;
  min-height: 120px;
}
.feedback-input::placeholder,
.feedback-textarea::placeholder {
  color: var(--color-text-muted);
}
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
  padding: 9px 22px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-panel);
  color: var(--color-text);
  font: 600 var(--text-base) var(--font-body, sans-serif);
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow 0.2s ease;
}
.feedback-btn:hover {
  background: var(--color-panel-2);
  transform: translateY(-1px);
}
.feedback-btn:active {
  transform: translateY(0);
}
.feedback-btn.primary {
  border: none;
  color: #fff;
  background: linear-gradient(135deg, var(--color-brand-600), var(--color-brand-500));
  box-shadow: 0 4px 14px rgba(0, 113, 227, 0.3);
  font-weight: 600;
}
.feedback-btn.primary:hover {
  box-shadow: 0 6px 20px rgba(0, 113, 227, 0.4);
  transform: translateY(-1px);
  background: linear-gradient(135deg, var(--color-accent-hover), var(--color-brand-500));
}
.feedback-btn.primary:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 113, 227, 0.3);
}
.feedback-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
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
    width: 34px;
  }
  .feedback-fab__inner {
    width: 34px;
    padding: 10px 6px;
  }
}
</style>
