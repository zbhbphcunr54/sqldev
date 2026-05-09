<!-- [2026-05-04] 更新：操作日志筛选器，匹配设计预览 -->
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  operation?: string
  apiName?: string
  startDate?: string
  endDate?: string
}>()

const emit = defineEmits<{
  search: [filters: { operation?: string; apiName?: string; startDate?: string; endDate?: string }]
}>()

const localOperation = ref(props.operation || '')
const localApiName = ref(props.apiName || '')
const localStartDate = ref(props.startDate || '')
const localEndDate = ref(props.endDate || '')

const OPERATION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'convert_ddl', label: 'DDL 翻译' },
  { value: 'convert_func', label: '函数翻译' },
  { value: 'convert_proc', label: '存储过程翻译' },
  { value: 'convert_verify', label: 'AI 校验' },
  { value: 'rule_read', label: '读取规则' },
  { value: 'rule_save', label: '保存规则' },
  { value: 'rule_reset', label: '重置规则' },
  { value: 'ziwei_analysis', label: '紫微分析' },
  { value: 'ziwei_history_list', label: '紫微历史查询' }
]

const API_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'convert', label: 'convert' },
  { value: 'convert-verify', label: 'convert-verify' },
  { value: 'rules', label: 'rules' },
  { value: 'ziwei-analysis', label: 'ziwei-analysis' },
  { value: 'ziwei-history', label: 'ziwei-history' },
  { value: 'feedback', label: 'feedback' },
  { value: 'ai-config', label: 'ai-config' },
  { value: 'app-config', label: 'app-config' },
  { value: 'operation-logs', label: 'operation-logs' }
]

function handleSearch(): void {
  emit('search', {
    operation: localOperation.value || undefined,
    apiName: localApiName.value || undefined,
    startDate: localStartDate.value || undefined,
    endDate: localEndDate.value || undefined
  })
}

function handleReset(): void {
  localOperation.value = ''
  localApiName.value = ''
  localStartDate.value = ''
  localEndDate.value = ''
  emit('search', {})
}
</script>

<template>
  <div class="filter-bar">
    <div class="filter-group">
      <span class="filter-label">操作类型</span>
      <select v-model="localOperation" class="filter-select">
        <option v-for="opt in OPERATION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="filter-divider"></div>

    <div class="filter-group">
      <span class="filter-label">API 名称</span>
      <select v-model="localApiName" class="filter-select">
        <option v-for="opt in API_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="filter-divider"></div>

    <div class="filter-group">
      <span class="filter-label">日期范围</span>
      <input v-model="localStartDate" type="date" class="filter-input" style="width: 140px" />
      <span class="filter-separator">至</span>
      <input v-model="localEndDate" type="date" class="filter-input" style="width: 140px" />
    </div>

    <div class="filter-spacer"></div>

    <div class="filter-actions">
      <button class="btn" @click="handleReset">重置</button>
      <button class="btn primary" @click="handleSearch">查询</button>
    </div>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-label {
  font-size: 12px;
  color: var(--color-text-subtle);
}

.filter-select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  min-width: 100px;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.filter-input {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 12px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: 0 0 0 3px rgba(47, 107, 255, 0.1);
}

.filter-separator {
  font-size: 12px;
  color: var(--color-text-subtle);
}

.filter-divider {
  width: 1px;
  height: 24px;
  background: var(--color-border);
}

.filter-spacer {
  flex: 1;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

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
  background: var(--color-panel);
}

.btn.primary {
  border-color: var(--color-brand-500);
  background: var(--color-brand-500);
  color: white;
}

.btn.primary:hover {
  background: var(--color-brand-600);
}
</style>
