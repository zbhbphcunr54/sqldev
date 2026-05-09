<!-- [2026-05-05] 更新：工作台头部 - 完全匹配 UI 预览 -->
<script setup lang="ts">
import { computed } from 'vue'
import { useWorkbenchStore, type Database } from '@/stores/workbench'
import DbPicker from './DbPicker.vue'

const store = useWorkbenchStore()

const isTranslatePage = computed(() => ['ddl', 'func', 'proc'].includes(store.activePage))

const sourceDb = computed<Database>({
  get() {
    if (store.activePage === 'func') return store.funcSourceDb
    if (store.activePage === 'proc') return store.procSourceDb
    return store.sourceDb
  },
  set(value) {
    if (store.activePage === 'func') store.pickDb('funcSourceDb', value)
    else if (store.activePage === 'proc') store.pickDb('procSourceDb', value)
    else store.pickDb('sourceDb', value)
  }
})

const targetDb = computed<Database>({
  get() {
    if (store.activePage === 'func') return store.funcTargetDb
    if (store.activePage === 'proc') return store.procTargetDb
    return store.targetDb
  },
  set(value) {
    if (store.activePage === 'func') store.pickDb('funcTargetDb', value)
    else if (store.activePage === 'proc') store.pickDb('procTargetDb', value)
    else store.pickDb('targetDb', value)
  }
})

function handleTranslate(): void {
  store.convert()
}

function handleSwap(): void {
  if (store.activePage === 'func') {
    store.swapFuncDbs()
    return
  }
  if (store.activePage === 'proc') {
    store.swapProcDbs()
    return
  }
  store.swapDbs()
}
</script>

<template>
  <header class="wb-header">
    <!-- Left: Title -->
    <div class="wb-header-left">
      <h1 class="wb-title">{{ store.currentPageTitle }}</h1>
      <span class="wb-subtitle">{{ store.currentPageSubtitle }}</span>
    </div>

    <!-- Center: SQL Type + Database Selectors -->
    <div v-if="isTranslatePage" class="wb-header-center">
      <DbPicker
        v-model="sourceDb"
        dropdown-key="workbench-source"
        :db-options="store.DB_OPTIONS"
        :db-abbr="store.DB_ABBR"
      />

      <!-- Swap Button -->
      <button
        class="swap-btn"
        title="交换源和目标数据库"
        aria-label="交换源和目标数据库"
        @click="handleSwap"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M10 4L12 6L10 8"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M12 6H4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <path
            d="M4 10L2 8L4 6"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M2 8H10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
        </svg>
      </button>

      <DbPicker
        v-model="targetDb"
        dropdown-key="workbench-target"
        :db-options="store.DB_OPTIONS"
        :db-abbr="store.DB_ABBR"
      />
    </div>

    <!-- Right: Actions -->
    <div class="wb-header-right">
      <button
        class="btn primary"
        :disabled="store.converting || !store.canConvert"
        aria-label="执行 SQL 翻译"
        @click="handleTranslate"
      >
        {{ store.converting ? '翻译中...' : '翻译' }}
        <kbd>{{ store.primaryShortcutLabel }}</kbd>
      </button>
    </div>
  </header>
</template>

<style scoped>
.wb-header {
  height: 56px;
  padding: 0 16px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.wb-header-left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.wb-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.2;
}

.wb-subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  line-height: 1.2;
}

.wb-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-header-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* Swap Button */
.swap-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  transition: all 0.15s;
  background: var(--color-panel-2);
  cursor: pointer;
}

.swap-btn:hover {
  color: var(--color-brand-500);
  border-color: var(--color-brand-500);
  background: var(--color-brand-50);
}

.swap-btn:focus-visible {
  color: var(--color-brand-500);
  border-color: var(--color-brand-500);
  background: var(--color-brand-50);
}

/* Buttons */
.btn {
  padding: 7px 15px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover {
  background: var(--color-panel-2);
  border-color: var(--color-border-hover);
}

.btn:focus-visible {
  background: var(--color-panel-2);
  border-color: var(--color-border-hover);
}

.btn.primary {
  border: none;
  background: var(--gradient-brand-primary);
  color: #fff;
  box-shadow: var(--shadow-brand-primary);
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-primary-hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

kbd {
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 10px;
  font-family: var(--font-code);
}
</style>
