<!-- [2026-05-04] 更新：操作日志页面，匹配设计预览 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useOperationLogsStore } from '@/stores/operation-logs'
import OperationLogFilters from '@/components/business/operation-logs/OperationLogFilters.vue'
import OperationLogTable from '@/components/business/operation-logs/OperationLogTable.vue'
import OperationLogDetail from '@/components/business/operation-logs/OperationLogDetail.vue'
import type { OperationLog } from '@/api/operation-logs'

const store = useOperationLogsStore()
const selectedLog = ref<OperationLog | null>(null)

onMounted(() => {
  store.loadLogs()
})

function handleSearch(filters: {
  operation?: string
  apiName?: string
  startDate?: string
  endDate?: string
}): void {
  store.setFilters(filters)
}

function handleDetail(log: OperationLog): void {
  selectedLog.value = log
}

function handleCloseDetail(): void {
  selectedLog.value = null
}

async function handlePageChange(p: number): Promise<void> {
  await store.setPage(p)
}
</script>

<template>
  <div class="logs-page">
    <!-- Page Header -->
    <header class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">操作日志</h1>
        <p class="page-subtitle">查看 API 调用记录</p>
      </div>
      <div class="page-header-right">
        <button class="btn">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
            <path d="M2 3h8l2 2v7H2z"/>
            <path d="M4 3v2.5h5V3"/>
          </svg>
          导出
        </button>
      </div>
    </header>

    <!-- Filters -->
    <OperationLogFilters @search="handleSearch" />

    <!-- Content -->
    <div class="page-content">
      <!-- Loading -->
      <div v-if="store.loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Error -->
      <div v-else-if="store.error" class="error-state">
        <p class="error-message">{{ store.error }}</p>
        <button class="btn" @click="store.loadLogs()">重试</button>
      </div>

      <!-- Table -->
      <template v-else>
        <OperationLogTable :items="store.items" @detail="handleDetail" />
      </template>
    </div>

    <!-- Pagination -->
    <div v-if="store.totalPages > 1" class="pagination">
      <div class="pagination-info">
        共 {{ store.total }} 条记录，第 {{ store.page }}/{{ store.totalPages }} 页
      </div>
      <div class="pagination-controls">
        <button
          class="page-btn"
          :disabled="store.page <= 1"
          @click="handlePageChange(store.page - 1)"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
            <path d="M9 11L5 7l4-4"/>
          </svg>
        </button>
        <button
          v-for="p in Math.min(5, store.totalPages)"
          :key="p"
          class="page-btn"
          :class="{ active: store.page === p }"
          @click="handlePageChange(p)"
        >
          {{ p }}
        </button>
        <button
          v-if="store.totalPages > 5"
          class="page-btn"
        >
          ...
        </button>
        <button
          class="page-btn"
          :disabled="store.page >= store.totalPages"
          @click="handlePageChange(store.page + 1)"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
            <path d="M5 3l4 4-4 4"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Detail Drawer -->
    <OperationLogDetail :log="selectedLog" @close="handleCloseDetail" />
  </div>
</template>

<style scoped>
.logs-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.page-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.page-subtitle {
  font-size: 12px;
  color: var(--color-success);
  margin: 0;
}

.page-header-right {
  display: flex;
  gap: 8px;
}

.page-content {
  flex: 1;
  overflow-y: auto;
}

.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-brand-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: var(--color-danger);
  margin: 0;
}

.btn {
  padding: 7px 15px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel);
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
  border-color: var(--color-border-hover);
  background: var(--color-panel-2);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 14px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel);
}

.pagination-info {
  font-size: 13px;
  color: var(--color-text-subtle);
}

.pagination-controls {
  display: flex;
  gap: 4px;
}

.page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: var(--color-panel-2);
}

.page-btn.active {
  background: var(--color-brand-500);
  color: white;
  border-color: var(--color-brand-500);
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
