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
  <div class="flex h-full flex-col gap-4 p-4">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold">操作日志</h2>
      <span v-if="store.isAdmin" class="rounded-full bg-brand-500/10 px-2 py-0.5 text-[12px] text-brand-500">
        管理员视图
      </span>
    </div>

    <OperationLogFilters @search="handleSearch" />

    <div class="min-h-0 flex-1">
      <OperationLogTable :items="store.items" @detail="handleDetail" />
    </div>

    <div v-if="store.totalPages > 1" class="flex items-center justify-center gap-2">
      <button
        :disabled="store.page <= 1"
        class="h-8 rounded-control border border-border bg-panel2 px-3 text-[13px] text-text transition-colors hover:bg-panel disabled:opacity-40"
        @click="handlePageChange(store.page - 1)"
      >
        上一页
      </button>
      <span class="text-[13px] text-subtle">
        {{ store.page }} / {{ store.totalPages }} (共 {{ store.total }} 条)
      </span>
      <button
        :disabled="store.page >= store.totalPages"
        class="h-8 rounded-control border border-border bg-panel2 px-3 text-[13px] text-text transition-colors hover:bg-panel disabled:opacity-40"
        @click="handlePageChange(store.page + 1)"
      >
        下一页
      </button>
    </div>

    <div v-if="store.loading" class="text-center text-[13px] text-subtle">加载中...</div>
    <div v-if="store.error" class="text-center text-[13px] text-danger">{{ store.error }}</div>

    <OperationLogDetail :log="selectedLog" @close="handleCloseDetail" />
  </div>
</template>