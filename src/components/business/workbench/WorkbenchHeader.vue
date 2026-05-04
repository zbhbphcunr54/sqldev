<!-- [2026-05-03] 新增：工作台头部 -->
<script setup lang="ts">
import { useWorkbenchStore } from '@/stores/workbench'
import DbPicker from './DbPicker.vue'

const store = useWorkbenchStore()
</script>

<template>
  <header class="workbench-header">
    <div class="header-left">
      <button
        class="menu-toggle"
        type="button"
        aria-controls="workbench-sidebar"
        :aria-expanded="String(store.sidebarOpen)"
        @click="store.sidebarOpen = !store.sidebarOpen"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
      <div>
        <h1 class="title">{{ store.currentPageTitle }}</h1>
        <p class="subtitle">{{ store.currentPageSubtitle }}</p>
      </div>
    </div>

    <div class="header-center" v-if="store.activePage === 'ddl'">
      <DbPicker
        :modelValue="store.sourceDb"
        dropdownKey="ddl-src"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('sourceDb', $event)"
      />
      <button class="swap-btn" @click="store.swapDbs()" title="交换源和目标">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M17 4l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 12a5 5 0 015-5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M7 20l-3-3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M21 12a5 5 0 01-5 5H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <DbPicker
        :modelValue="store.targetDb"
        dropdownKey="ddl-tgt"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('targetDb', $event)"
      />
    </div>

    <div class="header-center" v-else-if="store.activePage === 'func'">
      <DbPicker
        :modelValue="store.funcSourceDb"
        dropdownKey="func-src"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('funcSourceDb', $event)"
      />
      <button class="swap-btn" @click="store.swapFuncDbs()" title="交换源和目标">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M17 4l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 12a5 5 0 015-5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M7 20l-3-3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M21 12a5 5 0 01-5 5H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <DbPicker
        :modelValue="store.funcTargetDb"
        dropdownKey="func-tgt"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('funcTargetDb', $event)"
      />
    </div>

    <div class="header-center" v-else-if="store.activePage === 'proc'">
      <DbPicker
        :modelValue="store.procSourceDb"
        dropdownKey="proc-src"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('procSourceDb', $event)"
      />
      <button class="swap-btn" @click="store.swapProcDbs()" title="交换源和目标">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M17 4l3 3-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M3 12a5 5 0 015-5h12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <path d="M7 20l-3-3 3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M21 12a5 5 0 01-5 5H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <DbPicker
        :modelValue="store.procTargetDb"
        dropdownKey="proc-tgt"
        :dbOptions="store.DB_OPTIONS"
        :dbAbbr="store.DB_ABBR"
        @update:modelValue="store.pickDb('procTargetDb', $event)"
      />
    </div>

    <div class="version-box">
      <button class="btn-back-home" type="button" @click="$router.push('/')">
        返回首页
      </button>
      <button
        v-if="store.isWorkbenchPage"
        class="btn-translate"
        :disabled="store.converting || !store.canConvert"
        @click="store.convert()"
      >
        {{ store.converting ? '翻译中...' : '开始翻译' }}
        <span class="kbd">{{ store.primaryShortcutLabel }}</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.workbench-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.menu-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: background 0.15s;
}

.menu-toggle:hover {
  background: var(--color-panel-2);
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.header-center {
  display: flex;
  align-items: center;
  gap: 8px;
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.swap-btn:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.version-box {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back-home {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.btn-back-home:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.btn-translate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--color-brand-500);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-translate:hover {
  background: var(--color-brand-600);
}

.kbd {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.2);
  font-size: 11px;
  font-family: monospace;
}

/* Mobile */
@media (max-width: 768px) {
  .header-center {
    display: none;
  }
}
</style>
