<!-- [2026-05-06] AI 配置编辑/新建弹窗 - 新设计 -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { AiProviderDef, AiProviderConfig, AiConfigPayload } from '@/features/ai'
import { DEFAULT_TIMEOUT_MS } from '@/features/ai'
import { aiConfigApi } from '@/api/ai-config'

const props = defineProps<{
  open: boolean
  config?: AiProviderConfig | null
  providers: AiProviderDef[]
  defaultProvider?: AiProviderDef | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// --- Form state ---
const formName = ref('')
const formProviderId = ref('')
const formModel = ref('')
const formBaseUrl = ref('')
const formApiKey = ref('')
const formIsDefault = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; elapsed_ms: number; error?: string } | null>(null)
const saveError = ref('')

// --- Computed ---
const isEditMode = computed(() => !!props.config)

const selectedProvider = computed<AiProviderDef | undefined>(() =>
  props.providers.find((p) => p.id === formProviderId.value)
)

const availableModels = computed<string[]>(() => selectedProvider.value?.models ?? [])

// --- Watchers ---
watch(
  () => props.open,
  (val) => {
    if (val) {
      resetForm()
    }
  }
)

watch(formProviderId, (newId) => {
  const p = props.providers.find((pr) => pr.id === newId)
  if (p && !isEditMode.value) {
    formBaseUrl.value = p.base_url
    formModel.value = p.default_model
  }
})

// --- Form helpers ---
function resetForm(): void {
  saveError.value = ''
  testResult.value = null
  if (props.config) {
    formName.value = props.config.name
    formProviderId.value = props.config.provider_id
    formModel.value = props.config.model
    formBaseUrl.value = props.config.base_url
    formApiKey.value = ''
    formIsDefault.value = false
  } else if (props.defaultProvider) {
    formName.value = ''
    formProviderId.value = props.defaultProvider.id
    formModel.value = props.defaultProvider.default_model
    formBaseUrl.value = props.defaultProvider.base_url
    formApiKey.value = ''
    formIsDefault.value = false
  } else {
    formName.value = ''
    formProviderId.value = props.providers[0]?.id ?? ''
    const p = props.providers.find((pr) => pr.id === formProviderId.value)
    formModel.value = p?.default_model ?? ''
    formBaseUrl.value = p?.base_url ?? ''
    formApiKey.value = ''
    formIsDefault.value = false
  }
}

// --- Actions ---
async function handleSave(): Promise<void> {
  saving.value = true
  saveError.value = ''
  try {
    const payload: AiConfigPayload = {
      provider_id: formProviderId.value,
      name: formName.value || undefined,
      base_url: formBaseUrl.value || undefined,
      model: formModel.value || undefined,
      api_key: formApiKey.value || undefined,
      timeout_ms: DEFAULT_TIMEOUT_MS
    }

    if (isEditMode.value && props.config) {
      await aiConfigApi.update(props.config.id, payload)
    } else {
      await aiConfigApi.create(payload)
    }
    emit('saved')
    emit('close')
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function handleTest(): Promise<void> {
  if (!isEditMode.value || !props.config) return
  testing.value = true
  testResult.value = null
  try {
    const result = await aiConfigApi.test(props.config.id)
    testResult.value = result
  } catch (e: unknown) {
    testResult.value = {
      ok: false,
      elapsed_ms: 0,
      error: e instanceof Error ? e.message : '测试失败'
    }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <BaseModal :open="open" @close="emit('close')">
    <template #title>{{ isEditMode ? '编辑配置' : '新增配置' }}</template>
    <template #subtitle>
      <template v-if="selectedProvider">
        为 {{ selectedProvider.label }} 添加模型和 API Key
      </template>
      <template v-else> 添加 AI 服务商配置 </template>
    </template>

    <div class="form-body">
      <!-- 配置名称 -->
      <div class="form-group">
        <label class="form-label">配置名称</label>
        <input
          v-model="formName"
          type="text"
          placeholder="例如：生产环境、测试环境"
          class="form-input"
        />
      </div>

      <!-- 选择模型 -->
      <div class="form-group">
        <label class="form-label">选择模型</label>
        <select v-model="formModel" class="form-input">
          <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>

      <!-- API Key -->
      <div class="form-group">
        <label class="form-label">API Key</label>
        <input
          v-model="formApiKey"
          type="password"
          :placeholder="isEditMode ? '留空则不修改' : 'sk-...'"
          class="form-input form-input-mono"
        />
        <p class="form-hint">Key 将加密存储，仅显示末四位</p>
      </div>

      <!-- Base URL -->
      <div class="form-group">
        <label class="form-label">
          Base URL
          <span class="form-label-optional">(可选)</span>
        </label>
        <input
          v-model="formBaseUrl"
          type="text"
          placeholder="https://api.openai.com/v1"
          class="form-input form-input-mono"
        />
        <p class="form-hint">使用代理或自定义端点时填写</p>
      </div>

      <!-- 设为默认配置 -->
      <div class="form-group form-group-toggle">
        <label class="form-label">设为默认配置</label>
        <button
          class="toggle-switch"
          :class="{ active: formIsDefault }"
          @click="formIsDefault = !formIsDefault"
        >
          <span class="toggle-handle"></span>
        </button>
      </div>

      <!-- Test result -->
      <div
        v-if="testResult"
        class="test-result"
        :class="testResult.ok ? 'test-success' : 'test-error'"
      >
        <div class="test-icon">
          <svg
            v-if="testResult.ok"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <svg
            v-else
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </div>
        <div class="test-content">
          <span class="test-title">{{ testResult.ok ? '连接成功' : '连接失败' }}</span>
          <span v-if="testResult.ok" class="test-badge">{{ testResult.elapsed_ms }}ms</span>
          <span v-if="testResult.error" class="test-error-msg">{{ testResult.error }}</span>
        </div>
      </div>

      <!-- Save error -->
      <p v-if="saveError" class="form-error">{{ saveError }}</p>
    </div>

    <template #footer>
      <div class="footer-wrap">
        <button class="btn btn-cancel" @click="emit('close')">取消</button>
        <div class="footer-actions">
          <button v-if="isEditMode" class="btn btn-outline" :disabled="testing" @click="handleTest">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
          <button class="btn btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? '保存中...' : '保存配置' }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group-toggle {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.form-label {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-subtle);
  margin-bottom: 8px;
  display: block;
}

.form-label-optional {
  color: var(--color-text-muted);
  font-weight: 400;
}

.form-input {
  width: 100%;
  height: 42px;
  padding: 0 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: var(--shadow-focus-ring);
}

.form-input-mono {
  font-family: var(--font-code);
  font-size: 13px;
}

.form-hint {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text-muted);
  margin: 6px 0 0 0;
}

.form-error {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-danger);
  margin: 0;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
}

.toggle-switch.active {
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.toggle-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-subtle);
  transition: all 0.15s ease;
}

.toggle-switch.active .toggle-handle {
  left: 22px;
  background: var(--color-btn-primary-text);
}

/* Test Result */
.test-result {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid;
  font-family: var(--font-body);
}

.test-success {
  background: var(--color-success-bg);
  border-color: var(--color-success);
}

.test-error {
  background: var(--color-danger-bg);
  border-color: var(--color-danger);
}

.test-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
}

.test-success .test-icon {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.test-error .test-icon {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.test-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.test-title {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
}

.test-badge {
  font-family: var(--font-code);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--color-panel-2);
  color: var(--color-success);
}

.test-error-msg {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-danger);
  width: 100%;
}

/* Footer */
.footer-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
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

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
}

.btn-outline:hover:not(:disabled) {
  background: var(--color-panel-2);
  color: var(--color-text);
  border-color: var(--color-border-hover);
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
