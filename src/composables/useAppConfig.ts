import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { appConfigApi } from '@/api/app-config'
import type { AppConfig } from '@/features/app-config'
import { CATEGORY_LABELS } from '@/features/app-config'

export function useAppConfig() {
  const configs = ref<AppConfig[]>([])
  const loading = ref(false)
  const clearingCache = ref(false)
  const selectedTab = ref('all')
  const searchQuery = ref('')
  const searchDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const showEditModal = ref(false)
  const editingConfig = ref<AppConfig | null>(null)

  const toast = ref<{ type: 'error'; message: string } | null>(null)
  const toastTimer = ref<ReturnType<typeof setTimeout> | null>(null)

  const deleteConfirm = ref<{ open: boolean; config: AppConfig | null }>({ open: false, config: null })

  const typeTabs = computed(() => {
    const counts: Record<string, number> = { string: 0, number: 0, boolean: 0 }
    configs.value.forEach((c) => {
      if (c.value_type === 'string') counts.string++
      else if (c.value_type === 'number') counts.number++
      else if (c.value_type === 'boolean') counts.boolean++
    })
    return [
      { key: 'all', label: '全部', count: configs.value.length },
      { key: 'string', label: '字符串', count: counts.string },
      { key: 'number', label: '数字', count: counts.number },
      { key: 'boolean', label: '布尔', count: counts.boolean }
    ]
  })

  const filteredConfigs = computed(() => {
    let items = [...configs.value]
    if (selectedTab.value !== 'all') items = items.filter((c) => c.value_type === selectedTab.value)
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.toLowerCase()
      items = items.filter((c) => c.key.toLowerCase().includes(q) || (c.description && c.description.toLowerCase().includes(q)))
    }
    return items
  })

  const lastUpdateTime = computed(() => {
    if (configs.value.length === 0) return null
    const latest = configs.value.reduce((max, c) => (c.updated_at > max.updated_at ? c : max))
    const d = new Date(latest.updated_at)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  })

  function hideToast(): void { toast.value = null }

  function showToast(message: string): void {
    if (toastTimer.value) clearTimeout(toastTimer.value)
    toast.value = { type: 'error', message }
    toastTimer.value = setTimeout(hideToast, 4000)
  }

  async function loadConfigs(): Promise<void> {
    loading.value = true
    hideToast()
    try {
      const res = await appConfigApi.list()
      if (res.ok) configs.value = res.configs
      else showToast('部分配置加载失败，请检查网络后重试')
    } catch { showToast('部分配置加载失败，请检查网络后重试') }
    finally { loading.value = false }
  }

  async function clearCache(): Promise<void> {
    clearingCache.value = true
    hideToast()
    try {
      const res = await appConfigApi.clearCache()
      if (res.ok) await loadConfigs()
      else showToast('清除缓存失败')
    } catch { showToast('清除缓存失败') }
    finally { clearingCache.value = false }
  }

  function handleNewConfig(): void { editingConfig.value = null; showEditModal.value = true }
  function handleEdit(config: AppConfig): void { editingConfig.value = config; showEditModal.value = true }
  function handleDeleteRequest(config: AppConfig): void { deleteConfirm.value = { open: true, config } }

  async function confirmDelete(): Promise<void> {
    if (!deleteConfirm.value.config) return
    const config = deleteConfirm.value.config
    deleteConfirm.value = { open: false, config: null }
    hideToast()
    try { await appConfigApi.delete(config.id); await loadConfigs() }
    catch { showToast('删除失败') }
  }

  function cancelDelete(): void { deleteConfirm.value = { open: false, config: null } }

  async function handleToggleStatus(config: AppConfig): Promise<void> {
    const newStatus = !config.is_active
    try {
      const res = await appConfigApi.update(config.id, { is_active: newStatus })
      if (res.ok) config.is_active = newStatus
    } catch { showToast('状态更新失败') }
  }

  async function handleSaved(): Promise<void> { showEditModal.value = false; await loadConfigs() }
  function handleCloseModal(): void { showEditModal.value = false; editingConfig.value = null }

  onMounted(() => { loadConfigs() })

  onBeforeUnmount(() => {
    if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value)
    if (toastTimer.value) clearTimeout(toastTimer.value)
  })

  watch(searchQuery, () => {
    if (searchDebounceTimer.value) clearTimeout(searchDebounceTimer.value)
    searchDebounceTimer.value = setTimeout(() => { /* reactive, no-op */ }, 300)
  })

  return {
    CATEGORY_LABELS, configs, loading, clearingCache, selectedTab, searchQuery,
    showEditModal, editingConfig, toast, deleteConfirm,
    typeTabs, filteredConfigs, lastUpdateTime,
    loadConfigs, clearCache, handleNewConfig, handleEdit, handleDeleteRequest,
    confirmDelete, cancelDelete, handleToggleStatus, handleSaved, handleCloseModal,
    hideToast
  }
}
