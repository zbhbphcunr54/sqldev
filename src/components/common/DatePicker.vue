<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  placeholder?: string
  compact?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

interface CalendarDay {
  key: string
  value: string
  day: number
  currentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']
const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownPos = ref<{ top: number; left: number; width: number } | null>(null)

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDateString(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getToday(): Date {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate())
}

const selectedDate = computed(() => parseDateString(props.modelValue))
const selectedLabel = computed(() => props.modelValue || '')
const today = computed(() => getToday())

const viewYear = ref(selectedDate.value?.getFullYear() ?? today.value.getFullYear())
const viewMonth = ref(selectedDate.value?.getMonth() ?? today.value.getMonth())

function syncViewToSelected(): void {
  const base = selectedDate.value ?? today.value
  viewYear.value = base.getFullYear()
  viewMonth.value = base.getMonth()
}

watch(
  () => props.modelValue,
  () => {
    if (!open.value) syncViewToSelected()
  }
)

watch(open, async (value) => {
  if (value && triggerRef.value) {
    syncViewToSelected()
    await nextTick()
    const rect = triggerRef.value.getBoundingClientRect()
    dropdownPos.value = {
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 288)
    }
  } else {
    dropdownPos.value = null
  }
})

const calendarDays = computed<CalendarDay[]>(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  const weekOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(viewYear.value, viewMonth.value, 1 - weekOffset)
  const items: CalendarDay[] = []

  for (let index = 0; index < 42; index += 1) {
    const current = new Date(startDate)
    current.setDate(startDate.getDate() + index)
    const value = toDateString(current)
    items.push({
      key: value,
      value,
      day: current.getDate(),
      currentMonth: current.getMonth() === viewMonth.value,
      isToday: isSameDate(current, today.value),
      isSelected: value === props.modelValue
    })
  }

  return items
})

function toggleOpen(): void {
  if (props.disabled) return
  open.value = !open.value
}

function closeDropdown(): void {
  open.value = false
}

function selectDate(value: string): void {
  emit('update:modelValue', value)
  closeDropdown()
}

function selectToday(): void {
  emit('update:modelValue', toDateString(today.value))
  closeDropdown()
}

function clearDate(): void {
  emit('update:modelValue', '')
  closeDropdown()
}

function shiftMonth(offset: number): void {
  const nextMonth = new Date(viewYear.value, viewMonth.value + offset, 1)
  viewYear.value = nextMonth.getFullYear()
  viewMonth.value = nextMonth.getMonth()
}

function onDocumentClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  if (triggerRef.value?.contains(target) || dropdownRef.value?.contains(target)) return
  closeDropdown()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && open.value) {
    closeDropdown()
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
  <div class="date-picker-wrapper" :class="{ compact: props.compact }">
    <button
      ref="triggerRef"
      type="button"
      class="date-picker-trigger"
      :class="{ compact: props.compact, open, disabled: props.disabled }"
      :disabled="props.disabled"
      @click="toggleOpen"
    >
      <svg
        class="date-picker-icon"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
      <span class="trigger-label" :class="{ placeholder: !selectedLabel }">
        {{ selectedLabel || placeholder || '选择日期' }}
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
        class="date-picker-dropdown"
        :style="{
          top: dropdownPos.top + 'px',
          left: dropdownPos.left + 'px',
          width: dropdownPos.width + 'px'
        }"
      >
        <div class="date-picker-head">
          <button type="button" class="nav-btn" @click="shiftMonth(-1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div class="head-title">{{ viewYear }}年 {{ viewMonth + 1 }}月</div>
          <button type="button" class="nav-btn" @click="shiftMonth(1)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div class="date-picker-weekdays">
          <span v-for="label in weekLabels" :key="label" class="weekday-cell">{{ label }}</span>
        </div>

        <div class="date-picker-grid">
          <button
            v-for="item in calendarDays"
            :key="item.key"
            type="button"
            class="day-cell"
            :class="{
              'day-cell--muted': !item.currentMonth,
              'day-cell--today': item.isToday,
              'day-cell--selected': item.isSelected
            }"
            @click="selectDate(item.value)"
          >
            {{ item.day }}
          </button>
        </div>

        <div class="date-picker-footer">
          <button type="button" class="footer-btn" @click="selectToday">今天</button>
          <button type="button" class="footer-btn" @click="clearDate">清空</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.date-picker-wrapper {
  position: relative;
  width: 100%;
}

.date-picker-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 42px;
  padding: 0 12px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.date-picker-trigger:hover {
  border-color: var(--color-border-hover);
}

.date-picker-trigger:focus,
.date-picker-trigger.open {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.date-picker-trigger.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.date-picker-icon,
.trigger-arrow {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.trigger-arrow {
  transition: transform 0.15s ease;
}

.trigger-arrow.rotated {
  transform: rotate(180deg);
}

.trigger-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-family: var(--font-body);
}

.trigger-label.placeholder {
  color: var(--color-text-muted);
}

.date-picker-dropdown {
  position: fixed;
  z-index: 10000;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

.date-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

.head-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: background 0.12s ease;
}

.nav-btn:hover {
  background: var(--color-panel);
  color: var(--color-text);
}

.date-picker-weekdays,
.date-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.date-picker-weekdays {
  padding: 8px 10px 0;
}

.weekday-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.date-picker-grid {
  gap: 2px;
  padding: 6px 10px 10px;
}

.day-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.day-cell:hover {
  background: var(--color-panel-2);
}

.day-cell--muted {
  color: var(--color-text-muted);
}

.day-cell--today {
  color: var(--color-accent);
  font-weight: 600;
}

.day-cell--selected {
  background: var(--color-accent);
  color: var(--color-btn-primary-text);
  font-weight: 600;
}

.day-cell--selected:hover {
  background: var(--color-accent-hover);
}

.date-picker-footer {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--color-border);
}

.footer-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 64px;
  height: 30px;
  padding: 0 10px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s ease;
}

.footer-btn:hover {
  border-color: var(--color-border-hover);
  background: var(--color-panel);
}

.date-picker-wrapper.compact .date-picker-trigger,
.date-picker-trigger.compact {
  height: 32px;
  border-radius: 6px;
}

.date-picker-trigger.compact .trigger-label {
  font-size: 12px;
}
</style>
