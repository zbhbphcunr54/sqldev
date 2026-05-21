<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/stores/ai'
import { useAuthStore } from '@/stores/auth'
import { getProviderColor, getProviderInitials } from '@/features/ai/provider-constants'
import type { AiProviderConfig, AiProviderDef } from '@/features/ai'
import { aiConfigApi } from '@/api/ai-config'
import { ApiError } from '@/api/http'
import { useConfirm } from '@/composables/useConfirm'
import ProviderConfigModal from './ProviderConfigModal.vue'
import AddKeyModal from './AddKeyModal.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import { getJson, setJson } from '@/utils/storage'

const { confirm } = useConfirm()

const aiStore = useAiStore()
const authStore = useAuthStore()

const { providers, configs, loading, error, activeScope, hasGlobalActive } = storeToRefs(aiStore)
const { isAdmin, user } = storeToRefs(authStore)

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '发生未知错误，请稍后重试。'
}

const pageScope = computed<'global' | 'personal'>(() => (isAdmin.value ? 'global' : 'personal'))
const canManageProviders = computed(() => isAdmin.value)
const scopeTitle = computed(() => (pageScope.value === 'global' ? '全局 AI Key' : '我的 AI Key'))

const showProviderModal = ref(false)
const editingProvider = ref<AiProviderDef | null>(null)
const showAddKeyModal = ref(false)
const addKeyPrefill = ref<{ providerId?: string; apiKeyMasked?: string }>({})

const isDragging = ref(false)
const draggedProvider = ref<AiProviderDef | null>(null)
const draggedIndex = ref(-1)
const dropIndex = ref(-1)
const dragPosition = ref({ x: 0, y: 0 })
const gridRef = ref<HTMLElement | null>(null)

const hoveredProvider = ref<AiProviderDef | null>(null)
const tooltipPosition = ref({ x: 0, y: 0 })
const showTooltip = ref(false)

const testingIds = ref<Set<string>>(new Set())
const testResults = ref<Map<string, { ok: boolean; elapsed_ms: number; error?: string }>>(new Map())
const cooldownEndTimes = ref<Map<string, number>>(new Map())
const cooldownRemaining = ref<Map<string, number>>(new Map())

let longPressTimer: ReturnType<typeof setTimeout> | null = null
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const LONG_PRESS_DELAY = 150
const DRAG_THRESHOLD = 5
const TOOLTIP_WIDTH = 300
const TOOLTIP_OFFSET = 12

const providerConfigsMap = computed(() => {
  const map = new Map<string, AiProviderConfig[]>()
  configs.value.forEach((config) => {
    const list = map.get(config.provider_id) ?? []
    list.push(config)
    map.set(config.provider_id, list)
  })
  return map
})

const totalModelCount = computed(() => configs.value.length)
const configuredProviderCount = computed(() => providerConfigsMap.value.size)

const keySectionDesc = computed(() => {
  if (pageScope.value === 'global') {
    return `当前管理 ${totalModelCount.value} 个模型，覆盖 ${configuredProviderCount.value} 个供应商。`
  }
  if (configs.value.some((config) => config.is_active)) {
    return `当前账号已启用个人 Key，页面内 AI 调用会优先使用你的配置。`
  }
  if (hasGlobalActive.value) {
    return '当前账号未启用个人 Key，页面内 AI 调用会回退使用管理员配置。'
  }
  return '当前账号还没有可用 Key，配置后即可在页面内直接使用。'
})

interface GroupedConfig {
  providerId: string
  providerSlug: string
  apiKeyMasked: string
  baseUrl: string
  configs: AiProviderConfig[]
}

const groupedConfigs = computed<GroupedConfig[]>(() => {
  const map = new Map<string, GroupedConfig>()

  for (const config of configs.value) {
    const provider = getProviderById(config.provider_id)
    const key = `${config.provider_id}::${config.api_key_masked}`
    if (!map.has(key)) {
      map.set(key, {
        providerId: config.provider_id,
        providerSlug: provider?.slug ?? '',
        apiKeyMasked: config.api_key_masked,
        baseUrl: config.base_url,
        configs: []
      })
    }
    map.get(key)?.configs.push(config)
  }

  return Array.from(map.values())
})

const selectedStorageKey = computed(() => {
  const userId = user.value?.id ?? 'anonymous'
  return `sqldev:ai:selected-models:${userId}:${activeScope.value}`
})

const selectedConfigId = ref<Record<string, string>>({})

function readSelectedFromStorage(): Record<string, string> {
  return getJson<Record<string, string>>(selectedStorageKey.value, {})
}

function writeSelectedToStorage(map: Record<string, string>): void {
  setJson(selectedStorageKey.value, map)
}

function groupKey(group: GroupedConfig): string {
  return `${activeScope.value}::${group.providerId}::${group.apiKeyMasked}`
}

function getSelectedConfig(group: GroupedConfig): AiProviderConfig | undefined {
  const id = selectedConfigId.value[groupKey(group)]
  return group.configs.find((config) => config.id === id) ?? group.configs[0]
}

function ensureSelectedConfig(group: GroupedConfig): void {
  const key = groupKey(group)
  const current = selectedConfigId.value[key]
  if (current && group.configs.some((config) => config.id === current)) return

  const active = group.configs.find((config) => config.is_active)
  selectedConfigId.value[key] = active?.id ?? group.configs[group.configs.length - 1]?.id ?? ''
}

const tableRows = computed(() =>
  groupedConfigs.value
    .map((group) => {
      const selected = getSelectedConfig(group)
      return selected ? { group, selected } : null
    })
    .filter((row): row is { group: GroupedConfig; selected: AiProviderConfig } => !!row)
)

watch(
  groupedConfigs,
  (groups) => {
    groups.forEach((group) => ensureSelectedConfig(group))
    writeSelectedToStorage(selectedConfigId.value)
  },
  { deep: true, immediate: true }
)

watch(
  () => pageScope.value,
  () => {
    void loadConfigs()
  }
)

function getProviderById(id: string): AiProviderDef | undefined {
  return providers.value.find((provider) => provider.id === id)
}

function isProviderConfigured(providerId: string): boolean {
  return (providerConfigsMap.value.get(providerId)?.length ?? 0) > 0
}

function getCardBgStart(): string {
  return 'var(--color-accent-bg)'
}

function getCardBgEnd(): string {
  return 'var(--color-panel-3)'
}

function getCardBorderColor(provider: AiProviderDef): string {
  return getProviderColor(provider.slug)
}

function getRegionLabel(provider: AiProviderDef): { label: string; isDomestic: boolean } {
  const isDomestic = provider.region === 'cn'
  return { label: isDomestic ? '国内' : '海外', isDomestic }
}

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
  api_key_masked?: string
  reuse_config_id?: string
}): Promise<void> {
  closeAddKeyModal()
  await aiStore.addConfig(payload)
}

function openAddProvider(): void {
  if (!canManageProviders.value) return
  editingProvider.value = null
  showProviderModal.value = true
}

function openEditProvider(provider: AiProviderDef): void {
  if (!canManageProviders.value) return
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
      const index = providers.value.findIndex((item) => item.id === updated.id)
      if (index !== -1) {
        providers.value[index] = { ...providers.value[index], ...updated }
      }
      await aiStore.loadConfigs()
    } else {
      const created = await aiConfigApi.createProvider({
        label: payload.data.label,
        slug: payload.data.slug ?? '',
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
  } catch (err: unknown) {
    error.value = getErrorMessage(err)
  }
}

async function handleDeleteModel(config: AiProviderConfig): Promise<void> {
  const providerLabel = getProviderById(config.provider_id)?.label ?? config.provider_id
  const ok = await confirm(`确定删除「${providerLabel}」下的模型 ${config.model} 吗？`, {
    title: '删除模型',
    confirmText: '删除',
    confirmClass: 'danger'
  })
  if (!ok) return

  await aiStore.removeConfig(config.id)
  delete selectedConfigId.value[`${activeScope.value}::${config.provider_id}::${config.api_key_masked}`]
  writeSelectedToStorage(selectedConfigId.value)
}

async function handleToggleActive(config: AiProviderConfig): Promise<void> {
  try {
    if (config.is_active) {
      await aiStore.deactivateConfig(config.id)
    } else {
      await aiStore.activateConfig(config.id)
    }
  } catch (err) {
    console.error('[AiConfig] Toggle active failed:', err)
  }
}

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
          .filter((config) => config.provider_id === providerId)
          .forEach((config) => cooldownRemaining.value.set(config.id, remaining))
      } else {
        cooldownEndTimes.value.delete(providerId)
        configs.value
          .filter((config) => config.provider_id === providerId)
          .forEach((config) => {
            cooldownRemaining.value.delete(config.id)
            const result = testResults.value.get(config.id)
            if (result && !result.ok && result.error?.includes('请等待')) {
              testResults.value.delete(config.id)
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
    .filter((config) => config.provider_id === providerId)
    .forEach((config) => cooldownRemaining.value.set(config.id, seconds))
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '测试失败'
    testResults.value.set(config.id, {
      ok: false,
      elapsed_ms: 0,
      error: message
    })
    if (err instanceof ApiError && typeof err.data?.cooldown_remaining === 'number') {
      setProviderCooldown(config.provider_id, err.data.cooldown_remaining)
    }
  } finally {
    testingIds.value.delete(config.id)
  }
}

function getTestResult(configId: string): { ok: boolean; elapsed_ms: number; error?: string } | null {
  return testResults.value.get(configId) ?? null
}

function isTesting(configId: string): boolean {
  return testingIds.value.has(configId) || isInCooldown(configId)
}

function getLatencyText(config: AiProviderConfig): string {
  const result = getTestResult(config.id)
  if (result?.ok) return `${result.elapsed_ms} ms`
  if (result && !result.ok && result.error) return result.error
  if (config.last_test_ok && typeof config.last_test_ms === 'number') return `${config.last_test_ms} ms`
  if (config.last_test_ok === false) return '失败'
  return '-'
}

function getLatencyClass(config: AiProviderConfig): string {
  const result = getTestResult(config.id)
  if (isInCooldown(config.id)) return 'cooldown'
  if (result?.ok || config.last_test_ok) return 'ok'
  if (result && !result.ok) return 'fail'
  return 'empty'
}

async function handleDeleteProvider(provider: AiProviderDef): Promise<void> {
  if (!canManageProviders.value) return

  const configCount = providerConfigsMap.value.get(provider.id)?.length ?? 0
  const message =
    configCount > 0
      ? `确定删除「${provider.label}」供应商吗？\n\n这会同时删除该供应商下的 ${configCount} 条 Key 配置。`
      : `确定删除「${provider.label}」供应商吗？`

  const ok = await confirm(message, {
    title: '删除供应商',
    confirmText: '删除',
    confirmClass: 'danger'
  })
  if (!ok) return

  try {
    await aiConfigApi.deleteProvider(provider.id)
    providers.value = providers.value.filter((item) => item.id !== provider.id)
    await aiStore.loadConfigs()
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '删除失败'
    await confirm(message, {
      title: '操作失败',
      confirmText: '我知道了'
    })
  }
}

function cycleModel(group: GroupedConfig, direction: 1 | -1): void {
  const list = group.configs
  if (list.length <= 1) return

  const current = getSelectedConfig(group)
  const currentIndex = current ? list.findIndex((config) => config.id === current.id) : 0
  const nextIndex = (currentIndex + direction + list.length) % list.length
  selectedConfigId.value[groupKey(group)] = list[nextIndex].id
  writeSelectedToStorage(selectedConfigId.value)
}

function isDraggingCard(provider: AiProviderDef): boolean {
  return isDragging.value && draggedProvider.value?.id === provider.id
}

function isDropTargetCard(index: number): boolean {
  return isDragging.value && dropIndex.value === index && index !== draggedIndex.value
}

function onCardClick(_event: MouseEvent, provider: AiProviderDef): void {
  if (isDragging.value || !canManageProviders.value) return
  openEditProvider(provider)
}

function onCardMouseDown(e: MouseEvent, provider: AiProviderDef): void {
  if (!canManageProviders.value) return
  if ((e.target as HTMLElement).closest('button')) return

  const index = providers.value.findIndex((item) => item.id === provider.id)
  if (index === -1) return

  const startX = e.clientX
  const startY = e.clientY
  let moved = false

  longPressTimer = setTimeout(() => {
    if (!moved) startDrag(provider, index, e.clientX, e.clientY)
  }, LONG_PRESS_DELAY)

  const handleMove = (moveEvent: MouseEvent) => {
    const deltaX = Math.abs(moveEvent.clientX - startX)
    const deltaY = Math.abs(moveEvent.clientY - startY)
    if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
      moved = true
      if (longPressTimer) {
        clearTimeout(longPressTimer)
        longPressTimer = null
      }
      startDrag(provider, index, moveEvent.clientX, moveEvent.clientY)
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

function startDrag(provider: AiProviderDef, index: number, clientX: number, clientY: number): void {
  if (!canManageProviders.value) return
  draggedProvider.value = provider
  draggedIndex.value = index
  isDragging.value = true
  dragPosition.value = { x: clientX - 100, y: clientY - 20 }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging.value) return
  dragPosition.value = { x: e.clientX - 100, y: e.clientY - 20 }

  const cards = gridRef.value?.querySelectorAll('.provider-card') ?? []
  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect()
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom &&
      index !== draggedIndex.value
    ) {
      dropIndex.value = index
    }
  })
}

async function onMouseUp(): Promise<void> {
  let orderChanged = false

  if (
    canManageProviders.value &&
    dropIndex.value !== -1 &&
    draggedIndex.value !== -1 &&
    dropIndex.value !== draggedIndex.value
  ) {
    const nextProviders = [...providers.value]
    const [moved] = nextProviders.splice(draggedIndex.value, 1)
    const targetIndex =
      dropIndex.value > draggedIndex.value ? dropIndex.value - 1 : dropIndex.value
    nextProviders.splice(targetIndex, 0, moved)
    providers.value = nextProviders
    orderChanged = true
  }

  if (orderChanged) {
    aiStore.persistToCache()
    const orders = providers.value.map((item, index) => ({
      provider_id: item.id,
      sort_order: index
    }))
    aiConfigApi.reorderProviders(orders).catch(async (err: unknown) => {
      const message = err instanceof Error ? err.message : '保存排序失败，请刷新后重试。'
      await confirm(`供应商排序保存失败：${message}`, {
        title: '保存失败',
        confirmText: '我知道了'
      })
    })
  }

  isDragging.value = false
  draggedProvider.value = null
  draggedIndex.value = -1
  dropIndex.value = -1
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}

function updateTooltipPosition(e: MouseEvent): void {
  let x = e.clientX + TOOLTIP_OFFSET
  let y = e.clientY + TOOLTIP_OFFSET

  if (x + TOOLTIP_WIDTH > window.innerWidth - 20) {
    x = e.clientX - TOOLTIP_WIDTH - TOOLTIP_OFFSET
  }
  if (y + 220 > window.innerHeight - 20) {
    y = window.innerHeight - 240
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

async function loadConfigs(): Promise<void> {
  aiStore.setScope(pageScope.value)
  selectedConfigId.value = readSelectedFromStorage()
  testResults.value.clear()
  cooldownEndTimes.value.clear()
  cooldownRemaining.value.clear()
  await aiStore.init(true)
}

onMounted(() => {
  selectedConfigId.value = readSelectedFromStorage()
  void loadConfigs().catch((err) => {
    error.value = getErrorMessage(err)
  })
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
  if (longPressTimer) clearTimeout(longPressTimer)
  if (cooldownTimer) clearInterval(cooldownTimer)
})
</script>

<template>
  <div class="ai-config-page">
    <section class="providers-section">
      <div class="section-header">
        <div class="header-left">
          <h2 class="section-title">AI 供应商</h2>
          <p class="section-desc">
            {{ canManageProviders ? '管理支持的 AI 服务商及可用模型。' : '查看当前可用的 AI 服务商。' }}
          </p>
        </div>
        <button v-if="canManageProviders" class="btn-add" @click="openAddProvider">
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
        <template v-if="providers.length > 0">
          <div
            v-for="(provider, index) in providers"
            :key="provider.id"
            class="provider-card"
            :class="{
              'is-dragging': isDraggingCard(provider),
              'is-drop-target': isDropTargetCard(index)
            }"
            :style="{
              '--card-color': getCardBorderColor(provider),
              '--card-bg-start': getCardBgStart(),
              '--card-bg-end': getCardBgEnd()
            }"
            @mousedown="onCardMouseDown($event, provider)"
            @mousemove="onCardHover($event, provider)"
            @mouseleave="onCardLeave"
            @click="onCardClick($event, provider)"
          >
            <button
              v-if="canManageProviders"
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
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>

            <div class="card-content">
              <div class="card-header">
                <div class="provider-icon" :style="{ background: getCardBorderColor(provider) }">
                  {{ getProviderInitials(provider.slug, provider.label) }}
                </div>
                <div class="provider-info">
                  <div class="provider-name-row">
                    <span class="provider-name">{{ provider.label }}</span>
                    <span
                      class="status-dot"
                      :class="{ configured: isProviderConfigured(provider.id) }"
                    />
                  </div>
                  <span class="provider-meta">
                    {{ provider.models.length }} 个模型
                    <span class="provider-separator">·</span>
                    {{ getRegionLabel(provider).label }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <div v-else class="empty-providers">
          <p>{{ canManageProviders ? '还没有供应商，先新增一个吧。' : '当前没有可显示的供应商。' }}</p>
        </div>
      </div>
    </section>

    <section class="keys-section">
      <div class="section-header keys-header">
        <div class="header-left">
          <h2 class="section-title">{{ scopeTitle }}</h2>
          <p class="section-desc">{{ keySectionDesc }}</p>
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

      <div class="keys-table-wrapper">
        <table v-if="tableRows.length > 0" class="keys-table">
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
              <th class="col-provider">供应商</th>
              <th class="col-model">模型</th>
              <th class="col-key">Key</th>
              <th class="col-address">Base URL</th>
              <th class="col-status">状态</th>
              <th class="col-latency">测试结果</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in tableRows" :key="`${row.group.providerId}-${row.group.apiKeyMasked}`">
              <td class="td-left">
                <div class="td-provider">
                  <div
                    class="td-icon"
                    :style="{ background: getProviderColor(row.group.providerSlug) }"
                  >
                    {{
                      getProviderInitials(
                        row.group.providerSlug,
                        getProviderById(row.group.providerId)?.label ?? row.group.providerId
                      )
                    }}
                  </div>
                  <span>{{ getProviderById(row.group.providerId)?.label ?? row.group.providerId }}</span>
                </div>
              </td>

              <td class="td-model-cell">
                <div class="model-stepper">
                  <span class="stepper-label">{{ row.selected.model }}</span>
                  <div v-if="row.group.configs.length > 1" class="stepper-arrows">
                    <button class="stepper-arrow" @click="cycleModel(row.group, -1)">
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
                    <button class="stepper-arrow" @click="cycleModel(row.group, 1)">
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

              <td>
                <span class="td-code td-masked">{{ row.group.apiKeyMasked }}</span>
              </td>

              <td>
                <span class="td-url">{{ row.selected.base_url || row.group.baseUrl }}</span>
              </td>

              <td>
                <span class="status-badge" :class="{ active: row.selected.is_active }">
                  <span class="badge-dot" />
                  {{ row.selected.is_active ? '已启用' : '未启用' }}
                </span>
              </td>

              <td>
                <span class="latency-badge" :class="getLatencyClass(row.selected)">
                  <template v-if="isInCooldown(row.selected.id)">
                    冷却 {{ getCooldownRemaining(row.selected.id) }}s
                  </template>
                  <template v-else>
                    {{ getLatencyText(row.selected) }}
                  </template>
                </span>
              </td>

              <td>
                <div class="td-actions">
                  <button
                    class="action-btn"
                    :class="row.selected.is_active ? 'deactivate' : 'activate'"
                    @click="handleToggleActive(row.selected)"
                  >
                    {{ row.selected.is_active ? '停用' : '启用' }}
                  </button>
                  <button
                    class="action-btn test"
                    :class="{ testing: isTesting(row.selected.id) }"
                    :disabled="isTesting(row.selected.id)"
                    @click="handleTest(row.selected)"
                  >
                    <template v-if="isInCooldown(row.selected.id)">冷却中</template>
                    <template v-else-if="isTesting(row.selected.id)">测试中...</template>
                    <template v-else>测试</template>
                  </button>
                  <button class="action-btn delete" @click="handleDeleteModel(row.selected)">
                    删除
                  </button>
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

        <div v-else-if="!loading" class="empty-table">
          <p>暂无 Key 配置</p>
          <p class="empty-hint">
            {{ pageScope === 'global' ? '点击右上角新增全局 Key。' : '点击右上角新增你自己的 Key。' }}
          </p>
        </div>
      </div>
    </section>

    <div
      v-if="showTooltip && hoveredProvider"
      class="provider-tooltip"
      :style="{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }"
      @mousemove="onTooltipMouseMove"
    >
      <div class="tooltip-header">
        <div class="tooltip-icon" :style="{ background: getProviderColor(hoveredProvider.slug) }">
          {{ getProviderInitials(hoveredProvider.slug, hoveredProvider.label) }}
        </div>
        <div class="tooltip-title">
          <div class="tooltip-name">{{ hoveredProvider.label }}</div>
          <div
            class="tooltip-region"
            :class="{ domestic: getRegionLabel(hoveredProvider).isDomestic }"
          >
            {{ getRegionLabel(hoveredProvider).label }}
          </div>
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

      <div class="tooltip-models">
        <div class="models-title">可用模型</div>
        <div class="models-list">
          <span v-for="model in hoveredProvider.models.slice(0, 6)" :key="model" class="model-tag">
            {{ model }}
          </span>
          <span v-if="hoveredProvider.models.length > 6" class="model-more">
            +{{ hoveredProvider.models.length - 6 }}
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="isDragging && draggedProvider"
      class="drag-clone"
      :style="{
        left: `${dragPosition.x}px`,
        top: `${dragPosition.y}px`,
        '--card-color': getCardBorderColor(draggedProvider),
        '--card-bg-start': getCardBgStart(),
        '--card-bg-end': getCardBgEnd()
      }"
    >
      <div class="card-header">
        <div class="provider-icon" :style="{ background: getCardBorderColor(draggedProvider) }">
          {{ getProviderInitials(draggedProvider.slug, draggedProvider.label) }}
        </div>
        <div class="provider-info">
          <span class="provider-name">{{ draggedProvider.label }}</span>
          <span class="provider-meta">{{ draggedProvider.models.length }} 个模型</span>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner" />
    </div>

    <div v-if="error" class="error-toast">
      <span>{{ error }}</span>
      <button @click="loadConfigs">重试</button>
    </div>

    <ProviderConfigModal
      :open="showProviderModal"
      :provider="editingProvider"
      :providers="providers"
      @close="closeProviderModal"
      @save="handleProviderSave"
    />

    <AddKeyModal
      :open="showAddKeyModal"
      :providers="providers"
      :existing-configs="configs"
      :prefill-provider-id="addKeyPrefill.providerId"
      :prefill-api-key-masked="addKeyPrefill.apiKeyMasked"
      @close="closeAddKeyModal"
      @save="handleAddKeySaved"
    />

    <ConfirmDialog />
  </div>
</template>

<style scoped>
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
  padding: 18px 8px 22px;
  overflow: hidden;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 5px;
  padding: 0 48px 0 20px;
  flex-shrink: 0;
}

.keys-header {
  margin-bottom: 10px;
}

.header-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  min-width: 0;
}

.section-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.section-desc {
  font-size: 12px;
  color: var(--color-text-subtle);
  margin: 0;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 13px;
  background: var(--color-accent);
  border: none;
  border-radius: 6px;
  color: var(--color-btn-primary-text);
  font-size: 12px;
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

.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(184px, 1fr));
  gap: 12px;
  padding-top: 7px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.providers-grid::-webkit-scrollbar,
.keys-table-wrapper::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.providers-grid::-webkit-scrollbar-track,
.keys-table-wrapper::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.providers-grid::-webkit-scrollbar-thumb,
.keys-table-wrapper::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.provider-card {
  position: relative;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: 13px;
  padding: 11px 13px;
  cursor: pointer;
  transition: all var(--duration-normal) ease;
  overflow: hidden;
  min-height: 74px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.provider-card:hover {
  transform: translateY(-1px) scale(1.01);
  box-shadow: var(--shadow-md);
  border-color: var(--color-page-border-hover);
}

.provider-card:hover .provider-icon {
  box-shadow: 0 0 18px var(--card-color);
}

.provider-card.is-dragging {
  opacity: 0.3;
  transform: scale(0.95);
}

.provider-card.is-drop-target {
  border-color: var(--color-accent);
  box-shadow:
    0 0 0 2px var(--color-accent),
    0 0 12px var(--color-accent-border);
  transform: scale(1.01);
}

.card-delete-btn {
  position: absolute;
  top: 7px;
  right: 7px;
  width: 24px;
  height: 24px;
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

.card-content {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.provider-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  flex-shrink: 0;
  box-shadow: 0 0 16px var(--card-color);
}

.provider-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.provider-name-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.provider-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}

.status-dot.configured {
  background: var(--color-success);
  box-shadow: 0 0 8px var(--color-success);
}

.provider-meta {
  font-size: 10px;
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.provider-separator {
  margin: 0 4px;
}

.empty-providers {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--color-text-muted);
  font-size: 13px;
}

.keys-table-wrapper {
  overflow: auto;
  max-height: 100%;
  background: var(--color-panel-2);
  border: 1px solid var(--color-page-border-hover);
  border-radius: 9px;
}

.keys-table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
}

.keys-table thead {
  position: sticky;
  top: 0;
  background: var(--color-panel-3);
  z-index: 1;
}

.keys-table th {
  padding: 11px 12px;
  text-align: center;
  font-weight: 500;
  color: var(--color-text-subtle);
  font-size: 11px;
  letter-spacing: 0.2px;
  border-bottom: 1px solid var(--color-page-border-hover);
  white-space: nowrap;
}

.keys-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-page-border-light);
  vertical-align: middle;
  text-align: center;
}

.col-provider {
  width: 14%;
}

.col-model {
  width: 16%;
}

.col-key {
  width: 13%;
}

.col-address {
  width: 25%;
}

.col-status {
  width: 9%;
}

.col-latency {
  width: 10%;
}

.col-actions {
  width: 16%;
}

.td-left {
  text-align: left;
}

.td-provider {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.td-provider span {
  display: inline-block;
  min-width: 0;
  max-width: 100%;
  flex: 1;
  font-size: 12px;
  line-height: 1.35;
}

.td-provider span,
.td-url,
.td-code {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.td-icon {
  width: 24px;
  height: 24px;
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
  font-size: 12px;
  color: var(--color-text);
}

.td-masked {
  color: var(--color-text-subtle);
}

.td-url {
  display: inline-block;
  max-width: 100%;
  color: var(--color-text-subtle);
}

.td-model-cell {
  min-width: 0;
}

.model-stepper {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 3px;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  padding: 2px 2px 2px 7px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.stepper-label {
  flex: 1;
  min-width: 0;
  max-width: none;
  font-size: 12px;
  line-height: 1.35;
  color: var(--color-text);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stepper-arrows {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.stepper-arrow {
  width: 18px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 2px;
  color: var(--color-text-subtle);
  cursor: pointer;
  padding: 0;
}

.stepper-arrow:hover {
  background: var(--color-panel-hover);
  color: var(--color-text);
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 500;
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  justify-content: center;
  max-width: 100%;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.latency-badge.ok {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.latency-badge.cooldown {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.latency-badge.fail {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

.latency-badge.empty {
  background: transparent;
  color: var(--color-text-muted);
}

.td-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

.action-btn {
  min-height: 24px;
  padding: 3px 8px;
  border: 1px solid var(--color-page-border-hover);
  border-radius: 4px;
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
  background: transparent;
  color: var(--color-text-subtle);
  white-space: nowrap;
}

.action-btn:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.action-btn.activate {
  color: var(--color-success);
  border-color: var(--color-accent-border);
}

.action-btn.deactivate {
  color: var(--color-warning);
  border-color: var(--color-warning-bg);
}

.action-btn.test {
  color: var(--color-accent);
  border-color: var(--color-accent-border);
}

.action-btn.test.testing {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-btn.delete {
  color: var(--color-danger);
  border-color: var(--color-danger-bg);
}

.action-btn.add-model {
  color: var(--color-accent);
  border-color: var(--color-accent-border);
  font-size: 12px;
  padding: 3px 8px;
}

.empty-table {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px;
  color: var(--color-text-subtle);
  font-size: 13px;
}

.empty-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-top: 4px;
}

.provider-tooltip {
  position: fixed;
  z-index: 9998;
  min-width: 252px;
  max-width: 308px;
  background: var(--color-panel-3);
  border: 1px solid var(--color-page-border-hover);
  border-radius: 10px;
  padding: 12px;
  box-shadow: var(--shadow-md);
  pointer-events: none;
}

.tooltip-header {
  display: flex;
  align-items: center;
  gap: 9px;
  margin-bottom: 10px;
}

.tooltip-icon {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
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
  font-size: 13px;
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
  font-size: 10px;
  color: var(--color-accent);
  font-weight: 500;
}

.tooltip-region.domestic {
  color: var(--color-warning);
}

.tooltip-stats {
  display: flex;
  gap: 14px;
  padding: 8px 0;
  border-top: 1px solid var(--color-page-border-subtle);
  border-bottom: 1px solid var(--color-page-border-subtle);
  margin-bottom: 8px;
}

.tooltip-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-value {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-size: 10px;
  color: var(--color-text-subtle);
}

.tooltip-models {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.models-title {
  font-size: 9px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.model-tag,
.model-more {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 4px;
}

.model-tag {
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.model-more {
  background: var(--color-accent-bg);
  color: var(--color-accent);
  font-weight: 500;
}

.drag-clone {
  position: fixed;
  width: 192px;
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  border: 1px solid var(--card-color);
  border-radius: 13px;
  padding: 11px 13px;
  overflow: hidden;
  box-shadow: var(--shadow-xl);
  z-index: 9999;
  pointer-events: none;
  transform: rotate(2deg) scale(1.03);
}

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

@media (max-width: 960px) {
  .section-header {
    padding: 0 16px;
  }

  .providers-grid {
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  }

  .keys-table {
    min-width: 1020px;
  }
}

@media (max-width: 640px) {
  .section-header {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-add {
    justify-content: center;
  }
}
</style>
