<!-- [2026-04-30] 新增：AI 供应商列表面板 -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { AiProviderDef, ProviderFilterTab } from '@/features/ai'
import { PROVIDER_FILTER_TABS, REGION_MAP } from '@/features/ai'

// --- Props & Emits ---
const props = defineProps<{
  providers: AiProviderDef[]
  isAdmin: boolean
}>()

const emit = defineEmits<{
  configure: [provider: AiProviderDef]
}>()

// --- Filter state ---
const activeTab = ref<ProviderFilterTab>('全部')

// --- Provider visual maps ---
// [2026-04-30] icon color + initials
const PROVIDER_COLORS: Record<string, string> = {
  deepseek: '#4D6BFE',
  qwen: '#615CED',
  glm: '#386FFF',
  moonshot: '#000',
  siliconflow: '#7C3AED',
  ernie: '#2932E1',
  spark: '#0070FF',
  hunyuan: '#006EFF',
  doubao: '#3370FF',
  minimax: '#6D28D9',
  gemini: '#4285F4',
  groq: '#F55036',
  openai: '#10A37F',
  claude: '#D97706',
  mistral: '#FF7000',
  openrouter: '#6366F1',
  'github-models': '#24292F',
  cloudflare: '#F48120'
}

const PROVIDER_INITIALS: Record<string, string> = {
  deepseek: 'DS',
  qwen: '通',
  glm: '智',
  moonshot: 'K',
  siliconflow: 'SF',
  ernie: '百',
  spark: '讯',
  hunyuan: '混',
  doubao: '豆',
  minimax: 'MM',
  gemini: 'G',
  groq: 'GQ',
  openai: 'AI',
  claude: 'C',
  mistral: 'M',
  openrouter: 'OR',
  'github-models': 'GH',
  cloudflare: 'CF'
}

// --- Computed: filtered providers ---
const filteredProviders = computed(() => {
  if (activeTab.value === '全部') return props.providers
  const regionKey = activeTab.value === '国内' ? 'cn' : 'international'
  return props.providers.filter((p) => p.region === regionKey)
})

// --- Computed: grouped by region ---
interface ProviderGroup {
  region: string
  label: string
  items: AiProviderDef[]
}

const groupedProviders = computed<ProviderGroup[]>(() => {
  const groups: ProviderGroup[] = []
  const cnItems = filteredProviders.value.filter((p) => p.region === 'cn')
  const intlItems = filteredProviders.value.filter((p) => p.region === 'international')

  if (cnItems.length > 0) {
    groups.push({ region: 'cn', label: '国内', items: cnItems })
  }
  if (intlItems.length > 0) {
    groups.push({ region: 'international', label: '国际', items: intlItems })
  }
  return groups
})

// --- Helpers ---
function getColor(slug: string): string {
  return PROVIDER_COLORS[slug] ?? '#9ca3af'
}

function getInitials(slug: string): string {
  return PROVIDER_INITIALS[slug] ?? slug.slice(0, 2).toUpperCase()
}

function getExtraModelCount(provider: AiProviderDef): number {
  return Math.max(0, provider.models.length - 1)
}
</script>

<template>
  <!-- Filter tabs + count -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center gap-1 bg-panel2 rounded-xl p-1">
      <button
        v-for="tab in PROVIDER_FILTER_TABS"
        :key="tab"
        class="px-3 py-1.5 rounded-lg text-[13px] transition"
        :class="
          activeTab === tab
            ? 'font-medium bg-panel text-text shadow-panel'
            : 'text-subtle hover:text-text'
        "
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>
    <span class="text-[12px] text-subtle">共 {{ filteredProviders.length }} 个供应商</span>
  </div>

  <!-- Provider table -->
  <div class="bg-panel rounded-card border border-border shadow-panel">
    <!-- Header -->
    <div
      class="grid items-center px-4 py-3 border-b border-border text-[12px] font-medium text-subtle uppercase tracking-wide"
      style="grid-template-columns: 44px 1fr 64px 1fr 120px 100px"
    >
      <span></span>
      <span>供应商</span>
      <span>区域</span>
      <span>可用模型</span>
      <span>状态</span>
      <span class="text-right">操作</span>
    </div>

    <!-- Groups -->
    <template v-for="group in groupedProviders" :key="group.region">
      <!-- Section header -->
      <div class="px-4 py-2 bg-panel2 border-b border-border">
        <span class="text-[11px] font-semibold text-subtle uppercase tracking-wider">
          {{ group.label }}
        </span>
      </div>

      <!-- Rows -->
      <div
        v-for="provider in group.items"
        :key="provider.id"
        class="grid items-center px-4 py-3 border-b border-border transition"
        :class="provider.is_enabled ? 'hover:bg-panel2' : 'hover:bg-panel2 opacity-60'"
        style="grid-template-columns: 44px 1fr 64px 1fr 120px 100px"
      >
        <!-- Icon -->
        <div
          class="w-9 h-9 rounded-control flex items-center justify-center font-bold text-[13px] text-white shrink-0"
          :style="{ background: getColor(provider.slug) }"
        >
          {{ getInitials(provider.slug) }}
        </div>

        <!-- Name -->
        <span class="font-medium text-[13px]">{{ provider.label }}</span>

        <!-- Region -->
        <span class="text-[12px] text-subtle">{{ REGION_MAP[provider.region] ?? '--' }}</span>

        <!-- Models -->
        <div class="flex items-center gap-1.5">
          <span class="font-mono text-[12px] text-subtle">{{ provider.default_model }}</span>
          <span
            v-if="getExtraModelCount(provider) > 0"
            class="inline-flex items-center px-1.5 py-0 rounded bg-panel2 border border-border text-[10px] text-subtle"
          >
            +{{ getExtraModelCount(provider) }}
          </span>
        </div>

        <!-- Status -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <template v-if="provider.is_enabled">
            <span class="w-2 h-2 rounded-full bg-success"></span>
            <span
              class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium text-success border border-border bg-panel2"
            >
              启用中
            </span>
          </template>
          <template v-else>
            <span class="text-[12px] text-subtle">未配置</span>
          </template>
        </div>

        <!-- Actions -->
        <div class="flex items-center justify-end gap-1">
          <template v-if="isAdmin && provider.is_enabled">
            <button
              class="text-[12px] text-subtle hover:text-danger transition px-1.5 py-0.5 rounded"
            >
              禁用
            </button>
            <span class="text-border">|</span>
          </template>
          <button
            class="text-[12px] text-brand-500 font-medium hover:underline px-1.5 py-0.5 rounded"
            @click="emit('configure', provider)"
          >
            配置
          </button>
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-if="filteredProviders.length === 0" class="px-4 py-8 text-center text-subtle text-sm">
      暂无供应商
    </div>
  </div>
</template>
