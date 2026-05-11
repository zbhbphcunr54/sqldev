<!-- [2026-05-06] 操作日志页面 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useOperationLogsStore } from '@/stores/operation-logs'
import type { OperationLog } from '@/api/operation-logs'

const store = useOperationLogsStore()
const selectedLog = ref<OperationLog | null>(null)

onMounted(() => {
  store.loadLogs()
})

// Stats
const stats = computed(() => ({
  total: store.summary.today_requests,
  successRate: store.summary.success_rate.toFixed(1),
  avgDuration: store.summary.avg_duration_ms,
  failCount: store.summary.fail_count
}))

// Filter state
const filterStatus = ref('')
const filterOperation = ref('')
const filterStartDate = ref('')
const filterEndDate = ref('')

// Constants
const OPERATION_MAP: Record<string, string> = {
  convert_ddl: 'DDL 翻译',
  convert_func: '函数翻译',
  convert_proc: '存储过程翻译',
  convert_verify: 'AI 校验',
  rule_read: '读取规则',
  rule_save: '保存规则',
  rule_reset: '重置规则',
  ziwei_analysis: '紫微分析',
  ziwei_history_list: '紫微历史查询',
  ai_config_create: '创建AI配置',
  ai_provider_create: '新增供应商',
  feedback_submit: '提交建议',
  ai_chat_message: 'AI 对话',
  ai_chat_delete_session: '删除AI会话'
}

const OPERATION_OPTIONS = [
  { value: '', label: '全部操作' },
  ...Object.entries(OPERATION_MAP).map(([value, label]) => ({ value, label }))
]

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'fail', label: '失败' }
]

// Status helpers
function isSuccessStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 400
}

function getStatusInfo(status: number | null): { class: string; label: string } {
  if (status === null) return { class: 'gray', label: '-' }
  if (status >= 200 && status < 400) return { class: 'success', label: '成功' }
  return { class: 'fail', label: '失败' }
}

function getOperationLabel(op: string): string {
  return OPERATION_MAP[op] ?? op
}

function formatTime(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

function formatJson(obj: unknown): string {
  if (!obj) return '-'
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

// Table rows with pre-computed status
interface TableRow {
  log: OperationLog
  statusClass: string
  statusLabel: string
}

const tableRows = computed<TableRow[]>(() =>
  store.items.map((log) => {
    const info = getStatusInfo(log.response_status)
    return { log, statusClass: info.class, statusLabel: info.label }
  })
)

const selectedLogStatus = computed(() =>
  selectedLog.value ? getStatusInfo(selectedLog.value.response_status) : null
)

// Handlers
function handleSearch(): void {
  store.setFilters({
    operation: filterOperation.value || undefined,
    startDate: filterStartDate.value || undefined,
    endDate: filterEndDate.value || undefined,
    status: filterStatus.value || undefined
  })
}

function handleReset(): void {
  filterStatus.value = ''
  filterOperation.value = ''
  filterStartDate.value = ''
  filterEndDate.value = ''
  store.setFilters({})
}

function handleSelectLog(log: OperationLog): void {
  selectedLog.value = log
}

function handleCloseDetail(): void {
  selectedLog.value = null
}

async function handlePageChange(p: number): Promise<void> {
  await store.setPage(p)
  selectedLog.value = null
}
</script>

<template>
  <div class="logs-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1 class="page-title">操作日志</h1>
      <span v-if="store.isAdmin" class="admin-badge">管理员</span>
    </header>

    <!-- Stats Cards -->
    <section class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{{ stats.total.toLocaleString() }}</span>
        <span class="stat-label">总记录数</span>
      </div>
      <div class="stat-card">
        <span class="stat-value success">{{ stats.successRate }}%</span>
        <span class="stat-label">成功率</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.avgDuration }}ms</span>
        <span class="stat-label">平均耗时</span>
      </div>
      <div class="stat-card">
        <span class="stat-value fail">{{ stats.failCount }}</span>
        <span class="stat-label">失败次数</span>
      </div>
    </section>

    <!-- Filter Bar -->
    <section class="filter-bar">
      <select v-model="filterStatus" class="filter-select">
        <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <select v-model="filterOperation" class="filter-select">
        <option v-for="opt in OPERATION_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <div class="filter-dates">
        <input v-model="filterStartDate" type="date" class="filter-input" />
        <span class="filter-sep">-</span>
        <input v-model="filterEndDate" type="date" class="filter-input" />
      </div>
      <div class="filter-actions">
        <button class="btn btn-ghost" @click="handleReset">重置</button>
        <button class="btn btn-primary" @click="handleSearch">查询</button>
      </div>
    </section>

    <!-- Table -->
    <section class="table-section">
      <div class="table-wrapper">
        <table class="log-table">
          <thead class="table-head">
            <tr>
              <th class="col-time">时间</th>
              <th class="col-user">用户</th>
              <th class="col-operation">操作</th>
              <th class="col-api">API</th>
              <th class="col-status">状态</th>
              <th class="col-duration">耗时</th>
              <th class="col-error">错误信息</th>
            </tr>
          </thead>
          <tbody class="table-body">
            <template v-if="store.loading">
              <tr>
                <td colspan="7" class="loading-cell">
                  <div class="loading-spinner"></div>
                  <span>加载中...</span>
                </td>
              </tr>
            </template>

            <template v-else-if="store.error">
              <tr>
                <td colspan="7" class="error-cell">
                  <span>{{ store.error }}</span>
                  <button class="btn btn-ghost btn-sm" @click="store.loadLogs()">重试</button>
                </td>
              </tr>
            </template>

            <template v-else-if="tableRows.length === 0">
              <tr>
                <td colspan="7" class="empty-cell">
                  <svg
                    width="36"
                    height="36"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <path d="M12 6v6l4 2" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                  <span>暂无操作日志</span>
                </td>
              </tr>
            </template>

            <template v-else>
              <tr
                v-for="row in tableRows"
                :key="row.log.id"
                :class="{ 'row-error': !isSuccessStatus(row.log.response_status) }"
                @click="handleSelectLog(row.log)"
              >
                <td class="col-time">
                  <span class="time-text">{{ formatTime(row.log.created_at) }}</span>
                </td>
                <td class="col-user">
                  <span class="user-text">{{ row.log.user_email || '-' }}</span>
                </td>
                <td class="col-operation">
                  <span class="operation-text">{{ getOperationLabel(row.log.operation) }}</span>
                </td>
                <td class="col-api">
                  <code class="api-text">{{ row.log.api_name || '-' }}</code>
                </td>
                <td class="col-status">
                  <span :class="['status-badge', row.statusClass]">
                    <span class="status-dot"></span>
                    {{ row.statusLabel }}
                  </span>
                </td>
                <td class="col-duration">
                  <span class="duration-text">{{
                    row.log.duration_ms != null ? `${row.log.duration_ms}ms` : '-'
                  }}</span>
                </td>
                <td class="col-error">
                  <span class="error-text" :class="{ 'has-error': row.log.error_message }">
                    {{ row.log.error_message || '—' }}
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <footer class="pagination-footer">
        <span class="total-text">共 {{ store.total }} 条记录</span>
        <div class="pagination-controls">
          <button
            class="page-btn"
            :disabled="store.page <= 1"
            @click="handlePageChange(store.page - 1)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span class="page-info">{{ store.page }} / {{ store.totalPages }}</span>
          <button
            class="page-btn"
            :disabled="store.page >= store.totalPages"
            @click="handlePageChange(store.page + 1)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </footer>
    </section>

    <!-- Detail Modal -->
    <Teleport to="body">
      <div v-if="selectedLog" class="detail-overlay" @click.self="handleCloseDetail">
        <div class="detail-modal">
          <div class="modal-header">
            <h3 class="modal-title">日志详情</h3>
            <button class="modal-close" @click="handleCloseDetail">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">时间</span>
                <span class="info-value">{{ formatTime(selectedLog.created_at) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">用户</span>
                <span class="info-value">{{ selectedLog.user_email || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">IP 地址</span>
                <code class="info-code">{{ selectedLog.client_ip || '-' }}</code>
              </div>
              <div class="info-item">
                <span class="info-label">操作</span>
                <span class="info-value">{{ getOperationLabel(selectedLog.operation) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">API</span>
                <code class="info-code">{{ selectedLog.api_name || '-' }}</code>
              </div>
              <div class="info-item">
                <span class="info-label">状态</span>
                <span :class="['status-badge', selectedLogStatus?.class]">
                  {{ selectedLogStatus?.label }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">耗时</span>
                <code class="info-code">{{
                  selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '-'
                }}</code>
              </div>
            </div>

            <div v-if="selectedLog.error_message" class="error-section">
              <h4 class="section-title">错误信息</h4>
              <div class="error-box">{{ selectedLog.error_message }}</div>
            </div>

            <div v-if="selectedLog.request_body" class="data-section">
              <h4 class="section-title">上送报文</h4>
              <pre class="code-block">{{ formatJson(selectedLog.request_body) }}</pre>
            </div>

            <div v-if="selectedLog.response_body" class="data-section">
              <h4 class="section-title">返回报文</h4>
              <pre class="code-block">{{ formatJson(selectedLog.response_body) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ==================== Page Layout ==================== */
.logs-page {
  min-height: 100vh;
  background: var(--color-page-bg);
  color: var(--color-page-text);
  padding: 24px;
}

/* ==================== Page Header ==================== */
.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #f0f6fc;
  margin: 0;
}

.admin-badge {
  padding: 4px 10px;
  background: var(--color-page-brand-bg);
  color: var(--color-page-brand);
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid rgba(99, 102, 241, 0.3);
}

/* ==================== Stats Cards ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-code);
  color: #f0f6fc;
}

.stat-value.success {
  color: var(--color-page-success);
}

.stat-value.fail {
  color: var(--color-page-danger);
}

.stat-label {
  font-size: 12px;
  color: var(--color-page-text-subtle);
}

/* ==================== Filter Bar ==================== */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: 12px;
  margin-bottom: 24px;
}

.filter-select {
  height: 36px;
  padding: 0 12px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-light);
  border-radius: 8px;
  color: var(--color-page-text);
  font-size: 13px;
  cursor: pointer;
  min-width: 120px;
}

.filter-select:focus {
  outline: none;
  border-color: var(--color-page-border-focus);
}

.filter-dates {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.filter-input {
  height: 36px;
  padding: 0 12px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-light);
  border-radius: 8px;
  color: var(--color-page-text);
  font-size: 13px;
}

.filter-input:focus {
  outline: none;
  border-color: var(--color-page-border-focus);
}

.filter-sep {
  color: var(--color-page-text-muted);
  font-size: 13px;
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ==================== Buttons ==================== */
.btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  border: none;
}

/* .btn-sm uses main.css definition */
.btn-sm {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

/* ==================== Table ==================== */
.table-section {
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.table-wrapper {
  overflow-x: auto;
  overflow-y: auto;
  flex: 1;
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

.log-table .table-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-page-card);
}

.log-table thead tr {
  background: rgba(255, 255, 255, 0.02);
}

.log-table th {
  padding: 18px 24px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-page-border);
  white-space: nowrap;
}

.log-table td {
  padding: 18px 24px;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  vertical-align: middle;
}

.log-table tbody tr {
  cursor: pointer;
  transition: background 0.15s ease;
}

.log-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.log-table tbody tr.row-error {
  background: var(--color-page-danger-bg);
  border-left: 3px solid rgba(248, 81, 73, 0.3);
}

.log-table tbody tr.row-error:hover {
  background: rgba(248, 81, 73, 0.08);
}

/* Column widths */
.col-time {
  width: 200px;
}
.col-user {
  width: 280px;
}
.col-operation {
  width: 150px;
}
.col-api {
  width: 150px;
}
.col-status {
  width: 120px;
}
.col-duration {
  width: 100px;
}
.col-error {
  width: auto;
  min-width: 200px;
  max-width: 300px;
}

/* Cell contents */
.time-text {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-page-text-subtle);
}

.user-text {
  color: var(--color-page-text);
  white-space: nowrap;
}

.operation-text {
  color: var(--color-page-text);
}

.api-text {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-page-brand);
  background: var(--color-page-brand-bg);
  padding: 3px 8px;
  border-radius: 4px;
}

.duration-text {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-page-text);
}

.error-text {
  color: var(--color-page-text-muted);
  text-align: left;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.error-text.has-error {
  color: var(--color-page-danger);
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-badge.success {
  background: var(--color-page-success-bg);
  color: var(--color-page-success);
}

.status-badge.success .status-dot {
  background: var(--color-page-success);
}

.status-badge.fail {
  background: var(--color-page-danger-bg);
  color: var(--color-page-danger);
}

.status-badge.fail .status-dot {
  background: var(--color-page-danger);
}

.status-badge.gray {
  background: var(--color-page-gray-bg);
  color: var(--color-page-gray);
}

.status-badge.gray .status-dot {
  background: var(--color-page-gray);
}

/* Table States */
.loading-cell,
.error-cell,
.empty-cell {
  text-align: center;
  padding: 60px 20px !important;
  color: var(--color-page-text-subtle);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-page-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
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
  gap: 12px;
}

.empty-cell svg {
  color: var(--color-page-text-muted);
}

.error-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: var(--color-page-danger);
}

/* ==================== Pagination ==================== */
.pagination-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--color-page-border);
}

.total-text {
  font-size: 13px;
  color: var(--color-page-text-subtle);
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--color-page-border-light);
  border-radius: 8px;
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-page-text);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 13px;
  color: var(--color-page-text);
  font-family: var(--font-code);
}

/* ==================== Detail Modal ==================== */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
}

.detail-modal {
  width: 700px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 6px;
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-page-text);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 11px;
  color: var(--color-page-text-muted);
}

.info-value {
  font-size: 13px;
  color: var(--color-page-text);
}

.info-code {
  font-family: var(--font-code);
  font-size: 12px;
  color: var(--color-page-text);
  background: transparent;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.error-section,
.data-section {
  display: flex;
  flex-direction: column;
}

.error-box {
  padding: 12px;
  background: var(--color-page-danger-bg);
  border: 1px solid rgba(248, 81, 73, 0.2);
  border-radius: 8px;
  font-size: 12px;
  color: var(--color-page-danger);
  font-family: var(--font-code);
}

.code-block {
  margin: 0;
  padding: 14px;
  background: var(--color-page-bg);
  border-radius: 8px;
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-page-text-subtle);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow-y: auto;
}

/* ==================== Scrollbar ==================== */
.table-wrapper::-webkit-scrollbar,
.code-block::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track,
.code-block::-webkit-scrollbar-track {
  background: var(--color-page-scrollbar-track);
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb,
.code-block::-webkit-scrollbar-thumb {
  background: var(--color-page-scrollbar-thumb);
  border-radius: 4px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover,
.code-block::-webkit-scrollbar-thumb:hover {
  background: var(--color-page-scrollbar-thumb-hover);
}

/* ==================== Responsive ==================== */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .logs-page {
    padding: 16px;
  }

  .filter-bar {
    flex-wrap: wrap;
  }

  .filter-dates {
    margin-left: 0;
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
