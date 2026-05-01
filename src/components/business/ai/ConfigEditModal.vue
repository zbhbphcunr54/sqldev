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
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0, 0, 0, 0.35); backdrop-filter: blur(6px)"
      @click.self="emit('close')"
    >
      <div class="bg-panel rounded-[18px] w-[580px] max-h-[92vh] flex flex-col shadow-soft">
        <!-- Header -->
        <div
          class="px-6 py-4 border-b border-border flex items-center justify-between rounded-t-[18px] shrink-0"
        >
          <div class="flex items-center gap-3">
            <div
              v-if="selectedProvider"
              class="w-9 h-9 rounded-control flex items-center justify-center font-bold text-[13px] text-white shrink-0"
              :style="{ background: selectedProvider ? '#4D6BFE' : '#9ca3af' }"
            >
              {{ selectedProvider?.slug?.slice(0, 2).toUpperCase() ?? '?' }}
            </div>
            <div>
              <h2 class="font-semibold text-[15px]">
                {{ isEditMode ? '编辑配置' : '新增配置' }}
                <span v-if="selectedProvider" class="font-normal text-subtle">
                  - {{ selectedProvider.label }}</span
                >
              </h2>
              <p v-if="selectedProvider" class="text-[12px] text-subtle">
                {{ REGION_MAP[selectedProvider.region] }}
                <template v-if="selectedProvider.doc_url">
                  &middot;
                  <a
                    :href="selectedProvider.doc_url"
                    target="_blank"
                    class="text-brand-500 hover:underline"
                    >获取 API Key &rarr;</a
                  >
                </template>
              </p>
            </div>
          </div>
          <button
            class="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-panel2 text-subtle transition"
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
        <div class="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          <!-- 配置名称 -->
          <div>
            <label class="block text-[13px] font-medium mb-1.5">配置名称</label>
            <input
              v-model="formName"
              type="text"
              placeholder="给这个配置起个名字"
              class="input-control w-full"
            />
          </div>

          <!-- 供应商 -->
          <div>
            <label class="block text-[13px] font-medium mb-1.5">供应商</label>
            <select v-model="formProviderId" class="input-control w-full">
              <optgroup label="国内">
                <option v-for="p in cnProviders" :key="p.id" :value="p.id">{{ p.label }}</option>
              </optgroup>
              <optgroup label="国际">
                <option v-for="p in intlProviders" :key="p.id" :value="p.id">{{ p.label }}</option>
              </optgroup>
            </select>
          </div>

          <!-- API Key -->
          <div>
            <label class="block text-[13px] font-medium mb-1.5">API Key</label>
            <input
              v-model="formApiKey"
              type="password"
              :placeholder="isEditMode ? '留空则不修改' : '输入 API Key'"
              class="input-control w-full font-mono"
            />
            <p class="text-[11px] text-subtle mt-1.5">
              AES-256 加密存储，服务端解密，前端仅显示掩码
            </p>
          </div>

          <!-- API Base URL -->
          <div>
            <label class="block text-[13px] font-medium mb-1.5">API Base URL</label>
            <input
              v-model="formBaseUrl"
              type="text"
              placeholder="https://api.example.com/v1"
              class="input-control w-full font-mono"
            />
          </div>

          <!-- Model + Timeout -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[13px] font-medium mb-1.5">
                模型
                <span v-if="availableModels.length" class="text-[11px] font-normal text-subtle">
                  （共 {{ availableModels.length }} 个可选）
                </span>
              </label>
              <select v-model="formModel" class="input-control w-full">
                <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div>
              <label class="block text-[13px] font-medium mb-1.5">超时时间</label>
              <div class="relative">
                <input
                  v-model.number="formTimeout"
                  type="number"
                  :min="MIN_TIMEOUT_MS"
                  :max="MAX_TIMEOUT_MS"
                  :step="5000"
                  class="input-control w-full font-mono pr-10"
                />
                <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-subtle"
                  >ms</span
                >
              </div>
            </div>
          </div>

          <!-- Test result -->
          <div
            v-if="testResult"
            class="rounded-xl p-4 border-2"
            :class="
              testResult.ok ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'
            "
          >
            <div class="flex items-center gap-2 mb-1">
              <span
                class="font-semibold text-[13px]"
                :class="testResult.ok ? 'text-success' : 'text-danger'"
              >
                {{ testResult.ok ? '连接测试成功' : '连接测试失败' }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-[12px]">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded bg-panel border border-border text-subtle"
              >
                {{ testResult.elapsed_ms }}ms
              </span>
              <span v-if="testResult.error" class="text-danger">{{ testResult.error }}</span>
            </div>
          </div>

          <!-- Test error -->
          <p v-if="testError" class="text-[12px] text-danger">{{ testError }}</p>

          <!-- Save error -->
          <p v-if="saveError" class="text-[12px] text-danger">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div
          class="px-6 py-4 border-t border-border flex items-center justify-between rounded-b-[18px] shrink-0"
        >
          <button
            v-if="isEditMode"
            class="text-danger text-[13px] font-medium hover:bg-danger/10 px-3 py-1.5 rounded-control transition"
            @click="handleRemove"
          >
            删除配置
          </button>
          <span v-else></span>

          <div class="flex items-center gap-2">
            <button
              v-if="isEditMode"
              class="btn-secondary px-3 py-1.5 text-[13px]"
              :disabled="testing"
              @click="handleTest"
            >
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
            <button
              class="btn-primary px-4 py-1.5 text-[13px]"
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
