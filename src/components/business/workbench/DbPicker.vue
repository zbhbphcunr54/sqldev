<!-- [2026-05-03] 新增：数据库选择器 -->
<script setup lang="ts">
import { ref } from 'vue'
import { useWorkbenchStore, type Database } from '@/stores/workbench'

const props = defineProps<{
  modelValue: Database
  dropdownKey: string
  dbOptions: { value: Database; label: string; abbr: string }[]
  dbAbbr: Record<Database, string>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Database]
}>()

const store = useWorkbenchStore()

const isOpen = ref(false)

function toggleDropdown(): void {
  if (store.dbDropdown === props.dropdownKey) {
    store.dbDropdown = ''
  } else {
    store.dbDropdown = props.dropdownKey
  }
  isOpen.value = store.dbDropdown === props.dropdownKey
}

function selectOption(value: Database): void {
  emit('update:modelValue', value)
  store.dbDropdown = ''
  isOpen.value = false
}

function getLabel(value: Database): string {
  return props.dbOptions.find(d => d.value === value)?.label ?? ''
}

function getAbbr(value: Database): string {
  return props.dbAbbr[value] ?? ''
}

// Close dropdown when clicking outside
function handleClickOutside(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (!target.closest('.db-picker')) {
    store.dbDropdown = ''
    isOpen.value = false
  }
}
</script>

<template>
  <div class="db-picker" :class="{ open: isOpen }" @click="toggleDropdown">
    <button class="db-picker-trigger" type="button" :aria-label="'选择数据库'">
      <span class="db-picker-icon" :class="modelValue">{{ getAbbr(modelValue) }}</span>
      <span class="db-picker-name">{{ getLabel(modelValue) }}</span>
      <svg class="db-picker-chevron" width="10" height="10" viewBox="0 0 10 10">
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </button>

    <div class="db-picker-dropdown" v-show="isOpen">
      <button
        v-for="db in dbOptions"
        :key="db.value"
        class="db-picker-option"
        :class="{ selected: modelValue === db.value }"
        @click.stop="selectOption(db.value)"
        type="button"
      >
        <span class="db-picker-icon" :class="db.value">{{ db.abbr }}</span>
        <span>{{ db.label }}</span>
        <svg v-if="modelValue === db.value" class="db-picker-check" width="14" height="14" viewBox="0 0 14 14">
          <path d="M3 7.5L5.5 10L11 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.db-picker {
  position: relative;
}

.db-picker-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.db-picker-trigger:hover {
  border-color: var(--color-brand-500);
  background: var(--color-panel-2);
}

.db-picker.open .db-picker-trigger {
  border-color: var(--color-brand-500);
}

.db-picker-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: white;
}

.db-picker-icon.oracle {
  background: #f44336;
}

.db-picker-icon.mysql {
  background: #00758f;
}

.db-picker-icon.postgresql {
  background: #336791;
}

.db-picker-chevron {
  color: var(--color-text-subtle);
  transition: transform 0.15s;
}

.db-picker.open .db-picker-chevron {
  transform: rotate(180deg);
}

.db-picker-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 160px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  box-shadow: var(--shadow-panel);
  z-index: 100;
}

.db-picker-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.db-picker-option:hover {
  background: var(--color-panel-2);
}

.db-picker-option.selected {
  background: var(--color-brand-50);
  color: var(--color-brand-500);
}

.db-picker-check {
  margin-left: auto;
  color: var(--color-brand-500);
}
</style>
