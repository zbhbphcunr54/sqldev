<!-- [2026-05-06] 应用配置页面 - 按提示词规范实现 -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { appConfigApi } from '@/api/app-config'
import type { AppConfig, ConfigValueType } from '@/features/app-config'
import { CATEGORY_LABELS } from '@/features/app-config'
import ConfigEditModal from './ConfigEditModal.vue'

// --- State ---
const configs = ref<AppConfig[]>([])
const loading = ref(false)
const clearingCache = ref(false)
const selectedTab = ref('all')
const searchQuery = ref('')
const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// --- Modal ---
const showEditModal = ref(false)
const editingConfig = ref<AppConfig | null>(null)

// --- Toast ---
const toast = ref<{ type: 'error'; message: string } | null>(null)
const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// --- Delete Confirm ---
const deleteConfirm = ref<{ open: boolean; config: AppConfig | null }>({
  open: false,
  config: null
})

// --- Computed ---
const typeTabs = computed(() => {
  const counts: Record<string, number> = {
    string: 0,
    number: 0,
    boolean: 0
  }
  configs.value.forEach((c) => {
    if (c.value_type === 'string') counts.string++
    else if (c.value_type === 'number') counts.number++
    else if (c.value_type === 'boolean') counts.boolean++
  })
  const total = configs.value.length
  return [
    { key: 'all', label: '全部', count: total },
    { key: 'string', label: '字符串', count: counts.string },
    { key: 'number', label: '数字', count: counts.number },
    { key: 'boolean', label: '布尔', count: counts.boolean }
  ]
})

const filteredConfigs = computed(() => {
  let items = [...configs.value]

  // Filter by tab type
  if (selectedTab.value !== 'all') {
    items = items.filter((c) => c.value_type === selectedTab.value)
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    items = items.filter(
      (c) =>
        c.key.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    )
  }

  return items
})

const lastUpdateTime = computed(() => {
  if (configs.value.length === 0) return null
  const latest = configs.value.reduce((max, c) => (c.updated_at > max.updated_at ? c : max))
  const d = new Date(latest.updated_at)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
})

// --- Lifecycle ---
onMounted(() => {
  loadConfigs()
})

// 清理定时器
onBeforeUnmount(() => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
  if (toastTimer.value) {
    clearTimeout(toastTimer.value)
  }
})

// --- Debounced Search ---
watch(searchQuery, () => {
  if (searchDebounceTimer.value) {
    clearTimeout(searchDebounceTimer.value)
  }
  searchDebounceTimer.value = setTimeout(() => {
    // Search is reactive, no additional action needed
  }, 300)
})

// --- Actions ---
async function loadConfigs(): Promise<void> {
  loading.value = true
  hideToast()
  try {
    const res = await appConfigApi.list()
    if (res.ok) {
      configs.value = res.configs
    } else {
      showToast('部分配置加载失败，请检查网络后重试')
    }
  } catch {
    showToast('部分配置加载失败，请检查网络后重试')
  } finally {
    loading.value = false
  }
}

async function clearCache(): Promise<void> {
  clearingCache.value = true
  hideToast()
  try {
    const res = await appConfigApi.clearCache()
    if (res.ok) {
      await loadConfigs()
    } else {
      showToast('清除缓存失败')
    }
  } catch {
    showToast('清除缓存失败')
  } finally {
    clearingCache.value = false
  }
}

function handleNewConfig(): void {
  editingConfig.value = null
  showEditModal.value = true
}

function handleEdit(config: AppConfig): void {
  editingConfig.value = config
  showEditModal.value = true
}

function handleDeleteRequest(config: AppConfig): void {
  deleteConfirm.value = { open: true, config }
}

async function confirmDelete(): Promise<void> {
  if (!deleteConfirm.value.config) return
  const config = deleteConfirm.value.config
  deleteConfirm.value = { open: false, config: null }
  hideToast()
  try {
    await appConfigApi.delete(config.id)
    await loadConfigs()
  } catch {
    showToast('删除失败')
  }
}

function cancelDelete(): void {
  deleteConfirm.value = { open: false, config: null }
}

async function handleToggleStatus(config: AppConfig): Promise<void> {
  const newStatus = !config.is_active
  try {
    const res = await appConfigApi.update(config.id, { is_active: newStatus })
    if (res.ok) {
      config.is_active = newStatus
    }
  } catch {
    showToast('状态更新失败')
  }
}

async function handleSaved(): Promise<void> {
  showEditModal.value = false
  await loadConfigs()
}

function handleCloseModal(): void {
  showEditModal.value = false
  editingConfig.value = null
}

// --- Toast ---
function showToast(message: string): void {
  if (toastTimer.value) clearTimeout(toastTimer.value)
  toast.value = { type: 'error', message }
  toastTimer.value = setTimeout(() => {
    hideToast()
  }, 4000)
}

function hideToast(): void {
  toast.value = null
  if (toastTimer.value) {
    clearTimeout(toastTimer.value)
    toastTimer.value = null
  }
}

// --- Helpers ---
function getTypeColor(type: ConfigValueType): { bg: string; color: string } {
  const colors: Record<ConfigValueType, { bg: string; color: string }> = {
    string: { bg: 'rgba(96, 165, 250, 0.15)', color: '#60a5fa' },
    number: { bg: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' },
    boolean: { bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' },
    jsonb: { bg: 'rgba(167, 139, 250, 0.15)', color: '#a78bfa' }
  }
  return colors[type] || colors.string
}

function getValueColor(value: string | null, valueType: ConfigValueType): string {
  if (!value) return '#8b949e'
  if (valueType === 'string') return '#e6edf3'
  if (valueType === 'number') return '#fcd34d'
  if (valueType === 'boolean') {
    return value === 'true' ? '#4ade80' : '#f87171'
  }
  return '#e6edf3'
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category
}

function truncateValue(value: string | null, maxLen = 60): string {
  if (!value) return '--'
  if (value.length <= maxLen) return value
  return value.slice(0, maxLen) + '...'
}
</script>

<template>
  <div class="app-config-page">
    <!-- Page Header -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="page-title">应用配置</h1>
        <span class="status-badge status-ok">
          <span class="status-dot"></span>
          运行中
        </span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" :disabled="clearingCache" @click="clearCache">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          {{ clearingCache ? '清除中...' : '清除缓存' }}
        </button>
        <button class="btn btn-primary" @click="handleNewConfig">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          新增配置
        </button>
      </div>
    </header>

    <!-- Tab Bar -->
    <nav class="tab-bar">
      <button
        v-for="tab in typeTabs"
        :key="tab.key"
        class="tab-btn"
        :class="{ active: selectedTab === tab.key }"
        @click="selectedTab = tab.key"
      >
        {{ tab.label }}
        <span class="tab-badge">{{ tab.count }}</span>
      </button>
    </nav>

    <!-- Search Bar -->
    <div class="search-bar">
      <svg
        class="search-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" />
      </svg>
      <input v-model="searchQuery" type="text" class="search-input" placeholder="搜索配置项..." />
    </div>

    <!-- Table -->
    <section class="table-section">
      <div class="table-wrapper">
        <table class="config-table">
          <thead>
            <tr>
              <th class="col-key">配置项</th>
              <th class="col-value">值</th>
              <th class="col-type">类型</th>
              <th class="col-status">状态</th>
              <th class="col-action">操作</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <tr v-if="loading">
              <td colspan="5" class="loading-cell">
                <div class="loading-spinner"></div>
                <span>加载中...</span>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="filteredConfigs.length === 0">
              <td colspan="5" class="empty-cell">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z" />
                </svg>
                <span>{{ searchQuery ? '未找到匹配的配置项' : '暂无配置' }}</span>
              </td>
            </tr>

            <!-- Data -->
            <tr v-for="config in filteredConfigs" :key="config.id" class="config-row">
              <td class="col-key">
                <div class="key-content">
                  <code class="key-name">{{ config.key }}</code>
                  <span class="key-desc">{{
                    config.description || getCategoryLabel(config.category)
                  }}</span>
                </div>
              </td>
              <td class="col-value">
                <code
                  class="value-block"
                  :style="{ color: getValueColor(config.value, config.value_type) }"
                >
                  {{ truncateValue(config.value) }}
                </code>
              </td>
              <td class="col-type">
                <span
                  class="type-badge"
                  :style="{
                    background: getTypeColor(config.value_type).bg,
                    color: getTypeColor(config.value_type).color
                  }"
                >
                  {{ config.value_type }}
                </span>
              </td>
              <td class="col-status">
                <button
                  class="toggle-switch"
                  :class="{ active: config.is_active }"
                  @click="handleToggleStatus(config)"
                >
                  <span class="toggle-handle"></span>
                </button>
              </td>
              <td class="col-action">
                <button class="action-btn edit" title="编辑" @click="handleEdit(config)">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button class="action-btn delete" title="删除" @click="handleDeleteRequest(config)">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Footer -->
    <footer class="page-footer">
      <span class="total-count">共 {{ filteredConfigs.length }} 条配置</span>
      <span v-if="lastUpdateTime" class="last-update">最后更新：{{ lastUpdateTime }}</span>
    </footer>

    <!-- Toast -->
    <Transition name="slide-down">
      <div v-if="toast" class="toast toast-error">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M15 9l-6 6M9 9l6 6" />
        </svg>
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="hideToast">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- Delete Confirm Modal -->
    <Teleport to="body">
      <div v-if="deleteConfirm.open" class="confirm-overlay" @click.self="cancelDelete">
        <div class="confirm-dialog">
          <h3 class="confirm-title">确认删除</h3>
          <p class="confirm-text">
            确定要删除配置项 <code>{{ deleteConfirm.config?.key }}</code> 吗？此操作不可撤销。
          </p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" @click="cancelDelete">取消</button>
            <button class="btn btn-danger" @click="confirmDelete">删除</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Edit Modal -->
    <ConfigEditModal
      :open="showEditModal"
      :config="editingConfig"
      @close="handleCloseModal"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
/* ==================== Page Layout ==================== */
.app-config-page {
  min-height: 100vh;
  background: var(--color-page-bg);
  color: var(--color-page-text);
  padding: 24px;
  position: relative;
}

/* ==================== Page Header ==================== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-page-text);
  letter-spacing: -0.03em;
  margin: 0;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
}

.status-badge.status-ok {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid rgba(48, 209, 88, 0.3);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ==================== Buttons ==================== */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 20px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  border: none;
}

.btn-ghost {
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  color: var(--color-page-text);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-page-elevated);
  border-color: var(--color-page-border-hover);
}

.btn-primary {
  background: var(--color-accent);
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.btn-danger {
  background: var(--color-danger);
  color: #ffffff;
}

.btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-danger) 85%, black);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== Tab Bar ==================== */
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  background: var(--color-page-card);
  border-radius: var(--radius-pill);
  width: fit-content;
  border: 1px solid var(--color-page-border);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  background: transparent;
  border: none;
  color: var(--color-page-text-subtle);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.tab-btn:hover {
  color: var(--color-page-text);
}

.tab-btn.active {
  background: var(--color-accent);
  color: #ffffff;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.15);
}

.tab-btn:not(.active) .tab-badge {
  background: var(--color-page-border-light);
}

/* ==================== Search Bar ==================== */
.search-bar {
  position: relative;
  max-width: 400px;
  margin-bottom: 20px;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-page-text-muted);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 44px;
  padding: 0 16px 0 44px;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
  color: var(--color-page-text);
  font-size: 14px;
  transition: all var(--duration-fast) var(--ease-apple);
}

.search-input::placeholder {
  color: var(--color-page-text-muted);
}

.search-input:hover {
  border-color: var(--color-page-border-hover);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

/* ==================== Table ==================== */
.table-section {
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.table-wrapper {
  overflow-x: auto;
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.config-table thead tr {
  background: var(--color-page-elevated);
}

.config-table th {
  padding: 16px 20px;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--color-page-border);
  white-space: nowrap;
}

.config-table td {
  padding: 18px 20px;
  text-align: center;
  border-bottom: 1px solid var(--color-page-border);
  vertical-align: middle;
}

.config-row {
  transition: all var(--duration-fast) var(--ease-apple);
}

.config-row:hover {
  background: var(--color-page-border-light);
}

.config-table tbody tr:last-child td {
  border-bottom: none;
}

/* Column widths */
.col-key {
  min-width: 200px;
}
.col-value {
  min-width: 250px;
  text-align: left;
}
.col-type {
  width: 90px;
}
.col-status {
  width: 90px;
}
.col-action {
  width: 100px;
}

/* Key Content */
.key-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
}

.key-name {
  font-family: var(--font-code);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-page-text);
  background: transparent;
  letter-spacing: -0.01em;
}

.key-desc {
  font-size: 12px;
  color: var(--color-page-text-muted);
}

/* Value Block */
.value-block {
  display: inline-block;
  padding: 8px 14px;
  background: var(--color-page-input);
  border-radius: var(--radius-md);
  font-family: var(--font-code);
  font-size: 12px;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

/* Type Badge */
.type-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  text-transform: capitalize;
  letter-spacing: 0.02em;
}

/* Toggle Switch - Apple Style */
.toggle-switch {
  position: relative;
  width: 48px;
  height: 28px;
  border-radius: 14px;
  background: var(--color-page-border);
  border: none;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  padding: 0;
}

.toggle-switch.active {
  background: var(--color-success);
}

.toggle-handle {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all var(--duration-normal) var(--ease-spring);
}

.toggle-switch.active .toggle-handle {
  left: 23px;
}

/* Action Buttons */
.col-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  background: transparent;
  border: 1px solid var(--color-page-border);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.action-btn:hover {
  background: var(--color-page-border-light);
  border-color: var(--color-page-border-hover);
}

.action-btn.edit:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.action-btn.delete:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}

/* Loading & Empty */
.loading-cell,
.empty-cell {
  text-align: center;
  padding: 80px 20px !important;
  color: var(--color-page-text-subtle);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-page-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.empty-cell svg {
  color: var(--color-page-text-muted);
  opacity: 0.5;
}

/* ==================== Footer ==================== */
.page-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 4px;
  margin-top: 16px;
}

.total-count {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-page-text-subtle);
}

.last-update {
  font-size: 12px;
  color: var(--color-page-text-muted);
  font-family: var(--font-code);
  letter-spacing: -0.01em;
}

/* ==================== Toast ==================== */
.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-radius: var(--radius-xl);
  font-size: 13px;
  font-weight: 500;
  z-index: 2000;
  box-shadow: var(--shadow-lg);
}

.toast-error {
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger);
  color: var(--color-danger);
}

.toast-message {
  flex: 1;
}

.toast-close {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: opacity var(--duration-fast) var(--ease-apple);
}

.toast-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* Toast Animation */
.slide-down-enter-active {
  animation: slideInDown var(--duration-normal) var(--ease-spring);
}

.slide-down-leave-active {
  animation: slideOutUp var(--duration-normal) var(--ease-out);
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideOutUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}

/* ==================== Confirm Dialog ==================== */
.confirm-overlay {
  position: fixed;
  inset: 0;
  z-index: 1500;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.confirm-dialog {
  width: 420px;
  max-width: 90vw;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: var(--shadow-xl);
}

.confirm-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-page-text);
  margin: 0 0 12px 0;
  letter-spacing: -0.01em;
}

.confirm-text {
  font-size: 14px;
  color: var(--color-page-text-subtle);
  margin: 0 0 24px 0;
  line-height: 1.6;
}

.confirm-text code {
  font-family: var(--font-code);
  color: var(--color-page-text);
  background: var(--color-page-border-light);
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* ==================== Scrollbar ==================== */
.table-wrapper::-webkit-scrollbar {
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: var(--color-page-scrollbar-track);
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: var(--color-page-scrollbar-thumb);
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: var(--color-page-scrollbar-thumb-hover);
}

/* ==================== Responsive ==================== */
@media (max-width: 768px) {
  .app-config-page {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .tab-bar {
    width: 100%;
    overflow-x: auto;
  }

  .search-bar {
    max-width: 100%;
  }
}
</style>
