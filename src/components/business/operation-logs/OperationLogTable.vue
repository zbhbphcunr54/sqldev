<script setup lang="ts">
import type { OperationLog } from '@/api/operation-logs'

defineProps<{
  items: OperationLog[]
}>()

const emit = defineEmits<{
  detail: [log: OperationLog]
}>()

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}

function statusClass(status: number | null): string {
  if (status === null) return ''
  return status < 400 ? 'text-success' : 'text-danger'
}
</script>

<template>
  <div class="overflow-x-auto rounded-card border border-border">
    <table class="w-full text-[13px]">
      <thead class="border-b border-border bg-panel2 text-subtle">
        <tr>
          <th class="px-3 py-2 text-left font-medium">时间</th>
          <th class="px-3 py-2 text-left font-medium">用户</th>
          <th class="px-3 py-2 text-left font-medium">IP</th>
          <th class="px-3 py-2 text-left font-medium">操作</th>
          <th class="px-3 py-2 text-left font-medium">API</th>
          <th class="px-3 py-2 text-left font-medium">状态</th>
          <th class="px-3 py-2 text-left font-medium">耗时</th>
          <th class="px-3 py-2 text-left font-medium">错误</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          class="cursor-pointer border-b border-border transition-colors hover:bg-panel2"
          @click="emit('detail', item)"
        >
          <td class="whitespace-nowrap px-3 py-2">{{ formatTime(item.created_at) }}</td>
          <td class="max-w-[120px] truncate px-3 py-2">{{ item.user_email || '-' }}</td>
          <td class="px-3 py-2 font-mono text-[12px]">{{ item.client_ip || '-' }}</td>
          <td class="px-3 py-2">{{ item.operation }}</td>
          <td class="px-3 py-2">{{ item.api_name || '-' }}</td>
          <td :class="['px-3 py-2 font-mono', statusClass(item.response_status)]">
            {{ item.response_status ?? '-' }}
          </td>
          <td class="px-3 py-2 font-mono">{{ item.duration_ms != null ? `${item.duration_ms}ms` : '-' }}</td>
          <td class="max-w-[200px] truncate px-3 py-2 text-danger">
            {{ item.error_message || '-' }}
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="8" class="px-3 py-8 text-center text-subtle">暂无操作日志</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>