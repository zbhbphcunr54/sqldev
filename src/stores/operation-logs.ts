// src/stores/operation-logs.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import {
  fetchOperationLogs,
  type OperationLog,
  type OperationLogFilters,
  type OperationLogOption,
  type OperationLogSummary
} from '@/api/operation-logs'

export const useOperationLogsStore = defineStore('operation-logs', () => {
  const defaultSummary: OperationLogSummary = {
    today_requests: 0,
    request_change_rate: null,
    success_rate: 0,
    fail_count: 0,
    avg_duration_ms: 0,
    p95_duration_ms: 0,
    active_users: 0
  }

  const items = ref<OperationLog[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(10)
  const isAdmin = ref(false)
  const loading = ref(false)
  const error = ref('')
  const summary = ref<OperationLogSummary>({ ...defaultSummary })
  const operationOptions = ref<OperationLogOption[]>([])
  const apiOptions = ref<OperationLogOption[]>([])

  const filters = ref<OperationLogFilters>({})

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  async function loadLogs(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchOperationLogs({
        page: page.value,
        pageSize: pageSize.value,
        ...filters.value
      })
      items.value = Array.isArray(result.items) ? result.items : []
      total.value = Number.isFinite(result.total) ? Number(result.total) : 0
      isAdmin.value = result.is_admin === true
      const rawSummary = result.summary || {}
      summary.value = {
        today_requests: toNumber(rawSummary.today_requests, 0),
        request_change_rate:
          rawSummary.request_change_rate === null || rawSummary.request_change_rate === undefined
            ? null
            : toNumber(rawSummary.request_change_rate, 0),
        success_rate: toNumber(rawSummary.success_rate, 0),
        fail_count: toNumber(rawSummary.fail_count, 0),
        avg_duration_ms: toNumber(rawSummary.avg_duration_ms, 0),
        p95_duration_ms: toNumber(rawSummary.p95_duration_ms, 0),
        active_users: toNumber(rawSummary.active_users, 0)
      }
      operationOptions.value = Array.isArray(result.operation_options)
        ? result.operation_options
        : []
      apiOptions.value = Array.isArray(result.api_options) ? result.api_options : []
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : mapErrorCodeToMessage('operation_logs_load_failed')
    } finally {
      loading.value = false
    }
  }

  async function setPage(p: number): Promise<void> {
    page.value = p
    await loadLogs()
  }

  async function setFilters(newFilters: OperationLogFilters): Promise<void> {
    filters.value = newFilters
    page.value = 1
    await loadLogs()
  }

  function $reset(): void {
    items.value = []
    total.value = 0
    page.value = 1
    isAdmin.value = false
    loading.value = false
    error.value = ''
    summary.value = { ...defaultSummary }
    operationOptions.value = []
    apiOptions.value = []
    filters.value = {}
  }

  return {
    items,
    total,
    page,
    pageSize,
    isAdmin,
    loading,
    error,
    summary,
    operationOptions,
    apiOptions,
    filters,
    totalPages,
    loadLogs,
    setPage,
    setFilters,
    $reset
  }
})
