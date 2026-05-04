// src/stores/operation-logs.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchOperationLogs,
  type OperationLog,
  type OperationLogFilters
} from '@/api/operation-logs'

export const useOperationLogsStore = defineStore('operation-logs', () => {
  const items = ref<OperationLog[]>([])
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(20)
  const isAdmin = ref(false)
  const loading = ref(false)
  const error = ref('')

  const filters = ref<OperationLogFilters>({})

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value))

  async function loadLogs(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchOperationLogs({
        page: page.value,
        pageSize: pageSize.value,
        ...filters.value
      })
      items.value = result.items
      total.value = result.total
      isAdmin.value = result.is_admin
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '加载日志失败'
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
    filters.value = {}
  }

  return {
    items, total, page, pageSize, isAdmin, loading, error, filters, totalPages,
    loadLogs, setPage, setFilters, $reset
  }
})