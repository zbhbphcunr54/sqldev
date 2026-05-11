<!-- [2026-05-07] 新增 Key / 追加模型弹窗 -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import { useEscapeKey } from '@/composables/useEscapeKey'
import FormSelect from '@/components/common/FormSelect.vue'

const props = defineProps<{
  open: boolean
  providers: AiProviderDef[]
  /** 现有的配置列表，用于检测重复 key */
  existingConfigs: AiProviderConfig[]
  /** 追加模式：预填的供应商 ID（锁定不可改） */
  prefillProviderId?: string
  /** 追加模式：预填的 API Key（锁定不可改） */
  prefillApiKey?: string
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      provider_id: string
      model: string
      api_key: string
      base_url?: string
      name?: string
    }
  ]
}>()

// Form state
const selectedProviderId = ref('')
const selectedModel = ref('')
const apiKey = ref('')
const baseUrl = ref('')
const note = ref('')
const submitting = ref(false)

// Append mode
const isAppendMode = computed(() => !!props.prefillProviderId)

// Computed
const selectedProvider = computed(() =>
  props.providers.find((p) => p.id === selectedProviderId.value)
)

const availableModels = computed(() => {
  if (!selectedProvider.value) return []
  // 追加模式：过滤掉已存在的模型
  if (isAppendMode.value) {
    const existing = props.existingConfigs
      .filter((c) => c.provider_id === selectedProviderId.value)
      .map((c) => c.model)
    return selectedProvider.value.models.filter((m) => !existing.includes(m))
  }
  return selectedProvider.value.models
})

const providerOptions = computed(() =>
  props.providers.map((p) => ({ value: p.id, label: p.label }))
)

const modelOptions = computed(() =>
  availableModels.value.map((m) => ({ value: m, label: m }))
)

// Watch provider change to auto-fill URL and default model
watch(selectedProviderId, (newId) => {
  const p = props.providers.find((pr) => pr.id === newId)
  if (p) {
    baseUrl.value = p.base_url
    selectedModel.value = availableModels.value[0] ?? ''
  }
})

// Reset form when modal opens
watch(
  () => props.open,
  (val) => {
    if (val) {
      resetForm()
    }
  }
)

function resetForm(): void {
  if (isAppendMode.value) {
    selectedProviderId.value = props.prefillProviderId ?? ''
    apiKey.value = ''
    const p = props.providers.find((pr) => pr.id === selectedProviderId.value)
    baseUrl.value = p?.base_url ?? ''
    selectedModel.value = availableModels.value[0] ?? ''
  } else {
    selectedProviderId.value = props.providers[0]?.id ?? ''
    selectedModel.value = props.providers[0]?.models[0] ?? ''
    apiKey.value = ''
    baseUrl.value = props.providers[0]?.base_url ?? ''
  }
  note.value = ''
  submitting.value = false
}

useEscapeKey(() => emit('close'))

// Submit
function handleSubmit(): void {
  if (!selectedProviderId.value || !selectedModel.value) return
  if (!isAppendMode.value && !apiKey.value) return
  submitting.value = true
  try {
    emit('save', {
      provider_id: selectedProviderId.value,
      model: selectedModel.value,
      api_key: apiKey.value,
      base_url: baseUrl.value || undefined,
      name: note.value || undefined
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-panel">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-header-content">
            <h2 class="modal-title">{{ isAppendMode ? '追加模型' : '新增 API Key' }}</h2>
            <p class="modal-subtitle">
              {{ isAppendMode ? '为该 Key 添加新的模型' : '添加新的 AI 服务密钥配置' }}
            </p>
          </div>
          <button class="modal-close" @click="emit('close')">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- Provider & Model -->
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">选择供应商</label>
              <FormSelect
                v-model="selectedProviderId"
                :options="providerOptions"
                placeholder="选择供应商"
              />
            </div>
            <div class="form-group">
              <label class="form-label">{{ isAppendMode ? '可用模型' : '选择模型' }}</label>
              <FormSelect
                v-model="selectedModel"
                :options="modelOptions"
                :placeholder="availableModels.length === 0 ? '无可用模型' : '选择模型'"
              />
            </div>
          </div>

          <!-- API Key (追加模式自动复用同供应商已有 key) -->
          <div v-if="!isAppendMode" class="form-group">
            <label class="form-label">API Key</label>
            <input
              v-model="apiKey"
              type="password"
              placeholder="sk-..."
              class="form-input form-input-full"
            />
          </div>
          <div v-else class="form-group">
            <label class="form-label">API Key</label>
            <p class="form-hint">自动复用该供应商已有 Key</p>
          </div>

          <!-- Base URL -->
          <div class="form-group">
            <label class="form-label">接口地址</label>
            <input
              v-model="baseUrl"
              type="text"
              placeholder="https://api.example.com/v1"
              class="form-input form-input-mono form-input-full"
            />
          </div>

          <!-- Note -->
          <div class="form-group">
            <label class="form-label">备注</label>
            <input
              v-model="note"
              type="text"
              placeholder="可选备注"
              class="form-input form-input-full"
            />
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button class="btn btn-cancel" @click="emit('close')">取消</button>
          <button
            class="btn btn-primary"
            :disabled="submitting || (!isAppendMode && !apiKey) || !selectedModel || availableModels.length === 0"
            @click="handleSubmit"
          >
            {{ submitting ? (isAppendMode ? '添加中...' : '添加中...') : (isAppendMode ? '添加模型' : '添加 Key') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  animation: modalFadeIn 0.15s ease-out;
}

@keyframes modalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-panel {
  width: 480px;
  max-width: 92vw;
  max-height: 90vh;
  background: var(--color-panel);
  border: 1px solid var(--color-modal-border);
  border-radius: var(--radius-modal);
  box-shadow: var(--shadow-xl);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: modalScaleIn 0.2s ease-out;
}

@keyframes modalScaleIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Header */
.modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-modal-section-border);
  flex-shrink: 0;
}

.modal-header-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-title {
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.modal-subtitle {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-subtle);
  margin: 0;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
  flex-shrink: 0;
}

.modal-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

/* Body */
.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.modal-body::-webkit-scrollbar {
  width: var(--scrollbar-size, 6px);
}

.modal-body::-webkit-scrollbar-track {
  background: var(--scrollbar-track, transparent);
  border-radius: var(--scrollbar-radius, 3px);
}

.modal-body::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--scrollbar-radius, 3px);
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-group {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 12px;
  color: var(--color-text-subtle);
  font-weight: 500;
}

.form-input,
.form-select {
  height: 42px;
  padding: 0 14px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
  transition: all 0.15s ease;
}

.form-input:focus,
.form-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input-full {
  width: 100%;
  box-sizing: border-box;
}

.form-hint {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-muted);
  padding: 8px 0;
}

.form-input[type='password'] {
  font-family: var(--font-code);
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--color-modal-section-border);
  flex-shrink: 0;
}

.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
}

.btn-cancel:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.btn-primary {
  background: var(--color-accent);
  border: none;
  color: var(--color-btn-primary-text);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
