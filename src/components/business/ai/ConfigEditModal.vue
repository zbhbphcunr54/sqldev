<!-- [2026-04-30] 新增：AI 配置编辑/新建弹窗 -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { AiProviderDef, AiProviderConfig, AiConfigPayload } from '@/features/ai'
import { REGION_MAP, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS } from '@/features/ai'
import { aiConfigApi } from '@/api/ai-config'
import { useAiTest } from '@/composables/useAiTest'

const props = defineProps<{
  open: boolean
  config?: AiProviderConfig | null
  providers: AiProviderDef[]
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
const formTimeout = ref(DEFAULT_TIMEOUT_MS)
const saving = ref(false)
const saveError = ref('')

// --- Test ---
const { testing, testResult, testError, runTest, resetTest } = useAiTest()

// --- Computed ---
const isEditMode = computed(() => !!props.config)

const selectedProvider = computed<AiProviderDef | undefined>(() =>
  props.providers.find((p) => p.id === formProviderId.value)
)

const availableModels = computed<string[]>(() => selectedProvider.value?.models ?? [])

// [2026-04-30] group providers by region for select dropdown
const cnProviders = computed(() => props.providers.filter((p) => p.region === 'cn'))
const intlProviders = computed(() => props.providers.filter((p) => p.region === 'international'))

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
  resetTest()
  if (props.config) {
    formName.value = props.config.name
    formProviderId.value = props.config.provider_id
    formModel.value = props.config.model
    formBaseUrl.value = props.config.base_url
    formApiKey.value = ''
    formTimeout.value = props.config.timeout_ms
  } else {
    formName.value = ''
    formProviderId.value = props.providers[0]?.id ?? ''
    formModel.value = ''
    formBaseUrl.value = ''
    formApiKey.value = ''
    formTimeout.value = DEFAULT_TIMEOUT_MS
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
      timeout_ms: formTimeout.value
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
  await runTest(props.config.id)
}

async function handleRemove(): Promise<void> {
  if (!isEditMode.value || !props.config) return
  if (!confirm('确定删除此配置？')) return
  await aiConfigApi.remove(props.config.id)
  emit('saved')
  emit('close')
}

// --- ESC key handler ---
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-overlay"
      @click.self="emit('close')"
    >
      <div class="modal-panel">
        <!-- Header -->
        <div class="modal-header">
          <div class="modal-header-left">
            <div
              v-if="selectedProvider"
              class="provider-icon"
            >
              {{ selectedProvider?.slug?.slice(0, 2).toUpperCase() ?? '?' }}
            </div>
            <div class="modal-header-info">
              <h2 class="modal-title">
                {{ isEditMode ? '编辑配置' : '新增配置' }}
                <span v-if="selectedProvider" class="modal-title-sub">
                  - {{ selectedProvider.label }}</span
                >
              </h2>
              <p v-if="selectedProvider" class="modal-subtitle">
                {{ REGION_MAP[selectedProvider.region] }}
                <template v-if="selectedProvider.doc_url">
                  &middot;
                  <a
                    :href="selectedProvider.doc_url"
                    target="_blank"
                    class="modal-link"
                    >获取 API Key &rarr;</a
                  >
                </template>
              </p>
            </div>
          </div>
          <button
            class="modal-close"
            @click="emit('close')"
          >
            <svg
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          <!-- 配置名称 -->
          <div class="form-group">
            <label class="form-label">配置名称</label>
            <input
              v-model="formName"
              type="text"
              placeholder="给这个配置起个名字"
              class="form-input"
            />
          </div>

          <!-- 供应商 -->
          <div class="form-group">
            <label class="form-label">供应商</label>
            <select v-model="formProviderId" class="form-input">
              <optgroup label="国内">
                <option v-for="p in cnProviders" :key="p.id" :value="p.id">{{ p.label }}</option>
              </optgroup>
              <optgroup label="国际">
                <option v-for="p in intlProviders" :key="p.id" :value="p.id">{{ p.label }}</option>
              </optgroup>
            </select>
          </div>

          <!-- API Key -->
          <div class="form-group">
            <label class="form-label">API Key</label>
            <input
              v-model="formApiKey"
              type="password"
              :placeholder="isEditMode ? '留空则不修改' : '输入 API Key'"
              class="form-input form-input-mono"
            />
            <p class="form-hint">
              AES-256 加密存储，服务端解密，前端仅显示掩码
            </p>
          </div>

          <!-- API Base URL -->
          <div class="form-group">
            <label class="form-label">API Base URL</label>
            <input
              v-model="formBaseUrl"
              type="text"
              placeholder="https://api.example.com/v1"
              class="form-input form-input-mono"
            />
          </div>

          <!-- Model + Timeout -->
          <div class="form-row-2col">
            <div class="form-group">
              <label class="form-label">
                模型
                <span v-if="availableModels.length" class="form-label-hint">
                  （共 {{ availableModels.length }} 个可选）
                </span>
              </label>
              <select v-model="formModel" class="form-input">
                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">超时时间</label>
              <div class="form-input-wrap">
                <input
                  v-model.number="formTimeout"
                  type="number"
                  :min="MIN_TIMEOUT_MS"
                  :max="MAX_TIMEOUT_MS"
                  :step="5000"
                  class="form-input form-input-mono form-input-pr"
                />
                <span class="form-input-suffix">ms</span>
              </div>
            </div>
          </div>

          <!-- Test result -->
          <div
            v-if="testResult"
            class="test-result"
            :class="testResult.ok ? 'test-result-success' : 'test-result-error'"
          >
            <div class="test-result-header">
              <span
                class="test-result-title"
                :class="testResult.ok ? 'test-result-ok' : 'test-result-fail'"
              >
                {{ testResult.ok ? '连接测试成功' : '连接测试失败' }}
              </span>
            </div>
            <div class="test-result-body">
              <span class="test-result-badge">
                {{ testResult.elapsed_ms }}ms
              </span>
              <span v-if="testResult.error" class="test-result-error-msg">{{ testResult.error }}</span>
            </div>
          </div>

          <!-- Test error -->
          <p v-if="testError" class="form-error">{{ testError }}</p>

          <!-- Save error -->
          <p v-if="saveError" class="form-error">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button
            v-if="isEditMode"
            class="btn-danger"
            @click="handleRemove"
          >
            删除配置
          </button>
          <span v-else></span>

          <div class="modal-footer-actions">
            <button
              v-if="isEditMode"
              class="btn btn-secondary"
              :disabled="testing"
              @click="handleTest"
            >
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            <button
              class="btn btn-primary"
              :disabled="saving"
              @click="handleSave"
            >
              {{ saving ? '保存中...' : '保存' }}
            </button>
          </div>
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
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.modal-panel {
  width: 580px;
  max-width: 92vw;
  max-height: 92vh;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-border);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  flex-shrink: 0;
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.provider-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-control);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  color: white;
  background: #4D6BFE;
  flex-shrink: 0;
}

.modal-header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.modal-title-sub {
  font-weight: 400;
  color: var(--color-text-subtle);
}

.modal-subtitle {
  font-size: 12px;
  color: var(--color-text-subtle);
  margin: 0;
}

.modal-link {
  color: var(--color-brand-500);
}

.modal-link:hover {
  text-decoration: underline;
}

.modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
  border: none;
}

.modal-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 6px;
  display: block;
}

.form-label-hint {
  font-size: 11px;
  font-weight: 400;
  color: var(--color-text-subtle);
}

.form-input {
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

.form-input:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.form-input-mono {
  font-family: var(--font-code);
}

.form-input-pr {
  padding-right: 36px;
}

.form-input-wrap {
  position: relative;
}

.form-input-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--color-text-subtle);
  pointer-events: none;
}

.form-hint {
  font-size: 11px;
  color: var(--color-text-subtle);
  margin-top: 6px;
}

.form-row-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-error {
  font-size: 12px;
  color: var(--color-danger);
}

.test-result {
  padding: 16px;
  border-radius: 12px;
  border: 2px solid;
}

.test-result-success {
  border-color: rgba(21, 145, 95, 0.3);
  background: rgba(21, 145, 95, 0.05);
}

.test-result-error {
  border-color: rgba(214, 69, 69, 0.3);
  background: rgba(214, 69, 69, 0.05);
}

.test-result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.test-result-title {
  font-size: 13px;
  font-weight: 600;
}

.test-result-ok {
  color: var(--color-success);
}

.test-result-fail {
  color: var(--color-danger);
}

.test-result-body {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}

.test-result-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  color: var(--color-text-subtle);
}

.test-result-error-msg {
  color: var(--color-danger);
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid var(--color-border);
  border-radius: 0 0 var(--radius-card) var(--radius-card);
  flex-shrink: 0;
}

.modal-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-danger {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-danger);
  padding: 6px 12px;
  border-radius: var(--radius-control);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-danger:hover {
  background: rgba(214, 69, 69, 0.1);
}

.btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary {
  background: transparent;
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-panel-2);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  border: none;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(37, 99, 235, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

