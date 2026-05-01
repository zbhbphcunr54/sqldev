// [2026-04-30] 新增：AI 配置 Pinia Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchProviders } from '@/api/ai-provider'
import { aiConfigApi } from '@/api/ai-config'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'

export const useAiStore = defineStore('ai', () => {
  const providers = ref<AiProviderDef[]>([])
  const configs = ref<AiProviderConfig[]>([])
  const loading = ref(false)
  const error = ref('')

  const activeConfig = computed(() => configs.value.find((c) => c.is_active) ?? null)
  const hasActiveConfig = computed(() => !!activeConfig.value)

  async function loadProviders(adminView = false): Promise<void> {
    providers.value = await fetchProviders(adminView)
  }

  async function loadConfigs(): Promise<void> {
    configs.value = await aiConfigApi.list()
    // 关联 provider 对象
    configs.value.forEach((c) => {
      c.provider = providers.value.find((p) => p.id === c.provider_id)
    })
  }

  async function init(adminView = false): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await loadProviders(adminView)
      await loadConfigs()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '加载失败'
    } finally {
      loading.value = false
    }
  }

  async function activateConfig(id: string): Promise<void> {
    await aiConfigApi.activate(id)
    await loadConfigs()
  }

  async function removeConfig(id: string): Promise<void> {
    await aiConfigApi.remove(id)
    await loadConfigs()
  }

  function $reset(): void {
    providers.value = []
    configs.value = []
    loading.value = false
    error.value = ''
  }

  return {
    providers,
    configs,
    loading,
    error,
    activeConfig,
    hasActiveConfig,
    init,
    loadProviders,
    loadConfigs,
    activateConfig,
    removeConfig,
    $reset
  }
})
