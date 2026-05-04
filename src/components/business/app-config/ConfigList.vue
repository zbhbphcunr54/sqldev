<script setup lang="ts">
import type { AppConfig } from '@/features/app-config'
import { CATEGORY_LABELS, VALUE_TYPE_LABELS } from '@/features/app-config'

defineProps<{
  configs: AppConfig[]
  isAdmin: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', config: AppConfig): void
  (e: 'delete', id: string): void
}>()

function formatValue(config: AppConfig): string {
  if (config.is_encrypted) return '******'
  if (config.value === null) return '(空)'
  if (config.value_type === 'boolean') return config.value === 'true' ? '是' : '否'
  if (config.value_type === 'jsonb') {
    try {
      const parsed = JSON.parse(config.value)
      return JSON.stringify(parsed, null, 2).slice(0, 100)
    } catch {
      return config.value.slice(0, 100)
    }
  }
  return config.value.length > 80 ? config.value.slice(0, 80) + '...' : config.value
}

function getValueTypeBadgeClass(type: string): string {
  switch (type) {
    case 'number': return 'bg-blue-100 text-blue-700'
    case 'boolean': return 'bg-purple-100 text-purple-700'
    case 'jsonb': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}
</script>

<template>
  <div class="bg-white rounded-lg border overflow-hidden">
    <table class="w-full">
      <thead class="bg-gray-50 border-b">
        <tr>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配置项</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">值</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
          <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
          <th v-if="isAdmin" class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
        </tr>
      </thead>
      <tbody class="divide-y">
        <tr v-for="config in configs" :key="config.id" class="hover:bg-gray-50">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-gray-900">{{ config.key }}</div>
            <div class="text-xs text-gray-500">{{ config.description || '无描述' }}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm text-gray-700 max-w-xs truncate font-mono" :title="config.value || ''">
              {{ formatValue(config) }}
            </div>
          </td>
          <td class="px-4 py-3">
            <span
              :class="['inline-block px-2 py-0.5 text-xs rounded', getValueTypeBadgeClass(config.value_type)]"
            >
              {{ VALUE_TYPE_LABELS[config.value_type] || config.value_type }}
            </span>
          </td>
          <td class="px-4 py-3">
            <span
              :class="[
                'inline-block px-2 py-0.5 text-xs rounded',
                config.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              ]"
            >
              {{ config.is_active ? '启用' : '禁用' }}
            </span>
            <span
              v-if="config.is_encrypted"
              class="inline-block ml-1 px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-700"
            >
              加密
            </span>
          </td>
          <td v-if="isAdmin" class="px-4 py-3 text-right">
            <button
              class="text-blue-600 hover:text-blue-800 text-sm mr-3"
              @click="emit('edit', config)"
            >
              编辑
            </button>
            <button
              class="text-red-600 hover:text-red-800 text-sm"
              @click="emit('delete', config.id)"
            >
              删除
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
