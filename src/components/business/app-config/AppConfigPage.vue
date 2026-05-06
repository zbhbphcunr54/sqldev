<!-- [2026-05-06] 应用配置页面 - 工作台内嵌版本 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { appConfigApi } from '@/api/app-config'
import type { AppConfig, ConfigValueType } from '@/features/app-config'
import { CATEGORY_LABELS, CONFIG_CATEGORIES, VALUE_TYPE_LABELS } from '@/features/app-config'
import ConfigEditModal from './ConfigEditModal.vue'

// --- State ---
const configs = ref<AppConfig[]>([])
const loading = ref(false)
const clearingCache = ref(false)
const statusMsg = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const selectedCategory = ref<string>('all')

// --- Modal ---
const showEditModal = ref(false)
const editingConfig = ref<AppConfig | null>(null)

// --- Computed ---
const categories = computed(() => {
  const counts: Record<string, number> = {}
  configs.value.forEach(c => {
    counts[c.category] = (counts[c.category] || 0) + 1
  })
  const total = configs.value.length

  const result = [{ key: 'all', label: '全部', count: total }]

  Object.entries(counts).forEach(([key, count]) => {
    const label = CATEGORY_LABELS[key] || key
    result.push({ key, label, count })
  })

  return result
})

const filteredConfigs = computed(() => {
  if (selectedCategory.value === 'all') return configs.value
  return configs.value.filter(c => c.category === selectedCategory.value)
})

// --- Lifecycle ---
onMounted(() => {
  loadConfigs()
})

// --- Actions ---
async function loadConfigs(): Promise<void> {
  loading.value = true
  statusMsg.value = null
  try {
    const res = await appConfigApi.list()
    if (res.ok) {
      configs.value = res.configs
    } else {
      statusMsg.value = { type: 'error', text: '加载失败' }
    }
  } catch {
    statusMsg.value = { type: 'error', text: '加载失败' }
  } finally {
    loading.value = false
  }
}

async function clearCache(): Promise<void> {
  clearingCache.value = true
  statusMsg.value = null
  try {
    const res = await appConfigApi.clearCache()
    if (res.ok) {
      statusMsg.value = { type: 'success', text: '缓存已清除' }
    } else {
      statusMsg.value = { type: 'error', text: '清除失败' }
    }
  } catch {
    statusMsg.value = { type: 'error', text: '清除失败' }
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

async function handleToggleStatus(config: AppConfig): Promise<void> {
  const newStatus = !config.is_active
  try {
    const res = await appConfigApi.update(config.id, { is_active: newStatus })
    if (res.ok) {
      config.is_active = newStatus
    }
  } catch {
    statusMsg.value = { type: 'error', text: '状态更新失败' }
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

// --- Helpers ---
function truncateValue(value: string | null, maxLen = 40): string {
  if (!value) return '--'
  if (value.length <= maxLen) return value
  return value.slice(0, maxLen) + '...'
}

function maskSensitiveValue(value: string | null, key: string): string {
  if (!value) return '--'
  const sensitiveKeys = ['key', 'secret', 'password', 'token', 'api_key', 'apikey']
  const isSensitive = sensitiveKeys.some(k => key.toLowerCase().includes(k))
  if (isSensitive) {
    return '••••••••••'
  }
  return truncateValue(value)
}

function getValueTypeStyle(type: ConfigValueType): { border: string; color: string; bg: string } {
  const styles: Record<ConfigValueType, { border: string; color: string; bg: string }> = {
    number: { border: '#3fb950', color: '#3fb950', bg: 'rgba(63, 185, 80, 0.08)' },
    string: { border: '#a78bfa', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.08)' },
    boolean: { border: '#f0883e', color: '#f0883e', bg: 'rgba(240, 136, 62, 0.08)' },
    jsonb: { border: '#2dd4bf', color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.08)' }
  }
  return styles[type] || styles.string
}

function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] || category
}
</script>

<template>
  <div class="app-config-page">
    <!-- Header -->
    <div class="page-header">
      <h1 class="page-title">应用配置</h1>
      <div class="header-actions">
        <button
          class="btn-secondary"
          :disabled="clearingCache"
          @click="clearCache"
        >
          {{ clearingCache ? '清除中...' : '清除缓存' }}
        </button>
        <button class="btn-primary" @click="handleNewConfig">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 14 14">
            <path d="M7 2v10M2 7h10"/>
          </svg>
          新增配置
        </button>
      </div>
    </div>

    <!-- Category Tabs -->
    <div class="category-tabs">
      <button
        v-for="cat in categories"
        :key="cat.key"
        class="category-tab"
        :class="{ active: selectedCategory === cat.key }"
        @click="selectedCategory = cat.key"
      >
        {{ cat.label }}
        <span class="tab-count">{{ cat.count }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Table -->
    <div v-else class="config-table-wrapper">
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
          <tr v-for="config in filteredConfigs" :key="config.id">
            <!-- Key -->
            <td class="cell-key">
              <div class="key-content">
                <code class="key-name">{{ config.key }}</code>
                <span class="key-desc">{{ config.description || getCategoryLabel(config.category) }}</span>
              </div>
            </td>

            <!-- Value -->
            <td class="cell-value">
              <code class="value-text">{{ maskSensitiveValue(config.value, config.key) }}</code>
            </td>

            <!-- Type -->
            <td class="cell-type">
              <span
                class="type-badge"
                :style="{
                  borderColor: getValueTypeStyle(config.value_type).border,
                  color: getValueTypeStyle(config.value_type).color,
                  background: getValueTypeStyle(config.value_type).bg
                }"
              >
                {{ config.value_type.toUpperCase() }}
              </span>
            </td>

            <!-- Status -->
            <td class="cell-status">
              <button
                class="status-btn"
                :class="config.is_active ? 'status-active' : 'status-inactive'"
                @click="handleToggleStatus(config)"
              >
                {{ config.is_active ? '启用' : '禁用' }}
              </button>
              <span v-if="config.is_encrypted" class="encrypted-tag">加密</span>
            </td>

            <!-- Action -->
            <td class="cell-action">
              <button class="edit-link" @click="handleEdit(config)">编辑</button>
            </td>
          </tr>

          <tr v-if="filteredConfigs.length === 0">
            <td colspan="5" class="empty-cell">
              <span v-if="selectedCategory === 'all'">暂无配置</span>
              <span v-else>该分类暂无配置</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Status Message -->
    <div v-if="statusMsg" class="status-msg" :class="statusMsg.type">
      {{ statusMsg.text }}
    </div>

    <!-- Modal -->
    <ConfigEditModal
      :open="showEditModal"
      :config="editingConfig"
      @close="handleCloseModal"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.app-config-page {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
  background: var(--color-bg);
}

/* ========== Header ========== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.header-actions {
  display: flex;
  gap: 10px;
}

.btn-secondary {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: var(--color-border-hover);
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-control);
  background: var(--gradient-brand-primary);
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: var(--shadow-brand-primary);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-primary-hover);
}

/* ========== Category Tabs ========== */
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.category-tab:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.category-tab.active {
  background: var(--gradient-brand-primary);
  border-color: transparent;
  color: white;
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.15);
  font-size: 10px;
  font-weight: 600;
}

.category-tab:not(.active) .tab-count {
  background: var(--color-panel-2);
}

/* ========== Table ========== */
.config-table-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-panel);
}

.config-table {
  width: 100%;
  border-collapse: collapse;
}

.config-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
}

.config-table td {
  padding: 20px 16px;
  border-bottom: 1px solid var(--color-border);
  vertical-align: middle;
  transition: background 0.1s;
}

.config-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.01);
}

.config-table tbody tr:last-child td {
  border-bottom: none;
}

/* Column widths */
.col-key { width: 30%; }
.col-value { width: 30%; }
.col-type { width: 10%; }
.col-status { width: 15%; }
.col-action { width: 15%; text-align: right; }

/* ========== Cell: Key ========== */
.key-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.key-name {
  font-family: var(--font-code);
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  background: none;
  padding: 0;
}

.key-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}

/* ========== Cell: Value ========== */
.value-text {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-text-muted);
  background: none;
  padding: 0;
  word-break: break-all;
}

/* ========== Cell: Type ========== */
.type-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-code);
}

/* ========== Cell: Status ========== */
.cell-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-btn {
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;
}

.status-btn:hover {
  opacity: 0.7;
}

.status-active {
  color: var(--color-success);
}

.status-inactive {
  color: var(--color-text-muted);
}

.encrypted-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border: 1px solid var(--color-warning);
  border-radius: 10px;
  font-size: 10px;
  font-weight: 500;
  color: var(--color-warning);
}

/* ========== Cell: Action ========== */
.edit-link {
  border: none;
  background: none;
  color: var(--color-brand-500);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
  transition: opacity 0.15s;
}

.edit-link:hover {
  opacity: 0.7;
}

/* ========== Loading ========== */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-brand-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== Empty ========== */
.empty-cell {
  text-align: center;
  color: var(--color-text-muted);
  padding: 60px 16px;
  font-size: 13px;
}

/* ========== Status Message ========== */
.status-msg {
  margin-top: 16px;
  padding: 12px 16px;
  border-radius: var(--radius-control);
  font-size: 13px;
  text-align: center;
}

.status-msg.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-msg.error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}
</style>
