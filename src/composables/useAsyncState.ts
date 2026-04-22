import { ref } from 'vue'

export function useAsyncState<T>() {
  const loading = ref(false)
  const data = ref<T | null>(null)
  const error = ref<string>('')

  async function run(task: () => Promise<T>): Promise<T | null> {
    loading.value = true
    error.value = ''
    try {
      const result = await task()
      data.value = result
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : '请求失败，请稍后重试'
      return null
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    loading.value = false
    data.value = null
    error.value = ''
  }

  return {
    loading,
    data,
    error,
    run,
    reset
  }
}
