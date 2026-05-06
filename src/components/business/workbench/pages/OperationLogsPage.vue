<!-- [2026-05-06] 操作日志页面 - 工作台内嵌版本 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useOperationLogsStore } from '@/stores/operation-logs'
import type { OperationLogFilters } from '@/api/operation-logs'

// --- Store ---
const store = useOperationLogsStore()

// --- Filter State ---
const filterOperation = ref('')
const filterApiName = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')

// --- Operation Options ---
const operationOptions = [
  { value: '', label: '全部类型' },
  { value: 'convert_ddl', label: 'DDL 翻译' },
  { value: 'convert_func', label: '函数翻译' },
  { value: 'convert_proc', label: '存储过程翻译' },
  { value: 'verify_ddl', label: 'DDL 校验' },
  { value: 'verify_func', label: '函数校验' },
  { value: 'verify_proc', label: '存储过程校验' },
  { value: 'rule_save', label: '规则修改' },
  { value: 'rule_reset', label: '规则重置' },
  { value: 'config_save', label: '配置变更' },
  { value: 'feedback_submit', label: '反馈提交' },
  { value: 'ziwei_analysis', label: '紫微分析' }
]

// --- API Options ---
const apiOptions = [
  { value: '', label: '全部 API' },
  { value: '/convert', label: '/api/convert' },
  { value: '/convert-verify', label: '/api/convert-verify' },
  { value: '/rules', label: '/api/rules' },
  { value: '/app-config', label: '/api/app-config' },
  { value: '/feedback', label: '/api/feedback' },
  { value: '/ziwei-analysis', label: '/api/ziwei-analysis' }
]

// --- Computed ---
const isAdmin = computed(() => store.isAdmin)

// --- Lifecycle ---
onMounted(() => {
  store.loadLogs()
})

// --- Actions ---
function handleSearch(): void {
  const filters: OperationLogFilters = {}
  if (filterOperation.value) filters.operation = filterOperation.value
  if (filterApiName.value) filters.apiName = filterApiName.value
  if (filterStartDate.value) filters.startDate = filterStartDate.value
  if (filterEndDate.value) filters.endDate = filterEndDate.value
  store.setFilters(filters)
}

function handleReset(): void {
  filterOperation.value = ''
  filterApiName.value = ''
  filterStartDate.value = ''
  filterEndDate.value = ''
  store.setFilters({})
}

function handlePrevPage(): void {
  if (store.page > 1) {
    store.setPage(store.page - 1)
  }
}

function handleNextPage(): void {
  if (store.page < store.totalPages) {
    store.setPage(store.page + 1)
  }
}

// --- Helpers ---
function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  const seconds = ms / 1000
  return `${seconds.toFixed(1)}s`
}

function getOperationLabel(operation: string): string {
  const op = operationOptions.find(o => o.value === operation)
  return op?.label || operation
}

function isSuccess(status: number | null): boolean {
  return status !== null && status >= 200 && status < 400
}

function isError(status: number | null): boolean {
  return status !== null && (status < 200 || status >= 400)
}
</script>

<template>
  <div class="op-logs-page">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">操作日志</h1>
        <span v-if="isAdmin" class="admin-badge">管理员</span>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <div class="filter-group">
        <!-- Operation Type -->
        <div class="filter-item">
          <label class="filter-label">操作类型</label>
          <select v-model="filterOperation" class="filter-select">
            <option v-for="opt in operationOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- API Name -->
        <div class="filter-item">
          <label class="filter-label">API 名称</label>
          <select v-model="filterApiName" class="filter-select">
            <option v-for="opt in apiOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Start Date -->
        <div class="filter-item">
          <label class="filter-label">开始日期</label>
          <div class="date-input-wrapper">
            <input v-model="filterStartDate" type="date" class="filter-date" />
            <svg class="date-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="14" height="13" rx="2"/>
              <path d="M3 8h14M7 2v4M13 2v4"/>
            </svg>
          </div>
        </div>

        <!-- End Date -->
        <div class="filter-item">
          <label class="filter-label">结束日期</label>
          <div class="date-input-wrapper">
            <input v-model="filterEndDate" type="date" class="filter-date" />
            <svg class="date-icon" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="4" width="14" height="13" rx="2"/>
              <path d="M3 8h14M7 2v4M13 2v4"/>
            </svg>
          </div>
        </div>
      </div>

      <div class="filter-actions">
        <button class="btn btn-primary" @click="handleSearch">查询</button>
        <button class="btn btn-secondary" @click="handleReset">重置</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="error-state">
      <span class="error-text">{{ store.error }}</span>
      <button class="btn-retry" @click="store.loadLogs()">重试</button>
    </div>

    <!-- Table -->
    <div v-else class="table-wrapper">
      <table class="log-table">
        <thead>
          <tr>
            <th class="col-time">时间</th>
            <th class="col-user">用户</th>
            <th class="col-ip">IP</th>
            <th class="col-operation">操作</th>
            <th class="col-api">API</th>
            <th class="col-status">状态</th>
            <th class="col-duration">耗时</th>
            <th class="col-error">错误</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in store.items" :key="log.id">
            <!-- Time -->
            <td class="cell-time">
              <code>{{ formatDateTime(log.created_at) }}</code>
            </td>

            <!-- User -->
            <td class="cell-user">
              <span class="user-email">{{ log.user_email || '--' }}</span>
            </td>

            <!-- IP -->
            <td class="cell-ip">
              <code>{{ log.client_ip || '--' }}</code>
            </td>

            <!-- Operation -->
            <td class="cell-operation">
              {{ getOperationLabel(log.operation) }}
            </td>

            <!-- API -->
            <td class="cell-api">
              <code>{{ log.api_name || '--' }}</code>
            </td>

            <!-- Status -->
            <td class="cell-status">
              <div class="status-indicator" :class="isSuccess(log.response_status) ? 'status-success' : isError(log.response_status) ? 'status-error' : 'status-none'">
                <span class="status-dot"></span>
                <span class="status-text">{{ isSuccess(log.response_status) ? '成功' : isError(log.response_status) ? '失败' : '--' }}</span>
              </div>
            </td>

            <!-- Duration -->
            <td class="cell-duration">
              <code>{{ formatDuration(log.duration_ms) }}</code>
            </td>

            <!-- Error -->
            <td class="cell-error">
              <span v-if="!log.error_message" class="error-none">—</span>
              <span v-else class="error-message" :title="log.error_message">{{ log.error_message }}</span>
            </td>
          </tr>

          <tr v-if="store.items.length === 0">
            <td colspan="8" class="empty-cell">暂无日志记录</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="store.totalPages > 0" class="pagination">
      <button
        class="page-btn"
        :disabled="store.page <= 1"
        @click="handlePrevPage"
      >
        上一页
      </button>
      <span class="page-info">第 {{ store.page }} 页 / 共 {{ store.totalPages }} 页</span>
      <button
        class="page-btn"
        :disabled="store.page >= store.totalPages"
        @click="handleNextPage"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<style scoped>
.op-logs-page {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
  background: var(--color-bg);
}

/* ========== Header ========== */
.page-header {
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text);
}

.admin-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border: 1px solid var(--color-brand-500);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-brand-500);
}

/* ========== Filter Bar ========== */
.filter-bar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 500;
}

.filter-select {
  width: 180px;
  height: 40px;
  padding: 0 32px 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none' stroke='%238b949e' stroke-width='1.5'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  transition: border-color 0.15s;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-brand-500);
}

.filter-select option {
  background: var(--color-panel);
  color: var(--color-text);
}

.date-input-wrapper {
  position: relative;
  width: 180px;
}

.filter-date {
  width: 100%;
  height: 40px;
  padding: 0 36px 0 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.filter-date:focus {
  outline: none;
  border-color: var(--color-brand-500);
}

.date-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}

.filter-actions {
  display: flex;
  gap: 8px;
}

/* ========== Buttons ========== */
.btn {
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary {
  border: none;
  background: var(--gradient-brand-primary);
  color: white;
  box-shadow: var(--shadow-brand-primary);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-primary-hover);
}

.btn-secondary {
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.btn-secondary:hover {
  background: var(--color-panel);
  border-color: var(--color-border-hover);
}

/* ========== Table ========== */
.table-wrapper {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  background: var(--color-panel);
}

.log-table {
  width: 100%;
  border-collapse: collapse;
}

.log-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--color-panel-2);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.log-table td {
  padding: 18px 16px;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
  color: var(--color-text);
  vertical-align: middle;
}

.log-table tbody tr:last-child td {
  border-bottom: none;
}

.log-table tbody tr:hover td {
  background: rgba(255, 255, 255, 0.01);
}

/* Column widths */
.col-time { width: 160px; }
.col-user { width: 200px; }
.col-ip { width: 130px; }
.col-operation { width: 120px; }
.col-api { width: 140px; }
.col-status { width: 80px; }
.col-duration { width: 80px; text-align: right; }
.col-error { min-width: 150px; }

/* ========== Cell Styles ========== */
.cell-time code,
.cell-ip code,
.cell-duration code,
.cell-api code {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-text);
  background: none;
  padding: 0;
}

.cell-time code,
.cell-duration code {
  white-space: nowrap;
}

.cell-ip code {
  word-break: break-all;
}

.cell-api code {
  color: var(--color-text-muted);
  font-size: 11px;
}

.user-email {
  color: var(--color-brand-500);
  font-size: 12px;
  cursor: pointer;
}

.user-email:hover {
  text-decoration: underline;
}

.cell-operation {
  color: var(--color-text);
  white-space: nowrap;
}

.cell-api {
  /* inherited */
}

/* ========== Status Indicator ========== */
.status-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-success .status-dot {
  background: var(--color-success);
  box-shadow: 0 0 6px rgba(63, 185, 80, 0.5);
}

.status-success .status-text {
  color: var(--color-success);
}

.status-error .status-dot {
  background: var(--color-danger);
  box-shadow: 0 0 6px rgba(248, 81, 73, 0.5);
}

.status-error .status-text {
  color: var(--color-danger);
}

.status-none .status-dot {
  background: var(--color-text-muted);
}

.status-none .status-text {
  color: var(--color-text-muted);
}

/* ========== Error Cell ========== */
.error-none {
  color: var(--color-text-muted);
}

.error-message {
  color: var(--color-danger);
  font-size: 12px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
}

/* ========== Empty Cell ========== */
.empty-cell {
  text-align: center;
  color: var(--color-text-muted);
  padding: 60px 16px;
  font-size: 13px;
}

/* ========== Loading & Error ========== */
.loading-state,
.error-state {
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

.error-text {
  color: var(--color-danger);
}

.btn-retry {
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-retry:hover {
  background: var(--color-panel);
}

/* ========== Pagination ========== */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 20px;
}

.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: var(--color-panel);
  border-color: var(--color-border-hover);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--color-text-muted);
}
</style>
