// [2026-04-30] 新增：AI 配置连通性测试 composable
import { ref } from 'vue'
import { aiConfigApi } from '@/api/ai-config'
import type { TestResult } from '@/features/ai'

export function useAiTest() {
  const testing = ref(false)
  const testResult = ref<TestResult | null>(null)
  const testError = ref('')

  async function runTest(configId: string): Promise<TestResult | null> {
    testing.value = true
    testError.value = ''
    testResult.value = null

    try {
      const result = await aiConfigApi.test(configId)
      testResult.value = result
      return result
    } catch (e: unknown) {
      testError.value = e instanceof Error ? e.message : '测试失败'
      return null
    } finally {
      testing.value = false
    }
  }

  function resetTest(): void {
    testing.value = false
    testResult.value = null
    testError.value = ''
  }

  return { testing, testResult, testError, runTest, resetTest }
}
