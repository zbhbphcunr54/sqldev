<script setup lang="ts">
import type { OperationLog } from '@/api/operation-logs'

const props = defineProps<{
  log: OperationLog | null
}>()

const emit = defineEmits<{
  close: []
}>()

function formatJson(obj: unknown): string {
  if (!obj) return '-'
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', { hour12: false })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="log"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="emit('close')"
    >
      <div
        class="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-card border border-border bg-panel p-5 shadow-xl"
      >
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold">操作日志详情</h3>
          <button
            class="h-8 w-8 rounded-control text-subtle transition-colors hover:bg-panel2 hover:text-text"
            @click="emit('close')"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3 text-[13px]">
          <div class="grid grid-cols-[80px_1fr] gap-x-3 gap-y-2">
            <span class="text-subtle">时间</span>
            <span>{{ formatTime(log.created_at) }}</span>

            <span class="text-subtle">用户</span>
            <span>{{ log.user_email || '-' }}</span>

            <span class="text-subtle">IP</span>
            <span class="font-mono">{{ log.client_ip || '-' }}</span>

            <span class="text-subtle">操作</span>
            <span>{{ log.operation }}</span>

            <span class="text-subtle">API</span>
            <span>{{ log.api_name || '-' }}</span>

            <span class="text-subtle">状态码</span>
            <span :class="log.response_status && log.response_status < 400 ? 'text-success' : 'text-danger'">
              {{ log.response_status ?? '-' }}
            </span>

            <span class="text-subtle">耗时</span>
            <span class="font-mono">{{ log.duration_ms != null ? `${log.duration_ms}ms` : '-' }}</span>
          </div>

          <div v-if="log.error_message" class="rounded-control bg-danger/10 p-3 text-danger">
            {{ log.error_message }}
          </div>

          <div>
            <div class="mb-1 text-subtle">上送报文</div>
            <pre class="max-h-40 overflow-auto rounded-control bg-panel2 p-3 text-[12px]">{{ formatJson(log.request_body) }}</pre>
          </div>

          <div>
            <div class="mb-1 text-subtle">返回报文</div>
            <pre class="max-h-40 overflow-auto rounded-control bg-panel2 p-3 text-[12px]">{{ formatJson(log.response_body) }}</pre>
          </div>

          <div v-if="log.extra">
            <div class="mb-1 text-subtle">扩展字段</div>
            <pre class="max-h-32 overflow-auto rounded-control bg-panel2 p-3 text-[12px]">{{ formatJson(log.extra) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>