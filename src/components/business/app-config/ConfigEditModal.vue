<!-- [2026-05-06] 应用配置编辑弹窗 - 支持新建和编辑 -->
<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import type { AppConfig, ConfigValueType, CreateConfigPayload } from '@/features/app-config'
import { CATEGORY_LABELS, CONFIG_CATEGORIES } from '@/features/app-config'
import { appConfigApi } from '@/api/app-config'

const props = defineProps<{
  open: boolean
  config: AppConfig | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

// --- Form State ---
const formCategory = ref('')
const formKey = ref('')
const formValue = ref('')
const formValueType = ref<ConfigValueType>('string')
const formDescription = ref('')
const formEncrypted = ref(false)

// --- UI State ---
const saving = ref(false)
const saveError = ref('')
const lastFocusedElement = ref<HTMLElement | null>(null)

// --- Computed ---
const isEditMode = computed(() => !!props.config)

const categoryOptions = computed(() => {
  return Object.entries(CONFIG_CATEGORIES).map(([_key, value]) => ({
    key: value,
    label: CATEGORY_LABELS[value] || value
  }))
})

const valueTypeOptions: { value: ConfigValueType; label: string }[] = [
  { value: 'string', label: '字符串' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔值' },
  { value: 'jsonb', label: 'JSON' }
]

// --- Watchers ---
watch(
  () => props.open,
  (val) => {
    if (val) {
      resetForm()
      lastFocusedElement.value =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
  }
)

watch(formCategory, (newCat) => {
  if (!isEditMode.value && newCat) {
    formKey.value = ''
  }
})

// --- Methods ---
function resetForm(): void {
  saveError.value = ''
  if (props.config) {
    formCategory.value = props.config.category
    formKey.value = props.config.key
    formValue.value = props.config.value || ''
    formValueType.value = props.config.value_type
    formDescription.value = props.config.description || ''
    formEncrypted.value = props.config.is_encrypted
  } else {
    formCategory.value = CONFIG_CATEGORIES.SYSTEM
    formKey.value = ''
    formValue.value = ''
    formValueType.value = 'string'
    formDescription.value = ''
    formEncrypted.value = false
  }
}

async function handleSave(): Promise<void> {
  if (!formCategory.value || !formKey.value.trim()) {
    saveError.value = '请填写分类和配置键名'
    return
  }

  if (!formValue.value.trim()) {
    saveError.value = '请填写配置值'
    return
  }

  saving.value = true
  saveError.value = ''

  try {
    if (isEditMode.value && props.config) {
      await appConfigApi.update(props.config.id, {
        value: formValue.value,
        description: formDescription.value || undefined
      })
    } else {
      const payload: CreateConfigPayload = {
        category: formCategory.value,
        key: formKey.value.trim(),
        value: formValue.value,
        value_type: formValueType.value,
        description: formDescription.value || undefined,
        is_encrypted: formEncrypted.value
      }
      await appConfigApi.create(payload)
    }
    emit('saved')
    emit('close')
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

function handleClose(): void {
  emit('close')
}

function _restoreFocus(): void {
  lastFocusedElement.value?.focus()
  lastFocusedElement.value = null
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    handleClose()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-overlay" @click.self="handleClose">
      <div class="modal-panel" role="dialog" aria-modal="true">
        <!-- Header -->
        <div class="modal-header">
          <h3 class="modal-title">
            {{ isEditMode ? '编辑配置' : '新增配置' }}
          </h3>
          <button class="modal-close" type="button" aria-label="关闭" @click="handleClose">
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
          <!-- 编辑模式：显示分类:键名 -->
          <div v-if="isEditMode" class="form-field">
            <label class="form-label">配置项</label>
            <div class="config-key-display">
              <code>{{ formCategory }}:{{ formKey }}</code>
            </div>
          </div>

          <!-- 新建模式：分类和键名 -->
          <template v-if="!isEditMode">
            <div class="form-field">
              <label class="form-label" for="config-category">分类</label>
              <select id="config-category" v-model="formCategory" class="form-select">
                <option v-for="cat in categoryOptions" :key="cat.key" :value="cat.key">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <div class="form-field">
              <label class="form-label" for="config-key">配置键名</label>
              <input
                id="config-key"
                v-model="formKey"
                type="text"
                placeholder="如 max_input_length"
                class="form-input form-input-mono"
              />
            </div>

            <div class="form-row">
              <div class="form-field">
                <label class="form-label" for="config-type">类型</label>
                <select id="config-type" v-model="formValueType" class="form-select">
                  <option v-for="type in valueTypeOptions" :key="type.value" :value="type.value">
                    {{ type.label }}
                  </option>
                </select>
              </div>

              <div class="form-field form-field-checkbox">
                <label class="form-label">加密存储</label>
                <label class="checkbox-label">
                  <input v-model="formEncrypted" type="checkbox" class="checkbox-input" />
                  <span class="checkbox-text">是</span>
                </label>
              </div>
            </div>
          </template>

          <!-- 配置值 -->
          <div class="form-field">
            <label class="form-label" for="config-value">
              配置值
              <span v-if="formEncrypted" class="form-label-hint">(加密存储)</span>
            </label>
            <textarea
              id="config-value"
              v-model="formValue"
              rows="4"
              :placeholder="formEncrypted ? '输入加密值...' : '输入配置值...'"
              class="form-textarea"
            ></textarea>
          </div>

          <!-- 描述 -->
          <div class="form-field">
            <label class="form-label" for="config-desc">描述（可选）</label>
            <input
              id="config-desc"
              v-model="formDescription"
              type="text"
              placeholder="配置项的中文说明"
              class="form-input"
            />
          </div>

          <!-- Error -->
          <p v-if="saveError" class="form-error">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">取消</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? '保存中...' : '保存' }}
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
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
}

.modal-panel {
  width: 480px;
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
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
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
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-2);
  flex-shrink: 0;
}

/* Form */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-subtle);
}

.form-label-hint {
  color: var(--color-warning);
  font-weight: 400;
  margin-left: 4px;
}

.form-input,
.form-select,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 13px;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.form-input-mono {
  font-family: var(--font-code);
}

.form-textarea {
  font-family: var(--font-code);
  resize: vertical;
  min-height: 100px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-row .form-field {
  flex: 1;
}

.form-field-checkbox {
  flex: 0 0 auto;
  justify-content: flex-end;
}

.config-key-display {
  padding: 8px 12px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
}

.config-key-display code {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-text);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.checkbox-input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-text {
  font-size: 13px;
  color: var(--color-text);
}

.form-error {
  font-size: 12px;
  color: var(--color-danger);
  margin: 0;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:hover {
  background: var(--color-panel-2);
}

.btn-secondary {
  background: transparent;
}

.btn-primary {
  border: none;
  background: var(--gradient-brand-primary);
  color: white;
  box-shadow: var(--shadow-brand-primary);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
