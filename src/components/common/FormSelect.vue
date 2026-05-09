<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  options: { value: string; label: string }[]
  modelValue: string
  placeholder?: string
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownPos = ref<{ top: number; left: number; width: number } | null>(null)

const selectedLabel = computed(() => {
  const opt = props.options.find((o) => o.value === props.modelValue)
  return opt?.label ?? ''
})

function onTriggerClick(): void {
  open.value = !open.value
}

watch(open, async (val) => {
  if (val && triggerRef.value) {
    await nextTick()
    const rect = triggerRef.value.getBoundingClientRect()
    dropdownPos.value = {
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    }
  } else {
    dropdownPos.value = null
  }
})

function onSelect(value: string): void {
  emit('update:modelValue', value)
  open.value = false
}

function onDocumentClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (triggerRef.value?.contains(target) || dropdownRef.value?.contains(target)) return
  open.value = false
}

function onDocumentKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    open.value = false
    triggerRef.value?.focus()
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div class="form-select-wrapper" :class="{ compact: props.compact }">
    <button
      ref="triggerRef"
      type="button"
      class="form-select-trigger"
      :class="{ open, compact: props.compact }"
      @click="onTriggerClick"
    >
      <span class="trigger-label" :class="{ placeholder: !selectedLabel }">
        {{ selectedLabel || placeholder || '请选择' }}
      </span>
      <svg
        class="trigger-arrow"
        :class="{ rotated: open }"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
    <Teleport to="body">
      <div
        v-if="open && dropdownPos"
        ref="dropdownRef"
        class="form-select-dropdown"
        :style="{
          top: dropdownPos.top + 'px',
          left: dropdownPos.left + 'px',
          width: dropdownPos.width + 'px'
        }"
      >
        <div class="dropdown-list">
          <button
            v-for="opt in options"
            :key="opt.value"
            type="button"
            class="dropdown-option"
            :class="{ selected: opt.value === modelValue }"
            @click="onSelect(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.form-select-wrapper {
  position: relative;
  width: 100%;
}

.form-select-trigger {
  height: 42px;
  width: 100%;
  padding: 0 14px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: all 0.15s ease;
  text-align: left;
  box-sizing: border-box;
}

.form-select-trigger:hover {
  border-color: var(--color-border-hover);
}

.form-select-trigger:focus,
.form-select-trigger.open {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.trigger-label.placeholder {
  color: var(--color-text-muted);
}

.trigger-arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
  transition: transform 0.15s ease;
}

.trigger-arrow.rotated {
  transform: rotate(180deg);
}

.form-select-dropdown {
  position: fixed;
  z-index: 10000;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.dropdown-list {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
}

.dropdown-list::-webkit-scrollbar {
  width: var(--scrollbar-size, 6px);
}

.dropdown-list::-webkit-scrollbar-track {
  background: var(--scrollbar-track, transparent);
}

.dropdown-list::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: var(--scrollbar-radius, 3px);
}

.dropdown-list::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}

.dropdown-option {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text);
  font-size: 14px;
  font-family: var(--font-body);
  cursor: pointer;
  text-align: left;
  transition: background 0.1s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-option:hover {
  background: var(--color-panel-2);
}

.dropdown-option.selected {
  color: var(--color-accent);
  font-weight: 500;
}

/* ============ Compact variant ============ */
.form-select-wrapper.compact .form-select-trigger,
.form-select-trigger.compact {
  height: 32px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 6px;
}

.form-select-trigger.compact .trigger-label {
  text-align: center;
}
</style>
