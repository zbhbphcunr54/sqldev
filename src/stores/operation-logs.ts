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
    total_requests: 0,
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
  const pageSize = ref(10) // configurable via UI selector
  const isAdmin = ref(false)
  const loading = ref(false)
  const error = ref('')
  const summary = ref<OperationLogSummary>({ ...defaultSummary })
  const operationOptions = ref<OperationLogOption[]>([])

  const filters = ref<OperationLogFilters>({})

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  const toNumber = (value: unknown, fallback = 0) => {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  interface LoadBehavior {
    withSummary?: boolean
    withOptions?: boolean
    withTotal?: boolean
  }

  async function loadLogs(behavior: LoadBehavior = {}): Promise<void> {
    const withSummary = behavior.withSummary ?? true
    const withOptions = behavior.withOptions ?? false
    const withTotal = behavior.withTotal ?? true

    loading.value = true
    error.value = ''
    try {
      const result = await fetchOperationLogs({
        page: page.value,
        pageSize: pageSize.value,
        ...filters.value,
        withSummary,
        withOptions,
        withTotal
      })
      items.value = Array.isArray(result.items) ? result.items : []
      if (result.total !== undefined) {
        total.value = Number.isFinite(result.total) ? Number(result.total) : 0
      }
      isAdmin.value = result.is_admin === true
      if (result.summary) {
        const rawSummary = result.summary
        const rawSummaryRecord = rawSummary as Record<string, unknown>
        const totalRequests = rawSummaryRecord.total_requests ?? rawSummaryRecord.today_requests
        summary.value = {
          total_requests: toNumber(totalRequests, 0),
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
        if (!withTotal) {
          total.value = toNumber(totalRequests, 0)
        }
      }
      if (Array.isArray(result.operation_options)) {
        operationOptions.value = result.operation_options
      }
    } catch (e: unknown) {
      error.value =
        e instanceof Error ? e.message : mapErrorCodeToMessage('operation_logs_load_failed')
    } finally {
      loading.value = false
    }
  }

  async function setPage(p: number): Promise<void> {
    page.value = p
    await loadLogs({
      withSummary: false,
      withOptions: false,
      withTotal: false
    })
  }

  async function setFilters(newFilters: OperationLogFilters): Promise<void> {
    filters.value = newFilters
    page.value = 1
    await loadLogs({
      withSummary: true,
      withOptions: false,
      withTotal: false
    })
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
    filters,
    totalPages,
    loadLogs,
    setPage,
    setFilters,
    $reset
  }
})
