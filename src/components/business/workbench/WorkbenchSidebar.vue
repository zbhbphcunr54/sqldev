<!-- [2026-05-03] 工作台侧边栏导航 -->
<script setup lang="ts">
import { useWorkbenchStore, type WorkbenchPage } from '@/stores/workbench'

const store = useWorkbenchStore()

interface NavItem {
  section: WorkbenchPage
  label: string
}

const navItems: NavItem[] = [
  { section: 'ddl', label: 'DDL 语句' },
  { section: 'func', label: '函数' },
  { section: 'proc', label: '存储过程' }
]

const testToolsItems: NavItem[] = [
  { section: 'idTool', label: '证件号码生成' },
  { section: 'ziweiTool', label: '紫微斗数命盘' }
]

function handleNavClick(section: WorkbenchPage): void {
  store.setPage(section)
  // Close sidebar on mobile
  if (window.innerWidth < 768) {
    store.sidebarOpen = false
  }
}
</script>

<template>
  <aside
    class="sidebar"
    :class="{ 'is-collapsed': store.sidebarCollapsed }"
  >
    <!-- Brand -->
    <div class="sidebar-brand">
      <div class="sidebar-logo">SQL</div>
      <span v-if="!store.sidebarCollapsed" class="sidebar-title">SQL 工作台</span>
    </div>

    <!-- Navigation -->
    <nav class="sidebar-nav">
      <button
        v-for="item in navItems"
        :key="item.section"
        class="nav-item"
        :class="{ active: store.activePage === item.section }"
        @click="handleNavClick(item.section)"
        :title="item.label"
      >
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </span>
        <span v-if="!store.sidebarCollapsed" class="nav-text">{{ item.label }}</span>
      </button>

      <!-- Test Tools Group -->
      <div class="nav-group">
        <button
          class="nav-item nav-parent"
          :class="{ active: store.testToolsExpanded }"
          @click="store.toggleTestToolsMenu()"
        >
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 11.5h6M13 9v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span v-if="!store.sidebarCollapsed" class="nav-text">
            测试工具
            <svg class="caret" :class="{ open: store.testToolsExpanded }" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>

        <div v-if="store.testToolsExpanded && !store.sidebarCollapsed" class="nav-submenu">
          <button
            v-for="item in testToolsItems"
            :key="item.section"
            class="nav-sub-item"
            :class="{ active: store.activePage === item.section }"
            @click="handleNavClick(item.section)"
          >
            <span class="nav-dot"></span>
            {{ item.label }}
          </button>
        </div>
      </div>

      <!-- Settings -->
      <div class="nav-group">
        <button
          class="nav-item nav-parent"
          :class="{ active: store.sidebarSettingsOpen }"
          @click="store.sidebarSettingsOpen = !store.sidebarSettingsOpen"
        >
          <span class="nav-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="2.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.22 4.22l1.42 1.42M12.36 12.36l1.42 1.42M4.22 13.78l1.42-1.42M12.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </span>
          <span v-if="!store.sidebarCollapsed" class="nav-text">
            设置
            <svg class="caret" :class="{ open: store.sidebarSettingsOpen }" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
        </button>

        <div v-if="store.sidebarSettingsOpen && !store.sidebarCollapsed" class="nav-submenu">
          <button
            class="nav-sub-item"
            :class="{ active: store.activePage === 'rules' }"
            @click="store.setPage('rules'); store.sidebarSettingsOpen = false"
          >
            <span class="nav-dot"></span>
            DDL 映射规则
          </button>
          <button
            class="nav-sub-item"
            :class="{ active: store.activePage === 'bodyRules' }"
            @click="store.setPage('bodyRules'); store.sidebarSettingsOpen = false"
          >
            <span class="nav-dot"></span>
            程序块映射规则
          </button>
        </div>
      </div>
    </nav>

    <!-- Collapse Toggle -->
    <button
      class="collapse-btn"
      @click="store.toggleSidebarCollapse()"
      :title="store.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" :style="{ transform: store.sidebarCollapsed ? 'rotate(180deg)' : '' }">
        <path d="M10 4L6 8L10 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  width: 220px;
  height: 100%;
  background: var(--color-panel);
  border-right: 1px solid var(--color-border);
  transition: width 0.2s ease;
  overflow: hidden;
}

.sidebar.is-collapsed {
  width: 60px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.sidebar-logo {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--color-brand-500);
  color: white;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  padding: 8px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-item.active {
  background: var(--color-brand-500);
  background: rgba(59, 130, 246, 0.1);
  color: var(--color-brand-500);
}

.nav-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-text {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.caret {
  margin-left: auto;
  transition: transform 0.2s;
}

.caret.open {
  transform: rotate(180deg);
}

.nav-submenu {
  padding-left: 20px;
  margin-top: 4px;
}

.nav-sub-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.nav-sub-item:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.nav-sub-item.active {
  color: var(--color-brand-500);
}

.nav-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: none;
  border-top: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.collapse-btn svg {
  transition: transform 0.2s;
}
</style>
