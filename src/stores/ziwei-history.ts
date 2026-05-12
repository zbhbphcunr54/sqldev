// src/stores/ziwei-history.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import {
  fetchZiweiHistory,
  createZiweiHistory,
  deleteZiweiHistory,
  type ZiweiHistoryItem
} from '@/api/ziwei-history'

export const useZiweiHistoryStore = defineStore('ziwei-history', () => {
  const items = ref<ZiweiHistoryItem[]>([])
  const loading = ref(false)
  const error = ref('')

  async function loadHistory(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchZiweiHistory()
      items.value = result.items
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : mapErrorCodeToMessage('history_load_failed')
    } finally {
      loading.value = false
    }
  }

  async function addHistory(
    inputJson: Record<string, unknown>,
    resultJson?: Record<string, unknown>
  ): Promise<void> {
    try {
      await createZiweiHistory(inputJson, resultJson)
      await loadHistory()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : mapErrorCodeToMessage('history_save_failed')
    }
  }

  async function removeHistory(id: string): Promise<void> {
    try {
      await deleteZiweiHistory(id)
      items.value = items.value.filter((item) => item.id !== id)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : mapErrorCodeToMessage('history_delete_failed')
    }
  }

  function $reset(): void {
    items.value = []
    loading.value = false
    error.value = ''
  }

  return { items, loading, error, loadHistory, addHistory, removeHistory, $reset }
})
