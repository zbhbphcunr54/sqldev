<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { AiProviderConfig, AiProviderDef } from '@/features/ai'
import FormSelect from '@/components/common/FormSelect.vue'

const props = defineProps<{
  open: boolean
  providers: AiProviderDef[]
  existingConfigs: AiProviderConfig[]
  prefillProviderId?: string
  prefillApiKeyMasked?: string
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
      api_key_masked?: string
      reuse_config_id?: string
    }
  ]
}>()

const selectedProviderId = ref('')
const selectedModel = ref('')
const apiKey = ref('')
const baseUrl = ref('')
const note = ref('')
const submitting = ref(false)

const isAppendMode = computed(() => !!props.prefillProviderId)

const selectedProvider = computed(() =>
  props.providers.find((provider) => provider.id === selectedProviderId.value)
)

const reusableConfig = computed(() => {
  if (!isAppendMode.value) return null
  return (
    props.existingConfigs.find(
      (config) =>
        config.provider_id === selectedProviderId.value &&
        config.api_key_masked === props.prefillApiKeyMasked
    ) ?? null
  )
})

const availableModels = computed(() => {
  if (!selectedProvider.value) return []

  if (isAppendMode.value) {
    const existing = props.existingConfigs
      .filter(
        (config) =>
          config.provider_id === selectedProviderId.value &&
          config.api_key_masked === props.prefillApiKeyMasked
      )
      .map((config) => config.model)
    return selectedProvider.value.models.filter((model) => !existing.includes(model))
  }

  return selectedProvider.value.models
})

const providerOptions = computed(() =>
  props.providers.map((provider) => ({
    value: provider.id,
    label: provider.label
  }))
)

const modelOptions = computed(() =>
  availableModels.value.map((model) => ({
    value: model,
    label: model
  }))
)

watch(selectedProviderId, (providerId) => {
  const provider = props.providers.find((item) => item.id === providerId)
  if (!provider) return

  baseUrl.value = provider.base_url
  selectedModel.value = availableModels.value[0] ?? ''
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm()
    }
  }
)

function resetForm(): void {
  if (isAppendMode.value) {
    selectedProviderId.value = props.prefillProviderId ?? ''
    apiKey.value = ''
    const provider = props.providers.find((item) => item.id === selectedProviderId.value)
    baseUrl.value = provider?.base_url ?? ''
    selectedModel.value = availableModels.value[0] ?? ''
  } else {
    const firstProvider = props.providers[0]
    selectedProviderId.value = firstProvider?.id ?? ''
    selectedModel.value = firstProvider?.models[0] ?? ''
    apiKey.value = ''
    baseUrl.value = firstProvider?.base_url ?? ''
  }

  note.value = ''
  submitting.value = false
}

function handleSubmit(): void {
  if (!selectedProviderId.value || !selectedModel.value) return
  if (!isAppendMode.value && !apiKey.value.trim()) return

  submitting.value = true
  try {
    emit('save', {
      provider_id: selectedProviderId.value,
      model: selectedModel.value,
      api_key: apiKey.value.trim(),
      base_url: baseUrl.value.trim() || undefined,
      name: note.value.trim() || undefined,
      api_key_masked: isAppendMode.value ? props.prefillApiKeyMasked : undefined,
      reuse_config_id: isAppendMode.value ? reusableConfig.value?.id : undefined
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" @close="emit('close')">
    <template #title>{{ isAppendMode ? '追加模型' : '新增 API Key' }}</template>
    <template #subtitle>
      {{
        isAppendMode
          ? '为当前这组 Key 追加新的模型配置。'
          : '新增一条 AI Key 配置，用于页面内 AI 调用。'
      }}
    </template>

    <div class="form-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">选择供应商</label>
          <FormSelect
            v-model="selectedProviderId"
            :options="providerOptions"
            placeholder="请选择供应商"
            :disabled="isAppendMode"
          />
        </div>

        <div class="form-group">
          <label class="form-label">{{ isAppendMode ? '可追加模型' : '选择模型' }}</label>
          <FormSelect
            v-model="selectedModel"
            :options="modelOptions"
            :disabled="availableModels.length === 0"
            :placeholder="availableModels.length === 0 ? '没有可选模型' : '请选择模型'"
          />
        </div>
      </div>

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
        <label class="form-label">复用 Key</label>
        <p class="form-hint">
          当前会复用这组配置对应的 Key：{{ prefillApiKeyMasked || '已隐藏' }}
        </p>
      </div>

      <div class="form-group">
        <label class="form-label">接口地址</label>
        <input
          v-model="baseUrl"
          type="text"
          placeholder="https://api.example.com/v1"
          class="form-input form-input-full"
        />
      </div>

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

    <template #footer>
      <button class="btn btn-cancel" @click="emit('close')">取消</button>
      <button
        class="btn btn-primary"
        :disabled="
          submitting ||
          (!isAppendMode && !apiKey.trim()) ||
          !selectedModel ||
          availableModels.length === 0
        "
        @click="handleSubmit"
      >
        {{ submitting ? '提交中...' : isAppendMode ? '追加模型' : '新增 Key' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
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

.form-input {
  height: 42px;
  padding: 0 14px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
}

.form-input:focus {
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

.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
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
