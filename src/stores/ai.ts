import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { aiConfigApi } from '@/api/ai-config'
import { useAuthStore } from '@/stores/auth'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import { getJson, removeJson, setJson } from '@/utils/storage'

const CACHE_TTL = 30 * 60 * 1000

interface CacheData {
  providers: AiProviderDef[]
  personalConfigs: AiProviderConfig[]
  globalConfigs: AiProviderConfig[]
  hasGlobalActive: boolean
  timestamp: number
}

function getCacheKey(userId: string | null): string {
  return `sqldev:ai:config-cache:${userId ?? 'anonymous'}`
}

function getSelectedKeyStorageKey(userId: string | null): string {
  return `sqldev:ai:selected-models:${userId ?? 'anonymous'}`
}

function getCache(userId: string | null): CacheData | null {
  const data = getJson<CacheData | null>(getCacheKey(userId), null)
  if (!data) return null
  if (Date.now() - data.timestamp > CACHE_TTL) {
    removeJson(getCacheKey(userId))
    return null
  }
  return data
}

function setCache(userId: string | null, data: Omit<CacheData, 'timestamp'>): void {
  setJson(getCacheKey(userId), { ...data, timestamp: Date.now() })
}

function clearCache(userId: string | null): void {
  removeJson(getCacheKey(userId))
}

function clearSelections(userId: string | null): void {
  removeJson(getSelectedKeyStorageKey(userId))
}


export const useAiStore = defineStore('ai', () => {
  const providers = ref<AiProviderDef[]>([])
  const personalConfigs = ref<AiProviderConfig[]>([])
  const globalConfigs = ref<AiProviderConfig[]>([])
  const loading = ref(false)
  const error = ref('')
  const activeScope = ref<'personal' | 'global'>('personal')
  const hasGlobalActive = ref(false)
  const auth = useAuthStore()

  const currentUserId = computed(() => auth.user?.id ?? null)

  const configs = computed(() =>
    activeScope.value === 'global' ? globalConfigs.value : personalConfigs.value
  )

  const activeConfig = computed(
    () =>
      personalConfigs.value.find((c) => c.is_active) ??
      globalConfigs.value.find((c) => c.is_active) ??
      null
  )
  const hasActiveConfig = computed(() => !!activeConfig.value)


  function restoreFromCache(): void {
    const cached = getCache(currentUserId.value)
    if (!cached) return
    providers.value = cached.providers
    personalConfigs.value = cached.personalConfigs
    globalConfigs.value = cached.globalConfigs
    hasGlobalActive.value = cached.hasGlobalActive
  }


  function setScope(scope: 'personal' | 'global'): void {
    activeScope.value = scope
  }

  async function fetchAll(): Promise<void> {
    const { providers: provs, personalConfigs: personal, globalConfigs: global, hasGlobalActive: hasGlobal } =
      await aiConfigApi.fetchAll(activeScope.value)
    providers.value = provs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    personalConfigs.value = personal
    globalConfigs.value = global
    hasGlobalActive.value = hasGlobal
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  async function init(_force?: boolean): Promise<void> {
    restoreFromCache()
    if (providers.value.length === 0 && personalConfigs.value.length === 0 && globalConfigs.value.length === 0) {
      loading.value = true
      error.value = ''
    }
    try {
      await fetchAll()
    } catch (e: unknown) {
      if (providers.value.length === 0) {
        error.value = e instanceof Error ? e.message : '加载失败'
      }
    } finally {
      loading.value = false
    }
  }

  async function preload(): Promise<void> {
    try {
      await fetchAll()
    } catch (err) {
      console.error('[AiStore] Preload failed:', err)
    }
  }

  async function loadProviders(): Promise<void> {
    const { providers: provs, hasGlobalActive: hasGlobal } = await aiConfigApi.fetchAll(activeScope.value)
    providers.value = provs.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    hasGlobalActive.value = hasGlobal
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  async function loadConfigs(): Promise<void> {
    const result = await aiConfigApi.fetchAll(activeScope.value)
    personalConfigs.value = result.personalConfigs
    globalConfigs.value = result.globalConfigs
    hasGlobalActive.value = result.hasGlobalActive
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  async function activateConfig(id: string): Promise<void> {
    const target = personalConfigs.value.find((c) => c.id === id) ?? globalConfigs.value.find((c) => c.id === id)
    if (!target) return
    const oldPersonal = personalConfigs.value.map((c) => ({ ...c }))
    const oldGlobal = globalConfigs.value.map((c) => ({ ...c }))
    if (target.scope === 'global') {
      globalConfigs.value = globalConfigs.value.map((c) => ({ ...c, is_active: c.id === id }))
    } else {
      personalConfigs.value = personalConfigs.value.map((c) => ({ ...c, is_active: c.id === id }))
    }
    try {
      await aiConfigApi.activate(id)
      if (target.scope === 'global') hasGlobalActive.value = true
      setCache(currentUserId.value, {
        providers: providers.value,
        personalConfigs: personalConfigs.value,
        globalConfigs: globalConfigs.value,
        hasGlobalActive: hasGlobalActive.value
      })
    } catch (err) {
      console.error('[AiStore] Activate config failed:', err)
      personalConfigs.value = oldPersonal
      globalConfigs.value = oldGlobal
      throw err
    }
  }

  async function deactivateConfig(id: string): Promise<void> {
    const target = personalConfigs.value.find((c) => c.id === id) ?? globalConfigs.value.find((c) => c.id === id)
    const oldPersonal = personalConfigs.value.map((c) => ({ ...c }))
    const oldGlobal = globalConfigs.value.map((c) => ({ ...c }))
    personalConfigs.value = personalConfigs.value.map((c) =>
      c.id === id ? { ...c, is_active: false } : c
    )
    globalConfigs.value = globalConfigs.value.map((c) =>
      c.id === id ? { ...c, is_active: false } : c
    )
    try {
      await aiConfigApi.deactivate(id)
      if (target?.scope === 'global' && globalConfigs.value.every((c) => !c.is_active)) {
        hasGlobalActive.value = false
      }
      setCache(currentUserId.value, {
        providers: providers.value,
        personalConfigs: personalConfigs.value,
        globalConfigs: globalConfigs.value,
        hasGlobalActive: hasGlobalActive.value
      })
    } catch (err) {
      console.error('[AiStore] Deactivate config failed:', err)
      personalConfigs.value = oldPersonal
      globalConfigs.value = oldGlobal
      throw err
    }
  }

  async function removeConfig(id: string): Promise<void> {
    const target = personalConfigs.value.find((c) => c.id === id) ?? globalConfigs.value.find((c) => c.id === id)
    const oldPersonal = personalConfigs.value
    const oldGlobal = globalConfigs.value
    personalConfigs.value = personalConfigs.value.filter((c) => c.id !== id)
    globalConfigs.value = globalConfigs.value.filter((c) => c.id !== id)
    try {
      await aiConfigApi.remove(id)
      if (target?.scope === 'global' && globalConfigs.value.every((c) => !c.is_active)) {
        hasGlobalActive.value = false
      }
      setCache(currentUserId.value, {
        providers: providers.value,
        personalConfigs: personalConfigs.value,
        globalConfigs: globalConfigs.value,
        hasGlobalActive: hasGlobalActive.value
      })
    } catch {
      personalConfigs.value = oldPersonal
      globalConfigs.value = oldGlobal
      throw new Error('删除失败')
    }
  }

  async function addConfig(payload: Parameters<typeof aiConfigApi.create>[0]): Promise<void> {
    const newConfig = await aiConfigApi.create(payload, activeScope.value)
    if (newConfig.scope === 'global') globalConfigs.value = [...globalConfigs.value, newConfig]
    else personalConfigs.value = [...personalConfigs.value, newConfig]
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  async function testConfig(id: string): Promise<void> {
    const result = await aiConfigApi.test(id)
    const cfg =
      personalConfigs.value.find((c) => c.id === id) ?? globalConfigs.value.find((c) => c.id === id)
    if (cfg) {
      cfg.last_test_ok = result.ok
      cfg.last_test_ms = result.elapsed_ms
      cfg.last_test_at = new Date().toISOString()
    }
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  function persistToCache(): void {
    setCache(currentUserId.value, {
      providers: providers.value,
      personalConfigs: personalConfigs.value,
      globalConfigs: globalConfigs.value,
      hasGlobalActive: hasGlobalActive.value
    })
  }

  function $reset(userIdToClear?: string | null): void {
    providers.value = []
    personalConfigs.value = []
    globalConfigs.value = []
    hasGlobalActive.value = false
    loading.value = false
    error.value = ''
    activeScope.value = 'personal'
    const targetUserId = userIdToClear ?? currentUserId.value
    clearCache(targetUserId)
    clearSelections(targetUserId)
  }

  return {
    providers,
    configs,
    personalConfigs,
    globalConfigs,
    loading,
    error,
    activeConfig,
    hasActiveConfig,
    hasGlobalActive,
    activeScope,
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
    setScope,
    $reset
  }
})
