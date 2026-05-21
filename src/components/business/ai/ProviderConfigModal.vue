<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import BaseModal from '@/components/common/BaseModal.vue'
import type { AiProviderDef } from '@/features/ai'

const props = defineProps<{
  open: boolean
  provider: AiProviderDef | null
  providers: AiProviderDef[]
}>()

const emit = defineEmits<{
  close: []
  save: [
    payload: {
      isEdit: boolean
      providerId?: string
      data: {
        label: string
        slug?: string
        base_url: string
        region: string
        api_format: string
        models: string[]
      }
    }
  ]
}>()

const formName = ref('')
const formSlug = ref('')
const formBaseUrl = ref('')
const formRegion = ref<'cn' | 'international'>('international')
const formApiFormat = ref('custom')
const formModels = ref<string[]>([])
const newModel = ref('')
const saving = ref(false)
const saveError = ref('')

const isEditMode = computed(() => !!props.provider)

watch(
  () => props.open,
  (open) => {
    if (open) {
      resetForm()
    }
  }
)

function setRegion(region: 'cn' | 'international'): void {
  formRegion.value = region
}

function setApiFormat(format: string): void {
  formApiFormat.value = format
}

function resetForm(): void {
  saveError.value = ''
  saving.value = false
  newModel.value = ''

  if (props.provider) {
    formName.value = props.provider.label
    formSlug.value = props.provider.slug
    formBaseUrl.value = props.provider.base_url
    formRegion.value = props.provider.region === 'cn' ? 'cn' : 'international'
    formApiFormat.value = props.provider.api_format || 'custom'
    formModels.value = [...props.provider.models]
    return
  }

  formName.value = ''
  formSlug.value = ''
  formBaseUrl.value = ''
  formRegion.value = 'international'
  formApiFormat.value = 'custom'
  formModels.value = []
}

function addModel(): void {
  const input = newModel.value.trim()
  if (!input) return

  const modelsToAdd = input
    .split(/[,\uFF0C]/)
    .map((item) => item.trim())
    .filter(Boolean)

  let added = 0
  for (const model of modelsToAdd) {
    if (!formModels.value.includes(model)) {
      formModels.value.push(model)
      added += 1
    }
  }

  if (added > 0) {
    newModel.value = ''
  }
}

function removeModel(index: number): void {
  formModels.value.splice(index, 1)
}

function handleModelKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter') {
    e.preventDefault()
    addModel()
  }
}

function handleSave(): void {
  const isEdit = !!props.provider

  if (!formName.value.trim() || (!isEdit && !formSlug.value.trim())) {
    saveError.value = '请填写供应商名称和标识。'
    return
  }

  if (!formBaseUrl.value.trim()) {
    saveError.value = '请填写 API Base URL。'
    return
  }

  saving.value = true
  saveError.value = ''

  emit('save', {
    isEdit,
    providerId: props.provider?.id,
    data: {
      label: formName.value.trim(),
      slug: formSlug.value.trim(),
      base_url: formBaseUrl.value.trim(),
      region: formRegion.value,
      api_format: formApiFormat.value,
      models: [...formModels.value]
    }
  })
}
</script>

<template>
  <BaseModal :open="open" @close="emit('close')">
    <template #title>{{ isEditMode ? '编辑供应商' : '新增供应商' }}</template>
    <template #subtitle>
      {{ isEditMode ? `配置 ${formName} 的基础信息与模型列表。` : '添加新的 AI 供应商。' }}
    </template>

    <div class="form-body">
      <div class="form-section">
        <h3 class="section-title">基础信息</h3>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">供应商名称</label>
            <input
              v-model="formName"
              type="text"
              placeholder="例如 OpenAI、阿里云"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label">标识</label>
            <input
              v-model="formSlug"
              type="text"
              placeholder="例如 openai、qwen"
              class="form-input"
              :disabled="isEditMode"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">服务区域</label>
            <div class="region-toggle">
              <button
                type="button"
                class="region-btn"
                :class="{ active: formRegion === 'international' }"
                @click="setRegion('international')"
              >
                海外
              </button>
              <button
                type="button"
                class="region-btn"
                :class="{ active: formRegion === 'cn' }"
                @click="setRegion('cn')"
              >
                国内
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">API 格式</label>
            <div class="region-toggle">
              <button
                type="button"
                class="region-btn"
                :class="{ active: formApiFormat === 'custom' }"
                @click="setApiFormat('custom')"
              >
                Custom
              </button>
              <button
                type="button"
                class="region-btn"
                :class="{ active: formApiFormat === 'openai_compat' }"
                @click="setApiFormat('openai_compat')"
              >
                OpenAI
              </button>
              <button
                type="button"
                class="region-btn"
                :class="{ active: formApiFormat === 'anthropic' }"
                @click="setApiFormat('anthropic')"
              >
                Anthropic
              </button>
            </div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">API Base URL</label>
          <input
            v-model="formBaseUrl"
            type="text"
            placeholder="https://api.openai.com/v1"
            class="form-input form-input-full"
          />
        </div>
      </div>

      <div class="form-section">
        <h3 class="section-title">可用模型</h3>
        <p class="section-desc">支持批量添加，使用英文逗号或中文逗号分隔。</p>

        <div class="models-container">
          <div class="models-tags models-tags-grid">
            <span v-for="(model, index) in formModels" :key="model" class="model-tag">
              <code>{{ model }}</code>
              <button class="tag-remove" @click="removeModel(index)">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
            <span v-if="formModels.length === 0" class="no-models">暂无模型</span>
          </div>

          <div class="add-model">
            <input
              v-model="newModel"
              type="text"
              placeholder="输入模型名称，支持批量添加"
              class="form-input add-model-input"
              @keydown="handleModelKeydown"
            />
            <button class="btn-add-model" @click="addModel">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              添加
            </button>
          </div>
        </div>
      </div>

      <p v-if="saveError" class="form-error">{{ saveError }}</p>
    </div>

    <template #footer>
      <button class="btn btn-cancel" @click="emit('close')">取消</button>
      <button class="btn btn-primary" :disabled="saving" @click="handleSave">
        {{ saving ? '保存中...' : '保存配置' }}
      </button>
    </template>
  </BaseModal>
</template>

<style scoped>
.form-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.section-title {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.section-desc {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-subtle);
  margin: 0;
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

.region-toggle {
  display: flex;
  gap: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  width: fit-content;
}

.region-btn {
  padding: 8px 18px;
  border: none;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 13px;
  font-family: var(--font-body);
  cursor: pointer;
}

.region-btn:not(:last-child) {
  border-right: 1px solid var(--color-border);
}

.region-btn.active {
  background: var(--color-accent);
  color: var(--color-btn-primary-text);
}

.region-btn:hover:not(.active) {
  background: var(--color-panel-2);
}

.models-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.models-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
  padding: 12px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 10px;
}

.models-tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent-border);
  border-radius: 6px;
  font-size: 12px;
}

.model-tag code {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-accent);
  background: transparent;
}

.tag-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
}

.tag-remove:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.no-models {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
}

.add-model {
  display: flex;
  gap: 10px;
}

.add-model-input {
  flex: 1;
  height: 38px;
  font-size: 13px;
}

.btn-add-model {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  height: 38px;
  background: var(--color-accent-bg);
  border: 1px dashed var(--color-accent-border);
  border-radius: 8px;
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  white-space: nowrap;
}

.btn-add-model:hover {
  background: var(--color-accent-border);
  border-style: solid;
}

.form-error {
  font-size: 12px;
  color: var(--color-danger);
  margin: 0;
  padding: 10px 14px;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-bg);
  border-radius: 8px;
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
