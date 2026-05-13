<!-- [2026-05-07] AI 配置页面 - 新设计 -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/stores/ai'
import { getProviderColor, getProviderInitials } from '@/features/ai/provider-constants'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import { aiConfigApi } from '@/api/ai-config'
import { ApiError } from '@/api/http'
import { useConfirm } from '@/composables/useConfirm'
import ProviderConfigModal from './ProviderConfigModal.vue'
import AddKeyModal from './AddKeyModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { getJson, setJson } from '@/utils/storage'

const { confirm } = useConfirm()

// Stores
const aiStore = useAiStore()
const { providers, configs, loading, error } = storeToRefs(aiStore)

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '发生未知错误，请稍后重试。'
}

// Modal state
const showProviderModal = ref(false)
const editingProvider = ref<AiProviderDef | null>(null)
const showAddKeyModal = ref(false)

// ============ Drag State ============
const isDragging = ref(false)
const draggedProvider = ref<AiProviderDef | null>(null)
const draggedIndex = ref<number>(-1)
const dropIndex = ref<number>(-1)
const dragPosition = ref({ x: 0, y: 0 })
const gridRef = ref<HTMLElement | null>(null)

// Long press detection
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_DELAY = 150 // ms
const DRAG_THRESHOLD = 5 // px movement before starting drag

// ============ Drag Handlers (Custom) ============
function onCardMouseDown(e: MouseEvent, provider: AiProviderDef): void {
  if ((e.target as HTMLElement).closest('button')) return

  const idx = providers.value.findIndex((p) => p.id === provider.id)
  if (idx === -1) return

  const startX = e.clientX
  const startY = e.clientY
  let hasMoved = false

  longPressTimer = setTimeout(() => {
    if (!hasMoved) {
      startDrag(provider, idx, e.clientX, e.clientY)
    }
  }, LONG_PRESS_DELAY)

  const handleMove = (moveEvent: MouseEvent) => {
    const movedX = Math.abs(moveEvent.clientX - startX)
    const movedY = Math.abs(moveEvent.clientY - startY)

    if (movedX > DRAG_THRESHOLD || movedY > DRAG_THRESHOLD) {
      hasMoved = true
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
      startDrag(provider, idx, moveEvent.clientX, moveEvent.clientY)
    }
  }

  const handleUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleUp)
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleUp)
}

function startDrag(provider: AiProviderDef, idx: number, clientX: number, clientY: number): void {
  draggedProvider.value = provider
  draggedIndex.value = idx
  isDragging.value = true

  // Position clone at mouse location (offset slightly so cursor is visible)
  dragPosition.value = {
    x: clientX - 100,
    y: clientY - 20
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging.value) return

  dragPosition.value = {
    x: e.clientX - 100,
    y: e.clientY - 20
  }

  if (gridRef.value) {
    const cards = gridRef.value.querySelectorAll('.provider-card')
    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect()

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom &&
        idx !== draggedIndex.value
      ) {
        dropIndex.value = idx
      }
    })
  }
}

function onMouseUp(): void {
  let orderChanged = false
  if (
    dropIndex.value !== -1 &&
    draggedIndex.value !== -1 &&
    dropIndex.value !== draggedIndex.value
  ) {
    const newProviders = [...providers.value]
    const [removed] = newProviders.splice(draggedIndex.value, 1)
    const adjustedTargetIdx =
      dropIndex.value > draggedIndex.value ? dropIndex.value - 1 : dropIndex.value
    newProviders.splice(adjustedTargetIdx, 0, removed)
    providers.value = newProviders
    orderChanged = true
  }

  // 保存排序到服务器
  if (orderChanged) {
    // 乐观更新缓存，避免 API 返回前刷新页面导致旧缓存覆盖新顺序
    aiStore.persistToCache()
    const orders = providers.value.map((p, idx) => ({
      provider_id: p.id,
      sort_order: idx
    }))
    aiConfigApi.reorderProviders(orders).catch(async (err: unknown) => {
      const errorMsg = err instanceof Error ? err.message : '保存排序失败，请刷新重试'
      await confirm(`排序保存失败: ${errorMsg}\n\n刷新后排序将恢复原状。`, {
        title: '保存失败',
        confirmText: '我知道了'
      })
    })
  }

  resetDragState()
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

function resetDragState(): void {
  isDragging.value = false
  draggedProvider.value = null
  draggedIndex.value = -1
  dropIndex.value = -1
}

// Computed: provider configs grouped
const providerConfigsMap = computed(() => {
  const map = new Map<string, AiProviderConfig[]>()
  configs.value.forEach((c) => {
    const arr = map.get(c.provider_id) ?? []
    arr.push(c)
    map.set(c.provider_id, arr)
  })
  return map
})

function isProviderConfigured(providerId: string): boolean {
  return (providerConfigsMap.value.get(providerId)?.length ?? 0) > 0
}

// ============ Grouped Configs (merged by provider for display) ============
interface GroupedConfig {
  providerId: string
  providerSlug: string
  apiKeyMasked: string
  baseUrl: string
  configs: AiProviderConfig[]
}

const groupedConfigs = computed(() => {
  const map = new Map<string, GroupedConfig>()
  for (const c of configs.value) {
    const p = getProviderById(c.provider_id)
    const key = `${c.provider_id}::${c.api_key_masked}`
    if (!map.has(key)) {
      map.set(key, {
        providerId: c.provider_id,
        providerSlug: p?.slug ?? '',
        apiKeyMasked: c.api_key_masked,
        baseUrl: c.base_url,
        configs: []
      })
    }
    map.get(key)!.configs.push(c)
  }
  return [...map.values()]
})

// Total model count and configured provider count
const totalModelCount = computed(() => configs.value.length)
const configuredProviderCount = computed(() => providerConfigsMap.value.size)

// Persisted model selection per group key
const STORAGE_KEY_SELECTED = 'sqldev:ai:selected-models'

function readSelectedFromStorage(): Record<string, string> {
  return getJson<Record<string, string>>(STORAGE_KEY_SELECTED, {})
}

function writeSelectedToStorage(map: Record<string, string>): void {
  setJson(STORAGE_KEY_SELECTED, map)
}

// Track which config is selected per group key
const selectedConfigId = ref<Record<string, string>>(readSelectedFromStorage())

function getSelectedConfig(group: GroupedConfig): AiProviderConfig | undefined {
  const id = selectedConfigId.value[groupKey(group)]
  return group.configs.find((c) => c.id === id) ?? group.configs[0]
}

const tableRows = computed(() =>
  groupedConfigs.value.map((g) => ({
    group: g,
    selected: getSelectedConfig(g)
  }))
)

function groupKey(group: GroupedConfig): string {
  return `${group.providerId}::${group.apiKeyMasked}`
}

function ensureSelectedConfig(group: GroupedConfig): void {
  const key = groupKey(group)
  const current = selectedConfigId.value[key]
  // Keep current selection if it still exists in the group
  if (current && group.configs.some((c) => c.id === current)) return
  // Prefer the active config
  const active = group.configs.find((c) => c.is_active)
  if (active) {
    selectedConfigId.value[key] = active.id
    return
  }
  // Fall back to the last config
  selectedConfigId.value[key] = group.configs[group.configs.length - 1]?.id ?? ''
}

function cycleModel(group: GroupedConfig, direction: 1 | -1): void {
  const configs = group.configs
  if (configs.length <= 1) return
  const current = getSelectedConfig(group)
  const idx = current ? configs.indexOf(current) : 0
  const next = (idx + direction + configs.length) % configs.length
  selectedConfigId.value[groupKey(group)] = configs[next].id
  writeSelectedToStorage(selectedConfigId.value)
}

// Watch groupedConfigs to auto-select latest model when new ones are added
watch(
  groupedConfigs,
  (groups) => {
    for (const g of groups) {
      ensureSelectedConfig(g)
    }
  },
  { immediate: true, deep: true }
)

function isDraggingCard(provider: AiProviderDef): boolean {
  return isDragging.value && draggedProvider.value?.id === provider.id
}

// Helper: check if card should show drop indicator
function isDropTargetCard(idx: number): boolean {
  return isDragging.value && dropIndex.value === idx && idx !== draggedIndex.value
}

function onCardClick(e: MouseEvent, provider: AiProviderDef): void {
  if (!isDragging.value) {
    openEditProvider(provider)
  }
}

// Helper: get unique card colors based on provider
function getCardBgStart(_provider: AiProviderDef): string {
  return 'var(--color-accent-bg)'
}

function getCardBgEnd(_provider: AiProviderDef): string {
  return 'var(--color-panel-3)'
}

function getCardBorderColor(provider: AiProviderDef): string {
  return getProviderColor(provider.slug)
}

// 判断是国内还是国外模型 - 直接使用 provider.region 字段
function getRegionLabel(provider: AiProviderDef): { label: string; isDomestic: boolean } {
  const isDomestic = provider.region === 'cn'
  return { label: isDomestic ? '国内' : '海外', isDomestic }
}

// 悬停状态
const hoveredProvider = ref<AiProviderDef | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const showTooltip = ref(false)
const TOOLTIP_WIDTH = 300
const TOOLTIP_OFFSET = 12

function updateTooltipPosition(e: MouseEvent): void {
  let x = e.clientX + TOOLTIP_OFFSET
  let y = e.clientY + TOOLTIP_OFFSET

  // 检测右边界
  if (x + TOOLTIP_WIDTH > window.innerWidth - 20) {
    x = e.clientX - TOOLTIP_WIDTH - TOOLTIP_OFFSET
  }

  // 检测下边界
  if (y + 200 > window.innerHeight - 20) {
    y = window.innerHeight - 220
  }

  tooltipPosition.value = { x, y }
}

function onCardHover(e: MouseEvent, provider: AiProviderDef): void {
  hoveredProvider.value = provider
  updateTooltipPosition(e)
  showTooltip.value = true
}

function onCardLeave(): void {
  showTooltip.value = false
  hoveredProvider.value = null
}

function onTooltipMouseMove(e: MouseEvent): void {
  updateTooltipPosition(e)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
})

// Add Key modal handlers
const addKeyPrefill = ref<{ providerId?: string; apiKey?: string; apiKeyMasked?: string }>({})

function openAddKey(): void {
  addKeyPrefill.value = {}
  showAddKeyModal.value = true
}

function openAppendModel(providerId: string, apiKeyMasked: string): void {
  addKeyPrefill.value = { providerId, apiKeyMasked }
  showAddKeyModal.value = true
}

function closeAddKeyModal(): void {
  showAddKeyModal.value = false
  addKeyPrefill.value = {}
}

async function handleAddKeySaved(payload: {
  provider_id: string
  model: string
  api_key: string
  base_url?: string
  name?: string
}): Promise<void> {
  const groupKey = addKeyPrefill.value.apiKeyMasked
  closeAddKeyModal()
  await aiStore.addConfig({ ...payload, api_key_masked: groupKey })
}

// Provider modal handlers
function openAddProvider(): void {
  editingProvider.value = null
  showProviderModal.value = true
}

function openEditProvider(provider: AiProviderDef): void {
  editingProvider.value = provider
  showProviderModal.value = true
}

function closeProviderModal(): void {
  showProviderModal.value = false
  editingProvider.value = null
}

async function handleProviderSave(payload: {
  isEdit: boolean
  providerId?: string
  data: {
    label: string
    slug?: string
    base_url: string
    region: string
    api_format: string
    models: string[]
  }
}): Promise<void> {
  closeProviderModal()
  try {
    if (payload.isEdit && payload.providerId) {
      const updated = await aiConfigApi.updateProvider(payload.providerId, payload.data)
      const idx = providers.value.findIndex((p) => p.id === updated.id)
      if (idx !== -1) {
        providers.value[idx] = { ...providers.value[idx], ...updated }
      }
      // 编辑可能删除孤儿模型 → 后台刷新 configs
      aiStore.loadConfigs()
    } else {
      const created = await aiConfigApi.createProvider({
        label: payload.data.label,
        slug: payload.data.slug!,
        base_url: payload.data.base_url,
        region: payload.data.region,
        api_format: payload.data.api_format,
        models: payload.data.models
      })
      providers.value = [...providers.value, created].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
      )
    }
    aiStore.persistToCache()
  } catch (e: unknown) {
    error.value = getErrorMessage(e)
  }
}

// Key actions
async function handleDeleteModel(config: AiProviderConfig): Promise<void> {
  const providerLabel = getProviderById(config.provider_id)?.label ?? config.provider_id
  const ok = await confirm(`确定删除「${providerLabel}」的模型 ${config.model} 吗？`, {
    title: '删除模型',
    confirmText: '删除',
    confirmClass: 'danger'
  })
  if (!ok) return
  await aiStore.removeConfig(config.id)
  // 清理已删除模型的选中状态
  delete selectedConfigId.value[`${config.provider_id}::${config.api_key_masked}`]
}

async function handleToggleActive(config: AiProviderConfig): Promise<void> {
  try {
    if (config.is_active) {
      await aiStore.deactivateConfig(config.id)
    } else {
      await aiStore.activateConfig(config.id)
    }
  } catch (e) {
    console.error('[AiConfig] Toggle active failed:', e)
  }
}

// Test config
const testingIds = ref<Set<string>>(new Set())
const testResults = ref<Map<string, { ok: boolean; elapsed_ms: number; error?: string }>>(new Map())

// 冷却状态：同 provider 下所有 config 共享冷却期
const cooldownEndTimes = ref<Map<string, number>>(new Map()) // provider_id → end timestamp
const cooldownRemaining = ref<Map<string, number>>(new Map()) // config_id → remaining seconds
let cooldownTimer: ReturnType<typeof setInterval> | null = null

function startCooldownTimer(): void {
  if (cooldownTimer) return
  cooldownTimer = setInterval(() => {
    const now = Date.now()
    let hasActive = false
    for (const [providerId, endTime] of cooldownEndTimes.value) {
      if (now < endTime) {
        hasActive = true
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000))
        configs.value
          .filter((c) => c.provider_id === providerId)
          .forEach((c) => cooldownRemaining.value.set(c.id, remaining))
      } else {
        cooldownEndTimes.value.delete(providerId)
        configs.value
          .filter((c) => c.provider_id === providerId)
          .forEach((c) => {
            cooldownRemaining.value.delete(c.id)
            // 清除冷却错误残留，回退显示 DB 中的 last_test 值
            const r = testResults.value.get(c.id)
            if (r && !r.ok && r.error?.includes('请等待')) {
              testResults.value.delete(c.id)
            }
          })
      }
    }
    if (!hasActive && cooldownTimer) {
      clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}

function setProviderCooldown(providerId: string, seconds: number): void {
  cooldownEndTimes.value.set(providerId, Date.now() + seconds * 1000)
  configs.value
    .filter((c) => c.provider_id === providerId)
    .forEach((c) => cooldownRemaining.value.set(c.id, seconds))
  startCooldownTimer()
}

function isInCooldown(configId: string): boolean {
  return cooldownRemaining.value.has(configId)
}

function getCooldownRemaining(configId: string): number {
  return cooldownRemaining.value.get(configId) ?? 0
}

async function handleTest(config: AiProviderConfig): Promise<void> {
  if (testingIds.value.has(config.id) || isInCooldown(config.id)) return
  testingIds.value.add(config.id)
  try {
    const result = await aiConfigApi.test(config.id)
    testResults.value.set(config.id, result)
    if (!result.ok && result.cooldown_remaining) {
      setProviderCooldown(config.provider_id, result.cooldown_remaining)
    }
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : '测试失败'
    testResults.value.set(config.id, {
      ok: false,
      elapsed_ms: 0,
      error: errMsg
    })
    // 429 冷却响应经 http 层转为 ApiError，cooldown_remaining 在 data 中
    if (e instanceof ApiError && typeof e.data?.cooldown_remaining === 'number') {
      setProviderCooldown(config.provider_id, e.data.cooldown_remaining)
    }
  } finally {
    testingIds.value.delete(config.id)
  }
}

function getTestResult(
  configId: string
): { ok: boolean; elapsed_ms: number; error?: string } | null {
  return testResults.value.get(configId) || null
}

function isTesting(configId: string): boolean {
  return testingIds.value.has(configId) || isInCooldown(configId)
}

// Provider actions
async function handleDeleteProvider(provider: AiProviderDef): Promise<void> {
  const configCount = providerConfigsMap.value.get(provider.id)?.length ?? 0
  const message =
    configCount > 0
      ? `确定删除「${provider.label}」供应商吗？\n\n这将同时删除该供应商下的 ${configCount} 个 API Key 配置。`
      : `确定删除「${provider.label}」供应商吗？`

  const ok = await confirm(message, {
    title: '删除供应商',
    confirmText: '删除',
    confirmClass: 'danger'
  })
  if (!ok) return

  try {
    await aiConfigApi.deleteProvider(provider.id)
    // 从本地列表中移除
    providers.value = providers.value.filter((p) => p.id !== provider.id)
    // 重新加载配置（级联删除后配置已删除）
    await aiStore.loadConfigs()
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : '删除失败'
    await confirm(errorMsg, { title: '操作失败' })
  }
}

// Get provider by ID
function getProviderById(id: string): AiProviderDef | undefined {
  return providers.value.find((p) => p.id === id)
}

// Lifecycle
onMounted(() => {
  aiStore.init(true).catch((err) => {
    error.value = getErrorMessage(err)
  })
})
</script>

<template>
  <div class="ai-config-page">
    <!-- Upper Section: Provider Cards (42%) -->
    <section class="providers-section">
      <div class="section-header">
        <div class="header-left">
          <h2 class="section-title">AI 供应商</h2>
          <p class="section-desc">管理支持的 AI 服务商及其可用模型</p>
        </div>
        <button class="btn-add" @click="openAddProvider">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          新增供应商
        </button>
      </div>
      <div ref="gridRef" class="providers-grid">
        <div
          v-for="(provider, idx) in providers"
          :key="provider.id"
          :data-provider-id="provider.id"
          class="provider-card"
          tabindex="0"
          :class="{
            'is-dragging': isDraggingCard(provider),
            'is-drop-target': isDropTargetCard(idx)
          }"
          :style="{
            animationDelay: `${idx * 50}ms`,
            '--card-color': getCardBorderColor(provider),
            '--card-bg-start': getCardBgStart(provider),
            '--card-bg-end': getCardBgEnd(provider)
          }"
          @mouseenter="(e) => onCardHover(e, provider)"
          @mousemove="onTooltipMouseMove"
          @mouseleave="onCardLeave"
          @mousedown="(e) => onCardMouseDown(e, provider)"
          @click="(e) => onCardClick(e, provider)"
        >
          <button
            class="card-delete-btn"
            title="删除供应商"
            @click.stop="handleDeleteProvider(provider)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
              />
            </svg>
          </button>
          <div class="card-content">
            <div class="card-header">
              <div class="provider-icon" :style="{ background: getProviderColor(provider.slug) }">
                {{ getProviderInitials(provider.slug, provider.label) }}
              </div>
              <div class="provider-info">
                <div class="provider-name-row">
                  <span class="provider-name">{{ provider.label }}</span>
                  <span
                    class="status-dot"
                    :class="{ configured: isProviderConfigured(provider.id) }"
                    :title="isProviderConfigured(provider.id) ? '已配置' : '未配置'"
                  ></span>
                </div>
                <span class="provider-meta">
                  {{ provider.models.length }} 模型 · {{ getRegionLabel(provider).label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dragging clone that follows the mouse -->
      <Teleport to="body">
        <div
          v-if="isDragging && draggedProvider"
          class="drag-clone"
          :style="{
            left: dragPosition.x + 'px',
            top: dragPosition.y + 'px',
            '--card-color': getCardBorderColor(draggedProvider),
            '--card-bg-start': getCardBgStart(draggedProvider),
            '--card-bg-end': getCardBgEnd(draggedProvider)
          }"
        >
          <div class="card-content">
            <div class="card-header">
              <div
                class="provider-icon"
                :style="{ background: getProviderColor(draggedProvider.slug) }"
              >
                {{ getProviderInitials(draggedProvider.slug, draggedProvider.label) }}
              </div>
              <div class="provider-info">
                <div class="provider-name-row">
                  <span class="provider-name">{{ draggedProvider.label }}</span>
                </div>
                <span class="provider-meta">
                  {{ draggedProvider.models.length }} 模型 ·
                  {{ getRegionLabel(draggedProvider).label }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Hover Tooltip -->
      <Teleport to="body">
        <div
          v-if="showTooltip && hoveredProvider"
          class="provider-tooltip"
          :style="{ left: tooltipPosition.x + 'px', top: tooltipPosition.y + 'px' }"
        >
          <div class="tooltip-header">
            <div
              class="tooltip-icon"
              :style="{ background: getProviderColor(hoveredProvider.slug) }"
            >
              {{ getProviderInitials(hoveredProvider.slug, hoveredProvider.label) }}
            </div>
            <div class="tooltip-title">
              <span class="tooltip-name">{{ hoveredProvider.label }}</span>
              <span
                class="tooltip-region"
                :class="{ domestic: getRegionLabel(hoveredProvider).isDomestic }"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                {{ getRegionLabel(hoveredProvider).label }}
              </span>
            </div>
          </div>
          <div class="tooltip-stats">
            <div class="tooltip-stat">
              <span class="stat-value">{{ hoveredProvider.models.length }}</span>
              <span class="stat-label">模型</span>
            </div>
            <div class="tooltip-stat">
              <span class="stat-value">{{
                providerConfigsMap.get(hoveredProvider.id)?.length ?? 0
              }}</span>
              <span class="stat-label">已配置</span>
            </div>
          </div>
          <div v-if="hoveredProvider.models.length > 0" class="tooltip-models">
            <span class="models-title">可用模型</span>
            <div class="models-list">
              <span
                v-for="model in hoveredProvider.models.slice(0, 8)"
                :key="model"
                class="model-tag"
              >
                {{ model }}
              </span>
              <span v-if="hoveredProvider.models.length > 8" class="model-more">
                +{{ hoveredProvider.models.length - 8 }}
              </span>
            </div>
          </div>
        </div>
      </Teleport>

      <div v-if="providers.length === 0 && !loading" class="empty-providers">
        <p>暂无供应商配置</p>
      </div>
    </section>

    <!-- Lower Section: API Key Management (58%) -->
    <section class="keys-section">
      <div class="section-header">
        <div class="header-left">
          <h2 class="section-title">API Key 管理</h2>
          <p class="section-desc">
            已配置 {{ totalModelCount }} 个模型，覆盖 {{ configuredProviderCount }} 个供应商
          </p>
        </div>
        <button class="btn-add" @click="openAddKey">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          新增 Key
        </button>
      </div>

      <!-- Keys Table -->
      <div class="keys-table-wrapper">
        <table class="keys-table">
          <colgroup>
            <col class="col-provider" />
            <col class="col-model" />
            <col class="col-key" />
            <col class="col-address" />
            <col class="col-status" />
            <col class="col-latency" />
            <col class="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th>供应商</th>
              <th>模型</th>
              <th>API Key</th>
              <th>接口地址</th>
              <th>状态</th>
              <th>延迟</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="groupKey(row.group)">
              <td class="td-left">
                <div class="td-provider">
                  <div
                    class="td-icon"
                    :style="{ background: getProviderColor(row.group.providerSlug) }"
                  >
                    {{
                      getProviderInitials(
                        row.group.providerSlug,
                        getProviderById(row.group.providerId)?.label ?? ''
                      )
                    }}
                  </div>
                  <span>{{
                    getProviderById(row.group.providerId)?.label ?? row.group.providerId
                  }}</span>
                </div>
              </td>
              <td class="td-left td-model-cell">
                <div class="model-stepper">
                  <span class="stepper-label">{{ row.selected?.model ?? '--' }}</span>
                  <div class="stepper-arrows">
                    <button
                      class="stepper-arrow"
                      :disabled="row.group.configs.length <= 1"
                      @click="cycleModel(row.group, -1)"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="m18 15-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      class="stepper-arrow"
                      :disabled="row.group.configs.length <= 1"
                      @click="cycleModel(row.group, 1)"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </div>
                </div>
              </td>
              <td class="td-left">
                <code class="td-code td-masked">{{ row.group.apiKeyMasked }}</code>
              </td>
              <td class="td-left">
                <code class="td-code td-url">{{ row.group.baseUrl }}</code>
              </td>
              <td>
                <button
                  v-if="row.selected"
                  class="toggle-switch"
                  :class="{ active: row.selected.is_active }"
                  @click="handleToggleActive(row.selected)"
                >
                  <span class="toggle-handle"></span>
                </button>
              </td>
              <td class="td-latency">
                <template v-if="row.selected">
                  <span v-if="isInCooldown(row.selected.id)" class="latency-badge cooldown">
                    冷却 {{ getCooldownRemaining(row.selected.id) }}s
                  </span>
                  <span
                    v-else-if="getTestResult(row.selected.id)"
                    class="latency-badge"
                    :class="{ ok: getTestResult(row.selected.id)?.ok }"
                  >
                    <template v-if="getTestResult(row.selected.id)?.ok"
                      >{{ getTestResult(row.selected.id)?.elapsed_ms }}ms</template
                    >
                    <template v-else>{{
                      getTestResult(row.selected.id)?.error ?? '失败'
                    }}</template>
                  </span>
                  <span
                    v-else-if="row.selected.last_test_ms !== null"
                    class="latency-badge"
                    :class="{ ok: row.selected.last_test_ok }"
                  >
                    {{ row.selected.last_test_ok ? row.selected.last_test_ms + 'ms' : '失败' }}
                  </span>
                  <span v-else class="latency-none">--</span>
                </template>
              </td>
              <td>
                <div class="td-actions">
                  <template v-if="row.selected">
                    <button
                      class="action-btn test"
                      :class="{ testing: isTesting(row.selected.id) }"
                      :disabled="isTesting(row.selected.id)"
                      @click="handleTest(row.selected)"
                    >
                      <template v-if="isInCooldown(row.selected.id)"
                        >冷却 {{ getCooldownRemaining(row.selected.id) }}s</template
                      >
                      <template v-else-if="isTesting(row.selected.id)">测试中...</template>
                      <template v-else>测试</template>
                    </button>
                    <button class="action-btn delete" @click="handleDeleteModel(row.selected)">
                      删除
                    </button>
                  </template>
                  <button
                    class="action-btn add-model"
                    @click="openAppendModel(row.group.providerId, row.group.apiKeyMasked)"
                  >
                    + 模型
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="configs.length === 0 && !loading" class="empty-table">
          <p>暂无 API Key 配置</p>
          <p class="empty-hint">点击上方「新增 Key」添加</p>
        </div>
      </div>
    </section>

    <!-- Loading State -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="error-toast">
      <span>{{ error }}</span>
      <button @click="aiStore.init(true)">重试</button>
    </div>

    <!-- Provider Config Modal -->
    <ProviderConfigModal
      :open="showProviderModal"
      :provider="editingProvider"
      :providers="providers"
      @close="closeProviderModal"
      @save="handleProviderSave"
    />

    <!-- Add Key Modal -->
    <AddKeyModal
      :open="showAddKeyModal"
      :providers="providers"
      :existing-configs="configs"
      :prefill-provider-id="addKeyPrefill.providerId"
      :prefill-api-key="addKeyPrefill.apiKey"
      @close="closeAddKeyModal"
      @save="handleAddKeySaved"
    />

    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

<style scoped>
/* ==================== Page Layout ==================== */
.ai-config-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-panel);
  color: var(--color-text);
  position: relative;
  font-family: var(--font-body);
  overflow: hidden;
}

/* ==================== Section Base ==================== */
.providers-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  padding: 10px 8px 8px;
  border-bottom: 1px solid var(--color-page-border-hover);
  max-height: 48%;
  overflow: hidden;
}

.keys-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 8px 24px;
  overflow: hidden;
  min-height: 0;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  padding: 0;
  vertical-align: middle;
}

.toggle-switch.active {
  background: var(--color-success);
  border-color: var(--color-success);
}

.toggle-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-subtle);
  transition: all var(--duration-normal) ease;
}

.toggle-switch.active .toggle-handle {
  left: 22px;
  background: var(--color-btn-primary-text);
}

.section-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 64px 0 24px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.section-title {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
  text-align: left;
}

.section-desc {
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--color-text-subtle);
  margin: 0;
}

/* ==================== Add Button ==================== */
.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: var(--color-btn-primary-text);
  font-size: 13px;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.btn-add:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-hover);
}

/* ==================== Provider Cards Grid ==================== */
.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  padding-top: 10px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.providers-grid::-webkit-scrollbar {
  width: 6px;
}

.providers-grid::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.providers-grid::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.provider-card {
  position: relative;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: 16px;
  padding: 14px 16px;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  overflow: hidden;
  animation: fadeUp var(--duration-slow) ease-out both;
  min-height: 80px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.provider-card:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: var(--shadow-lg);
  border-color: var(--color-page-border-hover);
}

.provider-card:hover .provider-icon {
  box-shadow: 0 0 24px var(--card-color);
}

.provider-card:active {
  cursor: grabbing;
}

.provider-card.is-dragging {
  opacity: 0.3;
  transform: scale(0.95);
}

.provider-card.is-drop-target {
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 0 16px var(--color-accent-border);
  transform: scale(1.02);
}

/* Delete button on card */
.card-delete-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-page-border-subtle);
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--duration-fast) ease;
  z-index: 10;
}

.provider-card:hover .card-delete-btn,
.provider-card:focus-within .card-delete-btn {
  opacity: 1;
}

.card-delete-btn:hover {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* Drag clone that follows mouse */
.drag-clone {
  position: fixed;
  width: 200px;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border: 1px solid var(--card-color);
  border-radius: 16px;
  padding: 14px 16px;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  z-index: 9999;
  pointer-events: none;
  transform: rotate(3deg) scale(1.05);
  transition: transform 0.05s ease;
}

/* ==================== Hover Tooltip ==================== */
.provider-tooltip {
  position: fixed;
  z-index: 9998;
  min-width: 260px;
  max-width: 320px;
  background: var(--color-panel-3);
  border: 1px solid var(--color-page-border-hover);
  border-radius: 12px;
  padding: 14px;
  box-shadow: var(--shadow-lg);
  pointer-events: none;
  animation: tooltipFadeIn var(--duration-fast) ease-out;
  font-family: var(--font-body);
}

@keyframes tooltipFadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.tooltip-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
}

.tooltip-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tooltip-name {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tooltip-region {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-accent);
  font-weight: 500;
}

.tooltip-region.domestic {
  color: var(--color-warning);
}

.tooltip-region svg {
  opacity: 0.8;
}

.tooltip-stats {
  display: flex;
  gap: 16px;
  padding: 10px 0;
  border-top: 1px solid var(--color-page-border-subtle);
  border-bottom: 1px solid var(--color-page-border-subtle);
  margin-bottom: 10px;
}

.tooltip-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-family: var(--font-body);
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--color-text-subtle);
}

.tooltip-models {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.models-title {
  font-family: var(--font-body);
  font-size: 10px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-tag {
  font-family: var(--font-body);
  font-size: 11px;
  padding: 3px 8px;
  background: var(--color-panel-2);
  border-radius: 4px;
  color: var(--color-text-subtle);
}

.model-more {
  font-family: var(--font-body);
  font-size: 11px;
  padding: 3px 8px;
  background: var(--color-accent-bg);
  border-radius: 4px;
  color: var(--color-accent);
  font-weight: 500;
}

.drag-clone .card-content,
.drag-clone .card-header,
.drag-clone .provider-icon,
.drag-clone .provider-info,
.drag-clone .provider-name,
.drag-clone .provider-meta {
  all: unset;
  display: flex;
  flex-direction: column;
}

.drag-clone .card-content {
  flex-direction: column;
  flex: 1;
}

.drag-clone .card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.drag-clone .provider-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
}

.drag-clone .provider-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.drag-clone .provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drag-clone .provider-meta {
  font-size: 12px;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.provider-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
  box-shadow: 0 0 16px var(--card-color);
  transition: box-shadow var(--duration-normal) ease;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  transition: background var(--duration-normal) ease;
  flex-shrink: 0;
}

.status-dot.configured {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.provider-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-name {
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.provider-meta {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-providers {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  font-size: 13px;
}

/* ==================== Keys Table ==================== */
.keys-table-wrapper {
  overflow: auto;
  max-height: 100%;
  background: var(--color-panel-2);
  border: 1px solid var(--color-page-border-hover);
  border-radius: 12px;
}

.keys-table-wrapper::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.keys-table-wrapper::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.keys-table-wrapper::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.keys-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  font-family: var(--font-body);
}

.keys-table thead {
  position: sticky;
  top: 0;
  background: var(--color-panel-3);
  z-index: 1;
}

.keys-table th {
  padding: 14px 16px;
  text-align: center;
  font-family: var(--font-body);
  font-weight: 500;
  color: var(--color-text-subtle);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--color-page-border-hover);
  white-space: nowrap;
}

.keys-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-page-border-light);
  vertical-align: middle;
  text-align: center;
  font-family: var(--font-body);
}

.keys-table td:last-child {
  border-right: none;
}

.keys-table tbody tr {
  transition: background var(--duration-fast) ease;
}

.keys-table tbody tr:hover {
  background: var(--color-panel-2);
}

.keys-table tbody tr:last-child td {
  border-bottom: none;
}

.td-provider {
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
}

.td-provider span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.td-left {
  text-align: center !important;
}

.td-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
}

.td-code {
  display: inline-block;
  max-width: 100%;
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text);
  background: transparent;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.td-masked {
  color: var(--color-text-subtle);
}

.td-url {
  display: inline-block;
  max-width: 100%;
  color: var(--color-text-subtle);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.status-badge.active {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.latency-badge {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  padding: 2px 8px;
  border-radius: 10px;
  font-family: var(--font-body);
  font-size: 10px;
  background: var(--color-success-bg);
  color: var(--color-success);
}

.latency-badge.ok {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.latency-badge.cooldown {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

/* ============ Column Widths ============ */
.col-provider {
  width: 15%;
}
.col-model {
  width: 14%;
}
.col-key {
  width: 13%;
}
.col-address {
  width: 28%;
}
.col-status {
  width: 7%;
}
.col-latency {
  width: 9%;
}
.col-actions {
  width: 14%;
}

.latency-none {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-muted);
  vertical-align: middle;
}

.td-model-cell {
  min-width: 120px;
}

/* ============ Model Stepper ============ */
.model-stepper {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  gap: 4px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 2px 2px 2px 10px;
}

.stepper-arrows {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.stepper-arrow {
  width: 22px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--color-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
  padding: 0;
}

.stepper-arrow:hover:not(:disabled) {
  background: var(--color-panel-hover);
  color: var(--color-text);
}

.stepper-arrow:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stepper-label {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text);
  min-width: 70px;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.td-actions {
  display: flex;
  gap: 6px;
  justify-content: center;
}

.action-btn {
  font-family: var(--font-body);
  padding: 5px 10px;
  border: 1px solid var(--color-page-border-hover);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--duration-fast) ease;
  background: transparent;
  color: var(--color-text-subtle);
  white-space: nowrap;
  flex-shrink: 0;
}

.action-btn:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.action-btn.activate {
  color: var(--color-success);
  border-color: var(--color-accent-border);
}

.action-btn.activate:hover {
  background: var(--color-success-bg);
  border-color: var(--color-success);
}

.action-btn.deactivate {
  color: var(--color-warning);
  border-color: var(--color-warning-bg);
}

.action-btn.deactivate:hover {
  background: var(--color-warning-bg);
  border-color: var(--color-warning);
}

.action-btn.test {
  color: var(--color-accent);
  border-color: var(--color-accent-border);
  white-space: nowrap;
}

.action-btn.test:hover:not(:disabled) {
  background: var(--color-accent-bg);
  border-color: var(--color-accent);
}

.action-btn.test.testing {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.delete {
  color: var(--color-danger);
  border-color: var(--color-danger-bg);
}

.action-btn.delete:hover {
  background: var(--color-danger-bg);
  border-color: var(--color-danger);
}

.action-btn.add-model {
  color: var(--color-accent);
  border-color: var(--color-accent-border);
  font-size: 11px;
  padding: 5px 8px;
}

.action-btn.add-model:hover {
  background: var(--color-accent-bg);
  border-color: var(--color-accent);
}

.empty-table {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px;
  font-family: var(--font-body);
  color: var(--color-text-subtle);
  font-size: 13px;
}

.empty-hint {
  font-family: var(--font-body);
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

/* ==================== Loading & Error ==================== */
.loading-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-overlay);
  z-index: 100;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--color-accent-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  background: var(--color-danger-bg);
  border: 1px solid var(--color-danger-bg);
  border-radius: 8px;
  color: var(--color-danger);
  font-size: 13px;
  z-index: 200;
}

.error-toast button {
  padding: 6px 12px;
  background: var(--color-danger);
  border: none;
  border-radius: 4px;
  color: var(--color-btn-primary-text);
  font-size: 12px;
  cursor: pointer;
}
</style>
