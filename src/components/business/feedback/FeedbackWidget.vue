<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import { submitFeedback, type FeedbackRequest } from '@/api/feedback'
import { ApiError } from '@/api/http'
import { mapErrorCodeToMessage } from '@/utils/error-map'

const props = withDefaults(
  defineProps<{
    source?: FeedbackRequest['source']
  }>(),
  {
    source: 'workbench'
  }
)

const open = ref(false)
const category = ref<FeedbackRequest['category']>('feature')
const content = ref('')
const loading = ref(false)
const status = ref<{ type: 'idle' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' })

const canSubmit = computed(() => content.value.trim().length >= 6)

watch(open, (isOpen) => {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('feedback-open', isOpen)
})

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.classList.remove('feedback-open')
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

  if (error instanceof TypeError) {
    return mapErrorCodeToMessage('feedback_network_failed')
  }

  return mapErrorCodeToMessage('feedback_submit_failed')
}

async function handleSubmit(): Promise<void> {
  if (!canSubmit.value || loading.value) return
  loading.value = true
  status.value = { type: 'idle', text: '' }
  try {
    await submitFeedback({
      category: category.value,
      content: content.value.trim(),
      source: props.source
    })
    content.value = ''
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
    <button
      class="feedback-fab"
      :aria-expanded="open"
      aria-label="打开建议反馈面板"
      @click="open = !open"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 3.5h10v6.75H8.4L5.15 13.2v-2.95H3V3.5Z"
          stroke="currentColor"
          stroke-width="1.4"
          stroke-linejoin="round"
        />
      </svg>
      <span>提建议</span>
    </button>

    <div
      v-if="open"
      class="feedback-modal-mask"
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
        <div class="feedback-modal-head">
          <h3 id="feedback-title">产品建议</h3>
          <button class="feedback-close" type="button" aria-label="关闭" @click="closeFeedback">
            &times;
          </button>
        </div>
        <p class="feedback-modal-desc">欢迎反馈 Bug、体验问题或优化想法。</p>

        <label class="feedback-label" for="feedback-category">分类</label>
        <select id="feedback-category" v-model="category" class="feedback-select">
          <option value="bug">Bug 问题</option>
          <option value="feature">功能建议</option>
          <option value="ux">界面体验</option>
          <option value="performance">性能速度</option>
          <option value="other">其他</option>
        </select>

        <label class="feedback-label" for="feedback-content">内容</label>
        <textarea
          id="feedback-content"
          v-model="content"
          rows="5"
          class="feedback-textarea"
          placeholder="请输入你的建议（至少 6 个字）"
        ></textarea>

        <div class="feedback-meta-row">
          <span class="feedback-hint">提交后会进入在线反馈队列</span>
          <span class="feedback-count">{{ content.trim().length }}/6</span>
        </div>

        <p
          v-if="status.text"
          class="feedback-status"
          :class="{ success: status.type === 'success', error: status.type === 'error' }"
        >
          {{ status.text }}
        </p>

        <div class="feedback-actions">
          <button class="feedback-btn" type="button" @click="closeFeedback">关闭</button>
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
  </aside>
</template>

<style>
.feedback-fab {
  position: fixed;
  left: 0;
  top: 50%;
  z-index: 130;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 12px 6px;
  border: 1px solid rgba(99, 135, 241, 0.28);
  border-left: none;
  border-radius: 0 10px 10px 0;
  background: linear-gradient(180deg, rgba(18, 27, 50, 0.94), rgba(9, 15, 31, 0.92));
  color: #cdd9f4;
  box-shadow:
    0 16px 28px rgba(2, 6, 23, 0.34),
    inset 1px 0 0 rgba(255, 255, 255, 0.05);
  font: 700 12px/1 var(--font-body, sans-serif);
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.12em;
  cursor: pointer;
  transform: translateY(-50%);
  transition:
    padding 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
  backdrop-filter: blur(10px);
}

.feedback-fab svg {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  transform: rotate(90deg);
}

.feedback-fab:hover,
body.feedback-open .feedback-fab {
  padding-right: 10px;
  border-color: rgba(125, 163, 255, 0.48);
  color: #ffffff;
  box-shadow:
    0 18px 34px rgba(37, 99, 235, 0.24),
    inset 1px 0 0 rgba(255, 255, 255, 0.08);
}

.feedback-fab:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 3px rgba(79, 125, 249, 0.28),
    0 18px 34px rgba(37, 99, 235, 0.24);
}

body.feedback-open {
  overflow: hidden;
}

.feedback-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10030;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(2, 6, 23, 0.6);
  backdrop-filter: blur(4px);
}

.feedback-modal {
  width: min(520px, 96vw);
  border: 1px solid rgba(99, 135, 241, 0.26);
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(14, 22, 40, 0.98), rgba(8, 13, 27, 0.96));
  box-shadow: 0 22px 54px rgba(2, 6, 23, 0.5);
  padding: 14px 14px 12px;
}

.feedback-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.feedback-modal-head h3 {
  margin: 0;
  color: #e6eefc;
  font-size: 16px;
}

.feedback-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #9fb0cf;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}

.feedback-close:hover {
  background: rgba(79, 125, 249, 0.12);
  color: #f2f7ff;
}

.feedback-modal-desc {
  margin: 0 0 12px;
  color: #93a5c6;
  font-size: 13px;
}

.feedback-label {
  display: block;
  margin: 12px 0 6px;
  color: #cbd7ef;
  font-size: 12px;
  font-weight: 600;
}

.feedback-select,
.feedback-textarea {
  width: 100%;
  border: 1px solid rgba(99, 135, 241, 0.22);
  border-radius: 10px;
  background: rgba(6, 10, 22, 0.72);
  color: #edf3ff;
  padding: 9px 10px;
  font: 500 13px/1.5 var(--font-body, sans-serif);
}

.feedback-textarea {
  min-height: 126px;
  resize: vertical;
}

.feedback-textarea::placeholder {
  color: #7284a7;
}

.feedback-select:focus,
.feedback-textarea:focus {
  border-color: rgba(125, 163, 255, 0.55);
  outline: none;
  box-shadow: 0 0 0 3px rgba(79, 125, 249, 0.18);
}

.feedback-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 8px;
}

.feedback-hint {
  color: #8294b7;
  font-size: 11px;
}

.feedback-count {
  color: #9ab0d4;
  font: 600 11px var(--font-code, monospace);
}

.feedback-status {
  min-height: 18px;
  margin: 8px 0 0;
  color: #cbd7ef;
  font-size: 12px;
}

.feedback-status.error {
  color: #fca5a5;
}

.feedback-status.success {
  color: #86efac;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.feedback-btn {
  min-width: 88px;
  height: 34px;
  border: 1px solid rgba(99, 135, 241, 0.22);
  border-radius: 9px;
  background: rgba(79, 125, 249, 0.08);
  color: #dbe7ff;
  font: 600 12px var(--font-body, sans-serif);
  cursor: pointer;
}

.feedback-btn:hover {
  border-color: rgba(125, 163, 255, 0.4);
  background: rgba(79, 125, 249, 0.12);
}

.feedback-btn.primary {
  border-color: transparent;
  background: linear-gradient(135deg, #4f7df9, #8b5cf6);
  color: #fff;
}

.feedback-btn:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

[data-theme='light'] .feedback-fab {
  border-color: rgba(148, 163, 184, 0.36);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(241, 245, 249, 0.94));
  color: #475569;
  box-shadow:
    0 14px 28px rgba(15, 23, 42, 0.12),
    inset 1px 0 0 rgba(255, 255, 255, 0.9);
}

[data-theme='light'] .feedback-fab:hover,
[data-theme='light'] body.feedback-open .feedback-fab {
  border-color: rgba(37, 99, 235, 0.34);
  color: #1d4ed8;
  box-shadow:
    0 16px 32px rgba(37, 99, 235, 0.14),
    inset 1px 0 0 rgba(255, 255, 255, 0.9);
}

[data-theme='light'] .feedback-modal-mask {
  background: rgba(148, 163, 184, 0.32);
}

[data-theme='light'] .feedback-modal {
  border-color: #dbe5f5;
  background: linear-gradient(180deg, #fff, #f8fafc);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
}

[data-theme='light'] .feedback-modal-head h3 {
  color: #0f172a;
}

[data-theme='light'] .feedback-modal-desc,
[data-theme='light'] .feedback-close,
[data-theme='light'] .feedback-hint {
  color: #64748b;
}

[data-theme='light'] .feedback-label {
  color: #1e293b;
}

[data-theme='light'] .feedback-select,
[data-theme='light'] .feedback-textarea {
  border-color: #dbe5f5;
  background: #fff;
  color: #0f172a;
}

[data-theme='light'] .feedback-textarea::placeholder {
  color: #94a3b8;
}

[data-theme='light'] .feedback-count {
  color: #475569;
}

[data-theme='light'] .feedback-status {
  color: #334155;
}

[data-theme='light'] .feedback-btn {
  border-color: #dbe5f5;
  background: #fff;
  color: #334155;
}

@media (max-width: 639px) {
  .feedback-fab {
    padding: 9px 5px;
    font-size: 11px;
  }
}
</style>
