<!-- [2026-05-04] 更新：操作日志表格，匹配设计预览 -->
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

function getStatusBadge(status: number | null): { class: string; label: string } {
  if (status === null) return { class: 'gray', label: '-' }
  if (status === 200) return { class: 'green', label: '200' }
  if (status === 201) return { class: 'green', label: '201' }
  if (status === 400) return { class: 'orange', label: '400' }
  if (status === 401) return { class: 'orange', label: '401' }
  if (status === 429) return { class: 'orange', label: '429' }
  if (status >= 500) return { class: 'red', label: String(status) }
  return { class: 'gray', label: String(status) }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}
</script>

<template>
  <div class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th style="width: 160px;">时间</th>
          <th style="width: 100px;">用户</th>
          <th style="width: 120px;">IP 地址</th>
          <th style="width: 120px;">操作类型</th>
          <th style="width: 100px;">API 名称</th>
          <th style="width: 80px;">状态码</th>
          <th style="width: 100px;">耗时</th>
          <th>错误信息</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.id"
          @click="emit('detail', item)"
        >
          <td>
            <code class="time-code">{{ formatTime(item.created_at) }}</code>
          </td>
          <td>
            <span class="user-email">{{ item.user_email || '-' }}</span>
          </td>
          <td>
            <code class="ip-code">{{ item.client_ip || '-' }}</code>
          </td>
          <td>
            <span class="operation-label">{{ item.operation }}</span>
          </td>
          <td>
            <code class="api-code">{{ item.api_name || '-' }}</code>
          </td>
          <td>
            <span :class="['badge', getStatusBadge(item.response_status).class]">
              {{ getStatusBadge(item.response_status).label }}
            </span>
          </td>
          <td>
            <span class="duration">{{ formatDuration(item.duration_ms) }}</span>
          </td>
          <td>
            <span v-if="item.error_message" class="error-message">{{ item.error_message }}</span>
            <span v-else class="no-error">-</span>
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="8">
            <div class="empty-state">
              <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path d="M12 6v6l4 2"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
              <p class="empty-title">暂无操作日志</p>
              <p class="empty-desc">没有找到符合条件的记录</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-container {
  background: var(--color-panel);
  margin: 0;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 10px 16px;
  text-align: left;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-subtle);
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.data-table tr {
  cursor: pointer;
  transition: background 0.15s;
}

.data-table tr:hover td {
  background: var(--color-panel-2);
}

.data-table tr:last-child td {
  border-bottom: none;
}

.time-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-text);
}

.user-email {
  color: var(--color-text);
}

.ip-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.operation-label {
  color: var(--color-text);
}

.api-code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-text-subtle);
  background: var(--color-panel-2);
  padding: 2px 6px;
  border-radius: 4px;
}

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'JetBrains Mono', monospace;
}

.badge.green {
  background: rgba(21, 145, 95, 0.1);
  color: var(--color-success);
}

.badge.orange {
  background: rgba(183, 121, 31, 0.1);
  color: var(--color-warning);
}

.badge.red {
  background: rgba(214, 69, 69, 0.1);
  color: var(--color-danger);
}

.badge.gray {
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.duration {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.error-message {
  color: var(--color-danger);
  font-size: 12px;
}

.no-error {
  color: var(--color-text-subtle);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-subtle);
}

.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 12px;
  margin: 0;
}
</style>
