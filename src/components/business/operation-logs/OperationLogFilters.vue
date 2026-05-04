<script setup lang="ts">
import { ref, computed } from 'vue'

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
  { value: '', label: '全部操作' },
  { value: 'convert_ddl', label: 'DDL 转换' },
  { value: 'convert_func', label: '函数转换' },
  { value: 'convert_proc', label: '存储过程转换' },
  { value: 'rule_read', label: '读取规则' },
  { value: 'rule_save', label: '保存规则' },
  { value: 'rule_reset', label: '重置规则' },
  { value: 'ziwei_history_list', label: '紫微历史查询' },
  { value: 'ziwei_history_create', label: '紫微历史创建' },
  { value: 'ziwei_ai_analysis', label: 'AI 解盘' },
  { value: 'feedback_submit', label: '反馈提交' }
]

const API_OPTIONS = [
  { value: '', label: '全部 API' },
  { value: 'convert', label: 'convert' },
  { value: 'rules', label: 'rules' },
  { value: 'ziwei-history', label: 'ziwei-history' },
  { value: 'ziwei-analysis', label: 'ziwei-analysis' },
  { value: 'feedback', label: 'feedback' }
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
  <div class="flex flex-wrap items-end gap-3 rounded-card border border-border bg-panel p-3">
    <div class="flex min-w-[140px] flex-col gap-1">
      <label class="text-[12px] text-subtle">操作类型</label>
      <select
        v-model="localOperation"
        class="h-8 rounded-control border border-border bg-panel2 px-2 text-[13px] text-text"
      >
        <option v-for="opt in OPERATION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="flex min-w-[140px] flex-col gap-1">
      <label class="text-[12px] text-subtle">API 名称</label>
      <select
        v-model="localApiName"
        class="h-8 rounded-control border border-border bg-panel2 px-2 text-[13px] text-text"
      >
        <option v-for="opt in API_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="flex min-w-[150px] flex-col gap-1">
      <label class="text-[12px] text-subtle">开始日期</label>
      <input
        v-model="localStartDate"
        type="date"
        class="h-8 rounded-control border border-border bg-panel2 px-2 text-[13px] text-text"
      />
    </div>

    <div class="flex min-w-[150px] flex-col gap-1">
      <label class="text-[12px] text-subtle">结束日期</label>
      <input
        v-model="localEndDate"
        type="date"
        class="h-8 rounded-control border border-border bg-panel2 px-2 text-[13px] text-text"
      />
    </div>

    <div class="flex gap-2">
      <button
        class="h-8 rounded-control bg-brand-500 px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-600"
        @click="handleSearch"
      >
        查询
      </button>
      <button
        class="h-8 rounded-control border border-border bg-panel2 px-4 text-[13px] text-text transition-colors hover:bg-panel"
        @click="handleReset"
      >
        重置
      </button>
    </div>
  </div>
</template>