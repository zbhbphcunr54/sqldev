<!-- [2026-05-04] 更新：操作日志筛选器，匹配设计预览 -->
<script setup lang="ts">
import { ref } from 'vue'
import FormSelect from '@/components/common/FormSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'

const props = defineProps<{
  operation?: string
  startDate?: string
  endDate?: string
}>()

const emit = defineEmits<{
  search: [filters: { operation?: string; startDate?: string; endDate?: string }]
}>()

const localOperation = ref(props.operation || '')
const localStartDate = ref(props.startDate || '')
const localEndDate = ref(props.endDate || '')

const OPERATION_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'sql_convert', label: 'SQL AI转换' },
  { value: 'id_card_generate', label: '身份证号码生成' },
  { value: 'id_card_validate', label: '身份证号码校验' },
  { value: 'uscc_generate', label: '统一社会信用代码生成' },
  { value: 'uscc_validate', label: '统一社会信用代码校验' },
  { value: 'ziwei_chart_generate', label: '紫微斗数排盘' },
  { value: 'ziwei_analysis', label: '命盘AI解读' },
  { value: 'ziwei_qa', label: '基于AI命盘问答' },
  { value: 'ai_provider_create', label: '新增供应商' },
  { value: 'ai_provider_update', label: '编辑供应商' },
  { value: 'ai_provider_delete', label: '删除供应商' },
  { value: 'ai_config_create', label: '新增Key' },
  { value: 'ai_config_append_model', label: '追加模型' },
  { value: 'ai_config_test', label: '测试Key' },
  { value: 'ai_config_delete', label: '删除Key' },
  { value: 'ai_chat_message', label: 'AI助手对话' }
]

function handleSearch(): void {
  emit('search', {
    operation: localOperation.value || undefined,
    startDate: localStartDate.value || undefined,
    endDate: localEndDate.value || undefined
  })
}

function handleReset(): void {
  localOperation.value = ''
  localStartDate.value = ''
  localEndDate.value = ''
  emit('search', {})
}
</script>

<template>
  <div class="filter-bar">
    <div class="filter-group">
      <span class="filter-label">操作类型</span>
      <FormSelect
        v-model="localOperation"
        :options="OPERATION_OPTIONS"
        placeholder="全部"
        compact
      />
    </div>

    <div class="filter-divider"></div>

    <div class="filter-group">
      <span class="filter-label">日期范围</span>
      <DatePicker
        v-model="localStartDate"
        placeholder="开始日期"
        compact
        class="filter-date-picker"
      />
      <span class="filter-separator">至</span>
      <DatePicker
        v-model="localEndDate"
        placeholder="结束日期"
        compact
        class="filter-date-picker"
      />
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

.filter-date-picker {
  width: 144px;
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
