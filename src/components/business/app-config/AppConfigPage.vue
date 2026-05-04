<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { appConfigApi } from '@/api/app-config'
import type { AppConfig, ConfigCategory } from '@/features/app-config'
import { CATEGORY_LABELS, CONFIG_CATEGORIES } from '@/features/app-config'
import ConfigList from './ConfigList.vue'
import ConfigEditModal from './ConfigEditModal.vue'

const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

const configs = ref<AppConfig[]>([])
const loading = ref(false)
const error = ref('')
const selectedCategory = ref<string>('all')
const editingConfig = ref<AppConfig | null>(null)
const showEditModal = ref(false)
const saving = ref(false)

const categories = computed(() => {
  const cats = ['all', ...Object.values(CONFIG_CATEGORIES)]
  return cats
})

const filteredConfigs = computed(() => {
  if (selectedCategory.value === 'all') {
    return configs.value
  }
  return configs.value.filter(c => c.category === selectedCategory.value)
})

const configsByCategory = computed(() => {
  const grouped: Record<string, AppConfig[]> = {}
  for (const config of configs.value) {
    if (!grouped[config.category]) {
      grouped[config.category] = []
    }
    grouped[config.category].push(config)
  }
  return grouped
})

async function loadConfigs() {
  loading.value = true
  error.value = ''
  try {
    const result = await appConfigApi.list()
    configs.value = result.configs || []
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载配置失败'
  } finally {
    loading.value = false
  }
}

function handleEdit(config: AppConfig) {
  editingConfig.value = config
  showEditModal.value = true
}

function handleCreate() {
  editingConfig.value = null
  showEditModal.value = true
}

async function handleSave(data: { value: string; description?: string }) {
  saving.value = true
  try {
    if (editingConfig.value) {
      await appConfigApi.update(editingConfig.value.id, {
        value: data.value,
        description: data.description
      })
    }
    showEditModal.value = false
    await loadConfigs()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function handleDelete(id: string) {
  if (!confirm('确定要删除此配置吗？')) return

  try {
    await appConfigApi.delete(id)
    await loadConfigs()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
  }
}

async function handleClearCache() {
  try {
    await appConfigApi.clearCache()
    alert('缓存已清除')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '清除缓存失败'
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white border-b px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-gray-900">应用配置</h1>
          <p class="text-sm text-gray-500 mt-1">管理 SQLDev 应用的运行时配置</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            v-if="isAdmin"
            class="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            @click="handleClearCache"
          >
            清除缓存
          </button>
          <button
            v-if="isAdmin"
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            @click="handleCreate"
          >
            新增配置
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="p-6">
      <!-- Category Tabs -->
      <div class="flex gap-2 mb-6 flex-wrap">
        <button
          v-for="cat in categories"
          :key="cat"
          :class="[
            'px-4 py-2 text-sm rounded-lg transition-colors',
            selectedCategory === cat
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border'
          ]"
          @click="selectedCategory = cat"
        >
          {{ cat === 'all' ? '全部' : (CATEGORY_LABELS[cat] || cat) }}
        </button>
      </div>

      <!-- Error -->
      <div v-if="error" class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {{ error }}
        <button class="ml-4 underline" @click="error = ''">关闭</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
        <p class="mt-2 text-gray-600">加载中...</p>
      </div>

      <!-- Config List by Category -->
      <div v-else-if="selectedCategory === 'all'" class="space-y-6">
        <div v-for="(catConfigs, category) in configsByCategory" :key="category">
          <h2 class="text-lg font-medium text-gray-900 mb-3">
            {{ CATEGORY_LABELS[category as string] || category }}
            <span class="text-gray-400 text-sm font-normal">({{ catConfigs.length }})</span>
          </h2>
          <ConfigList
            :configs="catConfigs"
            :is-admin="isAdmin"
            @edit="handleEdit"
            @delete="handleDelete"
          />
        </div>
      </div>

      <!-- Config List Single Category -->
      <ConfigList
        v-else
        :configs="filteredConfigs"
        :is-admin="isAdmin"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Empty -->
      <div v-if="!loading && configs.length === 0" class="text-center py-12 text-gray-500">
        <p class="text-lg">暂无配置</p>
        <p class="text-sm mt-1">点击"新增配置"添加第一个配置项</p>
      </div>
    </div>

    <!-- Edit Modal -->
    <ConfigEditModal
      v-if="showEditModal"
      :config="editingConfig"
      :saving="saving"
      @save="handleSave"
      @close="showEditModal = false"
    />
  </div>
</template>
