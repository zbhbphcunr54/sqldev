<!-- [2026-05-04] 更新：数据库选择器 - 匹配UI预览设计 -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
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

const pickerRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const optionRefs = ref<(HTMLButtonElement | null)[]>([])
const dropdownId = `db-picker-${props.dropdownKey}-listbox`
const isOpen = computed(() => store.dbDropdown === props.dropdownKey)

function closeDropdown(): void {
  store.dbDropdown = ''
}

function openDropdown(): void {
  store.dbDropdown = props.dropdownKey
}

function toggleDropdown(): void {
  if (isOpen.value) {
    closeDropdown()
    return
  }
  openDropdown()
}

function selectOption(value: Database): void {
  emit('update:modelValue', value)
  closeDropdown()
  triggerRef.value?.focus()
}

function getLabel(value: Database): string {
  return props.dbOptions.find(d => d.value === value)?.label ?? ''
}

function getAbbr(value: Database): string {
  return props.dbAbbr[value] ?? ''
}

function focusOption(index: number): void {
  nextTick(() => {
    optionRefs.value[index]?.focus()
  })
}

function handleTriggerKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (!isOpen.value) {
      openDropdown()
    }
    focusOption(0)
  } else if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    closeDropdown()
  }
}

function handleOptionKeydown(event: KeyboardEvent, index: number): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusOption((index + 1) % props.dbOptions.length)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusOption((index - 1 + props.dbOptions.length) % props.dbOptions.length)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusOption(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusOption(props.dbOptions.length - 1)
  } else if (event.key === 'Escape') {
    event.preventDefault()
    closeDropdown()
    triggerRef.value?.focus()
  }
}

function handleClickOutside(event: MouseEvent): void {
  const target = event.target as Node
  if (!pickerRef.value?.contains(target)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="pickerRef" class="db-picker" :class="{ open: isOpen }">
    <button
      ref="triggerRef"
      class="db-picker-trigger"
      type="button"
      :aria-label="'选择数据库'"
      aria-haspopup="listbox"
      :aria-expanded="String(isOpen)"
      :aria-controls="dropdownId"
      @click="toggleDropdown"
      @keydown="handleTriggerKeydown"
    >
      <span class="db-picker-icon" :class="modelValue">{{ getAbbr(modelValue) }}</span>
      <span class="db-picker-name">{{ getLabel(modelValue) }}</span>
      <svg class="db-picker-chevron" width="10" height="10" viewBox="0 0 10 10">
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      </svg>
    </button>

    <div :id="dropdownId" class="db-picker-dropdown" v-show="isOpen" role="listbox">
      <button
        v-for="(db, index) in dbOptions"
        :key="db.value"
        :ref="(el) => (optionRefs[index] = el as HTMLButtonElement | null)"
        class="db-picker-option"
        :class="{ selected: modelValue === db.value }"
        role="option"
        :aria-selected="modelValue === db.value"
        @click.stop="selectOption(db.value)"
        @keydown="handleOptionKeydown($event, index)"
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
  padding: 5px 12px 5px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.db-picker-trigger:hover {
  border-color: var(--color-border-hover);
}

.db-picker.open .db-picker-trigger {
  border-color: var(--color-brand-500);
}

.db-picker-trigger:focus-visible {
  border-color: var(--color-brand-500);
}

.db-picker-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 20px;
  border-radius: 6px;
  font-family: var(--font-code);
  font-size: 10px;
  font-weight: 700;
  color: white;
}

.db-picker-icon.oracle {
  background: var(--gradient-db-oracle);
}

.db-picker-icon.mysql {
  background: var(--gradient-db-mysql);
}

.db-picker-icon.postgresql {
  background: var(--gradient-db-postgresql);
}

.db-picker-chevron {
  color: var(--color-text-muted);
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

.db-picker-option:focus-visible {
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
