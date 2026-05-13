// [2026-05-07] AI 配置 Pinia Store - 带 localStorage 缓存
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { aiConfigApi } from '@/api/ai-config'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import { getJson, setJson, removeJson } from '@/utils/storage'

const CACHE_KEY = 'ai_config_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存，AI 配置不常变

interface CacheData {
  providers: AiProviderDef[]
  configs: AiProviderConfig[]
  timestamp: number
}

function getCache(): CacheData | null {
  const data = getJson<CacheData | null>(CACHE_KEY, null)
  if (!data) return null
  if (Date.now() - data.timestamp > CACHE_TTL) {
    removeJson(CACHE_KEY)
    return null
  }
  return data
}

function setCache(providers: AiProviderDef[], configs: AiProviderConfig[]): void {
  setJson(CACHE_KEY, { providers, configs, timestamp: Date.now() })
}

function clearCache(): void {
  removeJson(CACHE_KEY)
}

export const useAiStore = defineStore('ai', () => {
  const providers = ref<AiProviderDef[]>([])
  const configs = ref<AiProviderConfig[]>([])
  const loading = ref(false)
  const error = ref('')

  const activeConfig = computed(() => configs.value.find((c) => c.is_active) ?? null)
  const hasActiveConfig = computed(() => !!activeConfig.value)

  // 从缓存恢复数据（同步，用于快速渲染）
  function restoreFromCache(): void {
    const cached = getCache()
    if (cached) {
      providers.value = cached.providers
      configs.value = cached.configs
    }
  }

  // 预加载数据（登录后调用，不阻塞 UI）
  async function preload(): Promise<void> {
    try {
      const { providers: provs, configs: cfgs } = await aiConfigApi.fetchAll()
      providers.value = provs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      configs.value = cfgs
      setCache(providers.value, cfgs)
    } catch (err) {
      console.error('[AiStore] Preload failed:', err)
    }
  }

  // 初始化（进入页面时调用）
  // 先显示缓存，再静默刷新
  async function init(_adminView = false): Promise<void> {
    // 先尝试从缓存恢复
    restoreFromCache()

    // 如果缓存为空，显示 loading
    if (providers.value.length === 0) {
      loading.value = true
      error.value = ''
    }

    try {
      // 静默刷新数据
      const { providers: provs, configs: cfgs } = await aiConfigApi.fetchAll()
      providers.value = provs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      configs.value = cfgs
      setCache(providers.value, cfgs)
    } catch (e: unknown) {
      // 如果没有缓存数据，才显示错误
      if (providers.value.length === 0) {
        error.value = e instanceof Error ? e.message : '加载失败'
      }
    } finally {
      loading.value = false
    }
  }

  async function loadProviders(_adminView = false): Promise<void> {
    // 保存后必须清除缓存，强制重新获取最新数据
    clearCache()
    const { providers: provs } = await aiConfigApi.fetchAll()
    providers.value = provs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    setCache(providers.value, configs.value)
  }

  async function loadConfigs(): Promise<void> {
    clearCache()
    const { configs: cfgs } = await aiConfigApi.fetchAll()
    configs.value = cfgs
    setCache(providers.value, cfgs)
  }

  async function activateConfig(id: string): Promise<void> {
    // 乐观更新：立即切换本地状态，提升响应速度
    const oldConfigs = configs.value.map((c) => ({ ...c }))
    configs.value = configs.value.map((c) => ({
      ...c,
      is_active: c.id === id
    }))
    try {
      await aiConfigApi.activate(id)
      clearCache()
    } catch (err) {
      console.error('[AiStore] Activate config failed:', err)
      configs.value = oldConfigs
      throw new Error('激活失败')
    }
  }

  async function deactivateConfig(id: string): Promise<void> {
    // 乐观更新：立即切换本地状态
    const oldConfigs = configs.value.map((c) => ({ ...c }))
    const target = configs.value.find((c) => c.id === id)
    if (target) target.is_active = false
    configs.value = [...configs.value]
    try {
      await aiConfigApi.deactivate(id)
      clearCache()
    } catch (err) {
      console.error('[AiStore] Deactivate config failed:', err)
      configs.value = oldConfigs
      throw new Error('取消激活失败')
    }
  }

  async function removeConfig(id: string): Promise<void> {
    const oldConfigs = configs.value
    configs.value = configs.value.filter((c) => c.id !== id)
    try {
      await aiConfigApi.remove(id)
      clearCache()
    } catch {
      configs.value = oldConfigs
      throw new Error('删除失败')
    }
  }

  async function addConfig(payload: Parameters<typeof aiConfigApi.create>[0]): Promise<void> {
    // 追加模型模式：跳过乐观更新，直接等服务端返回后一次性插入
    // 乐观条目的 api_key_masked 可能与已有组的真实值不一致，导致 groupedConfigs
    // 按 provider_id + api_key_masked 分组时产生临时分组 → 表格闪现新行
    if (!payload.api_key) {
      const newConfig = await aiConfigApi.create(payload)
      configs.value = [...configs.value, newConfig]
      clearCache()
      return
    }

    // 新增 Key 模式：乐观更新（用户输入了 api_key，可本地算出准确的 api_key_masked）
    const tempId = `optimistic-${Date.now()}`
    const optimistic: AiProviderConfig = {
      id: tempId,
      provider_id: payload.provider_id,
      model: payload.model,
      api_key_masked: payload.api_key!.slice(0, 4) + '****' + payload.api_key!.slice(-4),
      base_url: payload.base_url || '',
      name: payload.name || '',
      is_active: false,
      timeout_ms: 0,
      last_test_ok: null,
      last_test_ms: null,
      last_test_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    configs.value = [...configs.value, optimistic]
    try {
      const newConfig = await aiConfigApi.create(payload)
      configs.value = configs.value.map((c) => (c.id === tempId ? newConfig : c))
      clearCache()
    } catch (e) {
      configs.value = configs.value.filter((c) => (c.id !== tempId))
      throw e
    }
  }

  async function testConfig(id: string): Promise<void> {
    const result = await aiConfigApi.test(id)
    const cfg = configs.value.find((c) => c.id === id)
    if (cfg) {
      cfg.last_test_ok = result.ok
      cfg.last_test_ms = result.elapsed_ms
      cfg.last_test_at = new Date().toISOString()
    }
    clearCache()
  }

  // 更新 localStorage 缓存（乐观更新后同步，如拖拽排序）
  function persistToCache(): void {
    setCache(providers.value, configs.value)
  }

  function $reset(): void {
    providers.value = []
    configs.value = []
    loading.value = false
    error.value = ''
    clearCache()
  }

  return {
    providers,
    configs,
    loading,
    error,
    activeConfig,
    hasActiveConfig,
    init,
    preload,
    loadProviders,
    loadConfigs,
    activateConfig,
    deactivateConfig,
    removeConfig,
    addConfig,
    testConfig,
    persistToCache,
    $reset
  }
})
