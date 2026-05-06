<!-- [2026-05-04] 更新：配置列表组件，匹配设计预览 -->
<script setup lang="ts">
import type { AppConfig } from '@/features/app-config'
import { VALUE_TYPE_LABELS } from '@/features/app-config'

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
  if (config.value_type === 'boolean') return config.value === 'true' ? 'true' : 'false'
  if (config.value_type === 'jsonb') {
    try {
      const parsed = JSON.parse(config.value)
      return JSON.stringify(parsed, null, 2).slice(0, 80)
    } catch {
      return config.value.slice(0, 80)
    }
  }
  return config.value.length > 80 ? config.value.slice(0, 80) + '...' : config.value
}

function getValueTypeBadgeClass(type: string): string {
  switch (type) {
    case 'number': return 'blue'
    case 'boolean': return 'purple'
    case 'jsonb': return 'green'
    default: return 'gray'
  }
}
</script>

<template>
  <div class="config-table">
    <table class="data-table">
      <thead>
        <tr>
          <th>配置项</th>
          <th style="width: 200px;">值</th>
          <th style="width: 80px;">类型</th>
          <th style="width: 80px;">状态</th>
          <th v-if="isAdmin" style="width: 100px; text-align: right;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="config in configs" :key="config.id">
          <td>
            <div class="config-key-cell">
              <span class="config-key">{{ config.key }}</span>
              <span class="config-desc">{{ config.description || '无描述' }}</span>
            </div>
          </td>
          <td>
            <code class="config-value" :title="config.value || ''">{{ formatValue(config) }}</code>
          </td>
          <td>
            <span :class="['badge', getValueTypeBadgeClass(config.value_type)]">
              {{ VALUE_TYPE_LABELS[config.value_type] || config.value_type }}
            </span>
          </td>
          <td>
            <span :class="['badge', config.is_active ? 'green' : 'gray']">
              {{ config.is_active ? '启用' : '禁用' }}
            </span>
          </td>
          <td v-if="isAdmin">
            <div class="action-cell">
              <button class="action-btn" title="编辑" @click="emit('edit', config)">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <path d="M10 2l2 2-8 8H2v-2l8-8z"/>
                </svg>
              </button>
              <button class="action-btn delete" title="删除" @click="emit('delete', config.id)">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
                  <path d="M2 4h10M5 2h4M4 4v7h6V4"/>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.config-table {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
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

.data-table tr:last-child td {
  border-bottom: none;
}

.data-table tr:hover td {
  background: var(--color-panel-2);
}

.config-key-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.config-key {
  font-weight: 500;
  color: var(--color-text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

.config-desc {
  font-size: 11px;
  color: var(--color-text-subtle);
}

.config-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--color-text-subtle);
  background: var(--color-panel-2);
  padding: 4px 8px;
  border-radius: 4px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.badge {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.badge.blue {
  background: var(--color-brand-50);
  color: var(--color-brand-500);
}

.badge.purple {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.badge.green {
  background: rgba(21, 145, 95, 0.1);
  color: var(--color-success);
}

.badge.gray {
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.action-cell {
  display: flex;
  gap: 4px;
  justify-content: flex-end;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover {
  background: var(--color-brand-50);
  color: var(--color-brand-500);
}

.action-btn.delete:hover {
  background: rgba(214, 69, 69, 0.1);
  color: var(--color-danger);
}
</style>
