<!-- [2026-05-06] 操作日志页面 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useOperationLogsStore } from '@/stores/operation-logs'
import type { OperationLog } from '@/api/operation-logs'
import FormSelect from '@/components/common/FormSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'

const store = useOperationLogsStore()
const selectedLog = ref<OperationLog | null>(null)

onMounted(() => {
  store.setFilters(buildCurrentFilters())
  document.addEventListener('mousemove', onModalMousemove)
  document.addEventListener('mouseup', onModalMouseup)
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onModalMousemove)
  document.removeEventListener('mouseup', onModalMouseup)
})

// Stats
const stats = computed(() => ({
  total: store.summary.total_requests,
  successRate: store.summary.success_rate.toFixed(1),
  avgDuration: store.summary.avg_duration_ms,
  failCount: store.summary.fail_count
}))

// Filter state
const filterStatus = ref('')
const filterOperation = ref('')

// Initialize dates with today's date (YYYY-MM-DD format)
const today = new Date()
const pad = (n: number) => String(n).padStart(2, '0')
const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const filterStartDate = ref(toDateStr(today))
const filterEndDate = ref(toDateStr(today))

function buildCurrentFilters() {
  return {
    operation: filterOperation.value || undefined,
    startDate: filterStartDate.value || undefined,
    endDate: filterEndDate.value || undefined,
    status: filterStatus.value || undefined
  }
}

// Constants
const OPERATION_MAP: Record<string, string> = {
  sql_convert: 'SQL AI转换',
  id_card_generate: '身份证号码生成',
  id_card_validate: '身份证号码校验',
  uscc_generate: '统一社会信用代码生成',
  uscc_validate: '统一社会信用代码校验',
  ziwei_chart_generate: '紫微斗数排盘',
  ziwei_analysis: '命盘AI解读',
  ziwei_qa: '基于AI命盘问答',
  ai_provider_create: '新增供应商',
  ai_provider_update: '编辑供应商',
  ai_provider_delete: '删除供应商',
  ai_config_create: '新增Key',
  ai_config_append_model: '追加模型',
  ai_config_test: '测试Key',
  ai_config_delete: '删除Key',
  ai_chat_message: 'AI助手对话'
}

const OPERATION_OPTIONS = [
  { value: '', label: '全部' },
  ...Object.entries(OPERATION_MAP).map(([value, label]) => ({ value, label }))
]

const STATUS_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'fail', label: '失败' }
]

const PAGE_SIZE_OPTIONS = [
  { value: '10', label: '10条/页' },
  { value: '20', label: '20条/页' },
  { value: '50', label: '50条/页' }
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

const phaseTimingLabels: Record<string, string> = {
  auth_ms: '鉴权',
  config_ms: '配置加载',
  rate_limit_ms: '限流检查',
  db_list_ms: '数据库白名单',
  template_ms: 'Prompt 模板',
  ai_config_ms: 'AI 配置解析',
  ai_call_ms: 'AI 调用',
  parse_ms: '结果解析'
}

const selectedPhaseTimings = computed(() => {
  const extra = selectedLog.value?.extra
  const timings = extra && typeof extra === 'object' ? (extra as Record<string, unknown>).phase_timings : null
  if (!timings || typeof timings !== 'object' || Array.isArray(timings)) return []

  return Object.entries(timings as Record<string, unknown>)
    .filter(([, value]) => Number.isFinite(Number(value)))
    .map(([key, value]) => ({
      key,
      label: phaseTimingLabels[key] ?? key,
      value: Math.round(Number(value))
    }))
})

// Handlers
function handleSearch(): void {
  store.setFilters(buildCurrentFilters())
}

function handleReset(): void {
  filterStatus.value = ''
  filterOperation.value = ''
  const todayStr = toDateStr(new Date())
  filterStartDate.value = todayStr
  filterEndDate.value = todayStr
  store.setFilters(buildCurrentFilters())
}

function handleSelectLog(log: OperationLog): void {
  selectedLog.value = log
}

function handleCloseDetail(): void {
  selectedLog.value = null
  modalDrag.value.isDragging = false
}

// Modal drag
const modalDrag = ref({
  isDragging: false,
  offsetX: 0,
  offsetY: 0,
  posX: 0,
  posY: 0
})
const modalRef = ref<HTMLElement | null>(null)

function onModalHeaderMousedown(e: MouseEvent): void {
  if (!modalRef.value) return
  modalDrag.value.isDragging = true
  modalDrag.value.offsetX = e.clientX
  modalDrag.value.offsetY = e.clientY
  const rect = modalRef.value.getBoundingClientRect()
  modalDrag.value.posX = rect.left
  modalDrag.value.posY = rect.top
}

function onModalMousemove(e: MouseEvent): void {
  if (!modalDrag.value.isDragging || !modalRef.value) return
  const dx = e.clientX - modalDrag.value.offsetX
  const dy = e.clientY - modalDrag.value.offsetY
  modalRef.value.style.left = modalDrag.value.posX + dx + 'px'
  modalRef.value.style.top = modalDrag.value.posY + dy + 'px'
  modalRef.value.style.transform = 'none'
}

function onModalMouseup(): void {
  modalDrag.value.isDragging = false
}

async function handlePageChange(p: number): Promise<void> {
  await store.setPage(p)
  selectedLog.value = null
}

async function handlePageSizeChange(size: string): Promise<void> {
  store.pageSize = Number(size)
  selectedLog.value = null
  await store.setPage(1)
}
</script>

<template>
  <div class="logs-page">
    <!-- Page Header -->
    <header class="page-header">
      <h1 class="page-title">操作日志</h1>
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
      <label class="filter-label">状态</label>
      <FormSelect
        v-model="filterStatus"
        :options="STATUS_OPTIONS"
        placeholder="全部"
        compact
        class="filter-select filter-select--status"
      />
      <label class="filter-label">操作</label>
      <FormSelect
        v-model="filterOperation"
        :options="OPERATION_OPTIONS"
        placeholder="全部"
        compact
        class="filter-select filter-select--operation"
      />
      <div class="filter-dates">
        <DatePicker
          v-model="filterStartDate"
          placeholder="开始日期"
          compact
          class="filter-date-picker"
        />
        <span class="filter-sep">-</span>
        <DatePicker
          v-model="filterEndDate"
          placeholder="结束日期"
          compact
          class="filter-date-picker"
        />
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
              <th class="col-status">状态</th>
              <th class="col-duration">耗时</th>
              <th class="col-msg">请求报文</th>
              <th class="col-msg">返回报文</th>
              <th class="col-action">操作</th>
            </tr>
          </thead>
          <tbody class="table-body">
            <template v-if="store.loading">
              <tr>
                <td colspan="8" class="loading-cell">
                  <div class="loading-spinner"></div>
                  <span>加载中...</span>
                </td>
              </tr>
            </template>

            <template v-else-if="store.error">
              <tr>
                <td colspan="8" class="error-cell">
                  <span>{{ store.error }}</span>
                  <button class="btn btn-ghost btn-sm" @click="store.loadLogs({ withTotal: false })">重试</button>
                </td>
              </tr>
            </template>

            <template v-else-if="tableRows.length === 0">
              <tr>
                <td colspan="8" class="empty-cell">
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
                <td class="col-msg">
                  <span v-if="row.log.request_body" class="msg-indicator" title="有请求报文">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </span>
                  <span v-else class="msg-none">—</span>
                </td>
                <td class="col-msg">
                  <span v-if="row.log.response_body" class="msg-indicator success" title="有返回报文">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </span>
                  <span v-else class="msg-none">—</span>
                </td>
                <td class="col-action">
                  <button class="detail-btn" @click.stop="handleSelectLog(row.log)">详情</button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <footer class="pagination-footer">
        <div class="pagination-left">
          <span class="total-text">共 {{ store.total }} 条记录</span>
          <div class="page-size-selector">
            <FormSelect
              :model-value="String(store.pageSize)"
              :options="PAGE_SIZE_OPTIONS"
              compact
              flip-upward
              @update:model-value="handlePageSizeChange"
            />
          </div>
        </div>
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
        <div ref="modalRef" class="detail-modal" style="left: 50%; top: 50%; transform: translate(-50%, -50%);">
          <div class="modal-header" @mousedown="onModalHeaderMousedown">
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
                <span class="info-value">{{ selectedLog.client_ip || '-' }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">操作</span>
                <span class="info-value">{{ getOperationLabel(selectedLog.operation) }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">状态</span>
                <span :class="['status-badge', selectedLogStatus?.class]">
                  {{ selectedLogStatus?.label }}
                </span>
              </div>
              <div class="info-item">
                <span class="info-label">耗时</span>
                <span class="info-value">{{
                  selectedLog.duration_ms != null ? `${selectedLog.duration_ms}ms` : '-'
                }}</span>
              </div>
            </div>

            <div v-if="selectedPhaseTimings.length > 0" class="data-section">
              <h4 class="section-title">阶段耗时</h4>
              <div class="timing-grid">
                <div v-for="item in selectedPhaseTimings" :key="item.key" class="timing-chip">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}ms</strong>
                </div>
              </div>
            </div>

            <div v-if="selectedLog.error_message" class="error-section">
              <h4 class="section-title">错误信息</h4>
              <div class="error-box">{{ selectedLog.error_message }}</div>
            </div>

            <div v-if="selectedLog.request_body" class="data-section">
              <h4 class="section-title">请求报文</h4>
              <pre class="code-block body-font">{{ formatJson(selectedLog.request_body) }}</pre>
            </div>

            <div v-if="selectedLog.response_body" class="data-section">
              <h4 class="section-title">返回报文</h4>
              <pre class="code-block body-font">{{ formatJson(selectedLog.response_body) }}</pre>
            </div>

            <div v-if="selectedLog.extra" class="data-section">
              <h4 class="section-title">扩展字段</h4>
              <pre class="code-block body-font">{{ formatJson(selectedLog.extra) }}</pre>
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
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  color: var(--color-text);
  font-family: var(--font-body);
  padding: 0 24px;
  overflow: hidden;
  box-sizing: border-box;
}

/* ==================== Page Header ==================== */
.page-header {
  display: flex;
  align-items: center;
  height: 56px;
  padding-top: 8px;
  flex-shrink: 0;
  margin-bottom: 20px;
}

.page-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--color-text);
  font-family: var(--font-body);
  margin: 0;
  letter-spacing: -0.02em;
}

/* ==================== Stats Cards ==================== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
  flex-shrink: 0;
}

.stat-card {
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 700;
  font-family: var(--font-body);
  color: var(--color-page-text);
}

.stat-value.success {
  color: var(--color-page-success);
}

.stat-value.fail {
  color: var(--color-page-danger);
}

.stat-label {
  font-size: var(--text-sm);
  color: var(--color-page-text-subtle);
  font-family: var(--font-body);
}

/* ==================== Filter Bar ==================== */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
  flex-shrink: 0;
}

.filter-label {
  font-size: var(--text-sm);
  font-family: var(--font-body);
  color: var(--color-page-text-subtle);
  white-space: nowrap;
}

.filter-select {
  flex-shrink: 0;
}

.filter-select:deep(.form-select-wrapper) {
  width: 100%;
}

.filter-select--status {
  width: 96px;
}

.filter-select--operation {
  width: 220px;
  flex-shrink: 0;
}

.filter-dates {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.filter-date-picker {
  width: 144px;
}

.filter-sep {
  color: var(--color-page-text-muted);
  font-size: var(--text-sm);
  font-family: var(--font-body);
}

.filter-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ==================== Buttons ==================== */
.btn {
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
  border: 1px solid var(--color-page-border);
  background: var(--color-page-panel);
  color: var(--color-page-text);
  font-family: var(--font-body);
}

.btn:hover {
  background: var(--color-page-input);
  border-color: var(--color-page-border-hover);
}

.btn-primary {
  background: var(--color-page-brand);
  border-color: var(--color-page-brand);
  color: var(--color-btn-primary-text);
}

.btn-primary:hover {
  background: var(--color-page-brand-hover);
  border-color: var(--color-page-brand-hover);
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
}

.btn-ghost:hover {
  background: var(--color-page-input);
  border-color: var(--color-page-border);
}

/* .btn-sm uses main.css definition */
.btn-sm {
  height: 28px;
  padding: 0 10px;
  font-size: var(--text-xs);
}

/* ==================== Table ==================== */
.table-section {
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
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
  font-size: var(--text-sm);
  font-family: var(--font-body);
  table-layout: fixed;
}

.log-table .table-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--color-page-input);
}

.log-table thead tr {
  background: var(--color-page-input);
}

.log-table th {
  padding: 14px 16px;
  text-align: center;
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-page-border);
  white-space: nowrap;
  font-family: var(--font-body);
}

.log-table td {
  padding: 14px 16px;
  text-align: center;
  border-bottom: 1px solid var(--color-page-border);
  vertical-align: middle;
  color: var(--color-page-text);
  font-family: var(--font-body);
}

.log-table tbody tr {
  transition: background var(--duration-fast) var(--ease-apple);
}

.log-table tbody tr:hover {
  background: var(--color-page-input);
}

.log-table tbody tr.row-error {
  background: var(--color-page-danger-bg);
  border-left: 3px solid var(--color-page-danger);
}

.log-table tbody tr.row-error:hover {
  background: var(--color-page-danger-bg);
}

/* Column widths */
.col-time { width: 160px; }
.col-user { width: 180px; }
.col-operation { width: 100px; }
.col-status { width: 100px; }
.col-duration { width: 90px; }
.col-msg { width: 70px; }
.col-action { width: 60px; }

/* Cell contents */
.time-text {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-page-text-subtle);
}

.user-text {
  color: var(--color-page-text);
  font-family: var(--font-body);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.operation-text {
  color: var(--color-page-text);
  font-size: var(--text-sm);
  font-family: var(--font-body);
}

.duration-text {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  color: var(--color-page-text);
}

/* Message indicator */
.msg-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-page-brand);
}

.msg-indicator.success {
  color: var(--color-page-success);
}

.msg-none {
  color: var(--color-page-text-muted);
  font-family: var(--font-body);
}

/* Detail Button */
.detail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  background: var(--color-page-brand);
  border: 1px solid var(--color-page-brand);
  border-radius: var(--radius-sm);
  color: var(--color-btn-primary-text);
  font-size: var(--text-xs);
  font-family: var(--font-body);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

/* Status Badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-body);
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
  font-family: var(--font-body);
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-page-border);
  border-top-color: var(--color-page-brand);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  padding: 14px 16px;
  border-top: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.pagination-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-text {
  font-size: var(--text-sm);
  color: var(--color-page-text-subtle);
  font-family: var(--font-body);
}

.page-size-selector {
  width: 100px;
}

.page-size-selector > :deep(.form-select-wrapper) {
  width: 100%;
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
  width: 32px;
  height: 32px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-sm);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
  font-family: var(--font-body);
}

.page-btn:hover:not(:disabled) {
  background: var(--color-page-panel);
  color: var(--color-page-text);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: var(--text-sm);
  color: var(--color-page-text);
  font-family: var(--font-body);
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
  position: fixed;
  z-index: 1001;
  width: 700px;
  max-width: 90vw;
  max-height: 85vh;
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
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
  cursor: move;
  user-select: none;
}

.modal-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-page-text);
  font-family: var(--font-body);
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-sm);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.modal-close:hover {
  background: var(--color-page-panel);
  color: var(--color-page-text);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-family: var(--font-body);
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
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  font-family: var(--font-body);
}

.info-value {
  font-size: var(--text-sm);
  color: var(--color-page-text);
  font-family: var(--font-body);
}

.section-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
  font-family: var(--font-body);
}

.error-section,
.data-section {
  display: flex;
  flex-direction: column;
}

.timing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.timing-chip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--color-page-bg);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-page-text);
}

.timing-chip strong {
  font-size: var(--text-xs);
  color: var(--color-page-brand);
  font-family: var(--font-code, var(--font-body));
}

.error-box {
  padding: 12px;
  background: var(--color-page-danger-bg);
  border: 1px solid var(--color-page-danger);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--color-page-danger);
  font-family: var(--font-body);
}

.code-block {
  margin: 0;
  padding: 14px;
  background: var(--color-page-bg);
  border-radius: var(--radius-md);
  font-size: var(--text-xs);
  color: var(--color-page-text-subtle);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 250px;
  overflow-y: auto;
}

.code-block.body-font {
  font-family: var(--font-body);
}

/* ==================== Scrollbar ==================== */
.table-wrapper::-webkit-scrollbar,
.code-block::-webkit-scrollbar,
.modal-body::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.table-wrapper::-webkit-scrollbar-track,
.code-block::-webkit-scrollbar-track,
.modal-body::-webkit-scrollbar-track {
  background: var(--color-page-scrollbar-track);
  border-radius: var(--radius-xs);
}

.table-wrapper::-webkit-scrollbar-thumb,
.code-block::-webkit-scrollbar-thumb,
.modal-body::-webkit-scrollbar-thumb {
  background: var(--color-page-scrollbar-thumb);
  border-radius: var(--radius-xs);
}

.table-wrapper::-webkit-scrollbar-thumb:hover,
.code-block::-webkit-scrollbar-thumb:hover,
.modal-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-page-scrollbar-thumb-hover);
}

/* ==================== Responsive ==================== */
@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .info-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .logs-page { padding: 16px; }
  .filter-bar { flex-wrap: wrap; }
  .filter-dates { margin-left: 0; width: 100%; justify-content: flex-start; }
  .filter-select--operation { width: 180px; }
  .filter-date-picker { width: 132px; }
}
</style>
