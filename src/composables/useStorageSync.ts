import { ref, onMounted, onUnmounted } from 'vue'
import { useTabId } from '@/composables/useTabId'

const METADATA_CACHE_KEY = 'sqldev:workbench:metadata'

export function useStorageSync() {
  const tabId = useTabId()
  const conflictDetected = ref(false)

  function onStorageEvent(event: StorageEvent): void {
    if (event.key !== METADATA_CACHE_KEY || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue)
      if (parsed._writerTabId && parsed._writerTabId !== tabId) {
        conflictDetected.value = true
      }
    } catch {
      // ignore parse errors
    }
  }

  function dismissConflict(): void {
    conflictDetected.value = false
  }

  onMounted(() => {
    window.addEventListener('storage', onStorageEvent)
  })

  onUnmounted(() => {
    window.removeEventListener('storage', onStorageEvent)
  })

  return { conflictDetected, dismissConflict }
}
