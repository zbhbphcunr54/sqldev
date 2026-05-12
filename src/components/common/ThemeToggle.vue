<script setup lang="ts">
import { useAppStore, type ThemeMode } from '@/stores/app'

withDefaults(
  defineProps<{
    variant?: 'text' | 'icon'
  }>(),
  {
    variant: 'text'
  }
)

const appStore = useAppStore()

const modes: { mode: ThemeMode; label: string }[] = [
  { mode: 'light', label: '浅色' },
  { mode: 'dark', label: '深色' }
]

function setTheme(mode: ThemeMode): void {
  appStore.setTheme(mode)
}
</script>

<template>
  <div class="theme-toggle" :class="`theme-toggle--${variant}`">
    <button
      v-for="m in modes"
      :key="m.mode"
      class="theme-toggle__btn"
      :class="{ active: appStore.themeMode === m.mode }"
      :title="m.label"
      @click="setTheme(m.mode)"
    >
      <!-- Light icon -->
      <svg
        v-if="m.mode === 'light'"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <circle cx="10" cy="10" r="3" />
        <path
          d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42"
          stroke-linecap="round"
        />
      </svg>
      <!-- Dark icon -->
      <svg
        v-if="m.mode === 'dark'"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M17.5 11.5A7.5 7.5 0 1 1 8.5 4a5 5 0 0 0 9 7.5z" stroke-linecap="round" />
      </svg>
      <!-- System icon -->
      <svg
        v-if="m.mode === 'system'"
        width="14"
        height="14"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <rect x="3" y="4" width="14" height="10" rx="2" />
        <path d="M7 18h6M10 14v4" stroke-linecap="round" />
      </svg>
      <span v-if="variant === 'text'" class="theme-toggle__label">{{ m.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.theme-toggle {
  display: flex;
  gap: 2px;
  padding: 3px;
  background: var(--color-panel-2);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
}

.theme-toggle--icon {
  gap: 4px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 0;
}

.theme-toggle__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--duration-fast, 0.15s) ease;
}

.theme-toggle--text .theme-toggle__btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
}

.theme-toggle--icon .theme-toggle__btn {
  flex-direction: column;
  padding: 8px 4px;
  font-size: 11px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  flex: 1;
  justify-content: center;
}

.theme-toggle__btn:hover {
  color: var(--color-text);
}

.theme-toggle--icon .theme-toggle__btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.theme-toggle--text .theme-toggle__btn.active {
  background: var(--color-panel);
  color: var(--color-text);
  box-shadow: var(--shadow-xs);
}

.theme-toggle--icon .theme-toggle__btn.active {
  border-color: var(--color-accent);
  background: var(--color-accent-bg);
  color: var(--color-accent);
}

.theme-toggle__label {
  white-space: nowrap;
}
</style>
