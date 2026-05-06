<!-- [2026-05-04] 更新：配置编辑弹窗，匹配设计预览 -->
<script setup lang="ts">
import { ref, watch } from 'vue'
import type { AppConfig } from '@/features/app-config'

const props = defineProps<{
  config: AppConfig | null
  saving: boolean
}>()

const emit = defineEmits<{
  (e: 'save', data: { value: string; description?: string }): void
  (e: 'close'): void
}>()

const value = ref('')
const description = ref('')

watch(() => props.config, (config) => {
  if (config) {
    value.value = config.value || ''
    description.value = config.description || ''
  } else {
    value.value = ''
    description.value = ''
  }
}, { immediate: true })

function handleSubmit() {
  emit('save', {
    value: value.value,
    description: description.value || undefined
  })
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal-panel">
      <div class="modal-header">
        <h3 class="modal-title">
          {{ config ? '编辑配置' : '新增配置' }}
        </h3>
        <button class="modal-close" @click="emit('close')">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
            <path d="M2 2l10 10M12 2L2 12" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="modal-body">
          <div v-if="config" class="form-field">
            <label class="form-label">配置项</label>
            <input
              type="text"
              :value="`${config.category}:${config.key}`"
              disabled
              class="form-input disabled"
            />
          </div>

          <div class="form-field">
            <label class="form-label">
              配置值
              <span v-if="config?.is_encrypted" class="form-label-hint">(已加密)</span>
            </label>
            <textarea
              v-model="value"
              rows="4"
              :placeholder="config?.is_encrypted ? '输入加密值...' : '输入配置值...'"
              class="form-textarea"
            ></textarea>
          </div>

          <div class="form-field">
            <label class="form-label">描述</label>
            <input
              v-model="description"
              type="text"
              placeholder="配置描述（可选）"
              class="form-input"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn-modal"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="btn-modal primary"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  z-index: 1000;
}

.modal-panel {
  width: 420px;
  max-width: 90vw;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.modal-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.modal-body {
  padding: 20px;
}

.form-field {
  margin-bottom: 16px;
}

.form-field:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-subtle);
}

.form-label-hint {
  color: #f59e0b;
  font-weight: 400;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 13px;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.form-textarea {
  font-family: var(--font-code);
  resize: vertical;
  min-height: 100px;
}

.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.form-input.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-2);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
}

.btn-modal {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-modal:hover {
  background: var(--color-panel);
  border-color: var(--color-border-hover);
}

.btn-modal.primary {
  border: none;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
}

.btn-modal.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.3);
}

.btn-modal:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
