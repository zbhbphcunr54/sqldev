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
  <div class="fixed inset-0 z-50 flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/50" @click="emit('close')"></div>

    <!-- Modal -->
    <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
      <div class="px-6 py-4 border-b">
        <h3 class="text-lg font-semibold text-gray-900">
          {{ config ? '编辑配置' : '新增配置' }}
        </h3>
      </div>

      <form @submit.prevent="handleSubmit">
        <div class="px-6 py-4 space-y-4">
          <div v-if="config">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              配置项
            </label>
            <input
              type="text"
              :value="`${config.category}:${config.key}`"
              disabled
              class="w-full px-3 py-2 bg-gray-100 border rounded-lg text-gray-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              配置值
              <span v-if="config?.is_encrypted" class="text-orange-500 text-xs">(已加密)</span>
            </label>
            <textarea
              v-model="value"
              rows="4"
              :placeholder="config?.is_encrypted ? '输入加密值...' : '输入配置值...'"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
            <input
              v-model="description"
              type="text"
              placeholder="配置描述（可选）"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
          <button
            type="button"
            class="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="submit"
            :disabled="saving"
            class="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
