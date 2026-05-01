<!-- [2026-04-30] 新增：AI 配置主页面，组合子组件 -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/stores/ai'
import { useAuthStore } from '@/stores/auth'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import ProviderListPanel from './ProviderListPanel.vue'
import ConfigTable from './ConfigTable.vue'
import ConfigEditModal from './ConfigEditModal.vue'

// --- Stores ---
const aiStore = useAiStore()
const authStore = useAuthStore()

const { providers, configs, loading, error } = storeToRefs(aiStore)

// [2026-04-30] derive isAdmin — 通过 raw_app_meta_data.is_admin 判断
const isAdmin = computed(() => {
  const meta = authStore.user?.app_metadata as Record<string, unknown> | undefined
  return meta?.is_admin === true
})

// --- Modal state ---
const showEditModal = ref(false)
const editingConfig = ref<AiProviderConfig | null>(null)
const selectedProvider = ref<AiProviderDef | null>(null)

// --- Lifecycle ---
onMounted(async () => {
  await aiStore.init(isAdmin.value)
})

// --- Handlers ---
function handleConfigure(provider: AiProviderDef): void {
  selectedProvider.value = provider
  editingConfig.value = null
  showEditModal.value = true
}

function handleEditConfig(config: AiProviderConfig): void {
  editingConfig.value = config
  selectedProvider.value = null
  showEditModal.value = true
}

function handleCreateConfig(): void {
  editingConfig.value = null
  selectedProvider.value = null
  showEditModal.value = true
}

async function handleActivate(config: AiProviderConfig): Promise<void> {
  await aiStore.activateConfig(config.id)
}

async function handleRemove(config: AiProviderConfig): Promise<void> {
  if (!confirm('确定删除此配置？')) return
  await aiStore.removeConfig(config.id)
}

async function handleSaved(): Promise<void> {
  await aiStore.loadConfigs()
}

function handleCloseModal(): void {
  showEditModal.value = false
  editingConfig.value = null
  selectedProvider.value = null
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6">
    <div class="max-w-[960px] mx-auto">
      <!-- Title bar -->
      <div class="flex items-center gap-3 mb-1">
        <h1 class="text-xl font-semibold">AI 助手配置</h1>
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium text-warning border border-border bg-panel2"
        >
          管理员维护
        </span>
        <span
          class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-medium text-brand-500 border border-border bg-panel2"
        >
          普通用户只读
        </span>
      </div>
      <p class="text-[13px] text-subtle mb-5">
        供应商列表和全局 AI 配置存储在远端数据库；管理员可维护，普通用户仅查看脱敏状态
      </p>

      <!-- Loading -->
      <div v-if="loading" class="py-20 text-center text-subtle">加载中...</div>

      <!-- Error -->
      <div v-else-if="error" class="py-12 text-center">
        <p class="text-danger text-sm mb-2">{{ error }}</p>
        <button class="btn-secondary px-3 py-1.5 text-[13px]" @click="aiStore.init(isAdmin)">
          重试
        </button>
      </div>

      <!-- Content -->
      <template v-else>
        <ProviderListPanel
          :providers="providers"
          :is-admin="isAdmin"
          @configure="handleConfigure"
        />

        <ConfigTable
          :configs="configs"
          :is-admin="isAdmin"
          @edit="handleEditConfig"
          @activate="handleActivate"
          @remove="handleRemove"
          @create="handleCreateConfig"
        />

        <!-- Bottom hint -->
        <p class="text-[12px] text-subtle mt-4 text-center">
          此页面登录用户可见，普通用户只读 &middot; 供应商和全局配置由管理员维护 &middot; 全站最多
          20 个配置
        </p>
      </template>

      <!-- Modal -->
      <ConfigEditModal
        :open="showEditModal"
        :config="editingConfig"
        :providers="providers"
        @close="handleCloseModal"
        @saved="handleSaved"
      />
    </div>
  </div>
</template>
