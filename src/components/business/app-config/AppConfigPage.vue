<!-- [2026-05-04] 更新：应用配置页面，匹配设计预览 -->
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

function getCategoryCount(cat: string): number {
  if (cat === 'all') return configs.value.length
  return configs.value.filter(c => c.category === cat).length
}

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
  <div class="appconfig-page">
    <!-- Page Header -->
    <header class="page-header">
      <div class="page-header-left">
        <h1 class="page-title">应用配置</h1>
        <p class="page-subtitle">系统参数设置</p>
      </div>
      <div class="page-header-right">
        <button v-if="isAdmin" class="btn" @click="handleClearCache">清除缓存</button>
        <button v-if="isAdmin" class="btn primary" @click="handleCreate">
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
            <path d="M7 2v10M2 7h10"/>
          </svg>
          新增配置
        </button>
      </div>
    </header>

    <!-- Category Tabs -->
    <div class="tabs">
      <button
        v-for="cat in categories"
        :key="cat"
        class="tab"
        :class="{ active: selectedCategory === cat }"
        @click="selectedCategory = cat"
      >
        {{ cat === 'all' ? '全部' : (CATEGORY_LABELS[cat] || cat) }}
        <span class="tab-count">{{ getCategoryCount(cat) }}</span>
      </button>
    </div>

    <!-- Content -->
    <div class="page-content">
      <!-- Error -->
      <div v-if="error" class="error-banner">
        <span>{{ error }}</span>
        <button class="error-close" @click="error = ''">关闭</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="loading-spinner"></div>
        <span>加载中...</span>
      </div>

      <!-- Config List by Category -->
      <template v-else-if="selectedCategory === 'all'">
        <div v-for="(catConfigs, category) in configsByCategory" :key="category" class="config-section">
          <h2 class="section-title">{{ CATEGORY_LABELS[category as string] || category }}</h2>
          <ConfigList
            :configs="catConfigs"
            :is-admin="isAdmin"
            @edit="handleEdit"
            @delete="handleDelete"
          />
        </div>
      </template>

      <!-- Config List Single Category -->
      <ConfigList
        v-else
        :configs="filteredConfigs"
        :is-admin="isAdmin"
        @edit="handleEdit"
        @delete="handleDelete"
      />

      <!-- Empty -->
      <div v-if="!loading && configs.length === 0" class="empty-state">
        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9"/>
          <path d="M12 8v4M12 16h.01"/>
        </svg>
        <p class="empty-title">暂无配置</p>
        <p class="empty-desc">点击"新增配置"添加第一个配置项</p>
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

<style scoped>
.appconfig-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.page-header-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  margin: 0;
}

.page-subtitle {
  font-size: 12px;
  color: var(--color-brand-500);
  margin: 0;
}

.page-header-right {
  display: flex;
  gap: 8px;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 12px 20px;
  background: var(--color-panel);
  border-bottom: 1px solid var(--color-border);
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.tab.active {
  background: var(--color-brand-50);
  border: 1px solid var(--color-brand-500);
  color: var(--color-brand-500);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.tab.active .tab-count {
  background: var(--color-brand-500);
  color: white;
}

.page-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
  max-width: 980px;
  margin: 0 auto;
}

.error-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(214, 69, 69, 0.1);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-control);
  margin-bottom: 16px;
  color: var(--color-danger);
  font-size: 13px;
}

.error-close {
  background: none;
  border: none;
  color: var(--color-danger);
  text-decoration: underline;
  cursor: pointer;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-subtle);
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-brand-500);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.config-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--color-text-subtle);
}

.empty-state svg {
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin: 0 0 4px;
}

.empty-desc {
  font-size: 12px;
  margin: 0;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.btn:hover {
  background: var(--color-panel-2);
}

.btn.primary {
  border: none;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  color: white;
  box-shadow: 0 4px 16px rgba(37, 99, 235, 0.2);
}

.btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 24px rgba(37, 99, 235, 0.3);
}
</style>
