<!-- [2026-05-06] AI 助手配置页面 - 工作台内嵌版本 -->
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAiStore } from '@/stores/ai'
import { useAuthStore } from '@/stores/auth'
import type { AiProviderDef, AiProviderConfig } from '@/features/ai'
import ConfigEditModal from './ConfigEditModal.vue'

// --- Stores ---
const aiStore = useAiStore()
const authStore = useAuthStore()

const { providers, configs, loading, error } = storeToRefs(aiStore)

const isAdmin = computed(() => {
  const meta = authStore.user?.app_metadata as Record<string, unknown> | undefined
  return meta?.is_admin === true
})

// --- Filter state ---
const providerFilter = ref<'全部' | '国内' | '国际'>('全部')

// --- Modal state ---
const showEditModal = ref(false)
const editingConfig = ref<AiProviderConfig | null>(null)
const selectedProvider = ref<AiProviderDef | null>(null)

// --- Lifecycle ---
onMounted(async () => {
  await aiStore.init(isAdmin.value)
})

// --- Provider helpers ---
const PROVIDER_COLORS: Record<string, string> = {
  openai: '#3fb950',
  claude: '#a78bfa',
  gemini: '#58a6ff',
  qwen: '#f0883e',
  deepseek: '#58a6ff',
  ernie: '#3fb950'
}

function getProviderColor(slug: string): string {
  return PROVIDER_COLORS[slug] ?? '#8b949e'
}

function getProviderInitials(slug: string, label: string): string {
  if (slug === 'openai') return 'GPT'
  if (slug === 'claude') return 'CLD'
  if (slug === 'gemini') return 'GEM'
  if (slug === 'qwen') return '通义'
  if (slug === 'deepseek') return 'DS'
  if (slug === 'ernie') return '文心'
  return label.slice(0, 2)
}

// --- Filtered providers ---
const filteredProviders = computed(() => {
  if (providerFilter.value === '全部') return providers.value
  if (providerFilter.value === '国内') return providers.value.filter(p => p.region === 'cn')
  return providers.value.filter(p => p.region === 'international')
})

function getExtraModelCount(provider: AiProviderDef): number {
  return Math.max(0, provider.models.length - 1)
}

// --- Config helpers ---
function maskApiKey(key: string | undefined): string {
  if (!key) return '--'
  if (key.length <= 8) return '****'
  return key.slice(0, 3) + '······' + key.slice(-4)
}

function formatLastTest(ok: boolean | null | undefined): string {
  if (ok === true) return '成功'
  if (ok === false) return '失败'
  return '--'
}

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
  <div class="ai-config-page">
    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <span>加载中...</span>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button class="btn-retry" @click="aiStore.init(isAdmin)">重试</button>
    </div>

    <!-- Content -->
    <template v-else>
      <!-- ========== 服务商列表 ========== -->
      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">服务商列表</h2>
          <div class="segmented-control">
            <button
              v-for="tab in ['全部', '国内', '国际'] as const"
              :key="tab"
              class="segment-btn"
              :class="{ active: providerFilter === tab }"
              @click="providerFilter = tab"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-provider">服务商</th>
                <th class="col-region">区域</th>
                <th class="col-model">模型</th>
                <th class="col-status">状态</th>
                <th class="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="provider in filteredProviders" :key="provider.id">
                <!-- 服务商 -->
                <td>
                  <div class="provider-cell">
                    <div
                      class="provider-icon"
                      :style="{ background: getProviderColor(provider.slug) }"
                    >
                      {{ getProviderInitials(provider.slug, provider.label) }}
                    </div>
                    <span class="provider-name">{{ provider.label }}</span>
                  </div>
                </td>

                <!-- 区域 -->
                <td>
                  <span
                    class="region-tag"
                    :class="provider.region === 'cn' ? 'region-cn' : 'region-intl'"
                  >
                    {{ provider.region === 'cn' ? '国内' : '国际' }}
                  </span>
                </td>

                <!-- 模型 -->
                <td>
                  <div class="model-cell">
                    <code class="model-name">{{ provider.default_model }}</code>
                    <span v-if="getExtraModelCount(provider) > 0" class="model-extra">
                      +{{ getExtraModelCount(provider) }}
                    </span>
                  </div>
                </td>

                <!-- 状态 -->
                <td>
                  <div class="status-cell">
                    <span
                      class="status-dot"
                      :class="provider.is_enabled ? 'status-on' : 'status-off'"
                    ></span>
                    <span class="status-text">{{ provider.is_enabled ? '启用中' : '未配置' }}</span>
                  </div>
                </td>

                <!-- 操作 -->
                <td>
                  <div class="action-cell">
                    <button class="action-link primary" @click="handleConfigure(provider)">配置</button>
                    <span v-if="!provider.is_enabled" class="action-sep">·</span>
                    <button v-if="!provider.is_enabled" class="action-link danger">禁用</button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredProviders.length === 0">
                <td colspan="5" class="empty-cell">暂无服务商</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- ========== 已保存配置 ========== -->
      <section class="section-block">
        <div class="section-header">
          <h2 class="section-title">已保存配置</h2>
          <button v-if="isAdmin" class="btn-add" @click="handleCreateConfig">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 14 14">
              <path d="M7 2v10M2 7h10"/>
            </svg>
            新增配置
          </button>
        </div>

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="col-name">名称</th>
                <th class="col-provider">服务商</th>
                <th class="col-model">模型</th>
                <th class="col-apikey">API KEY</th>
                <th class="col-status">状态</th>
                <th class="col-test">最后测试</th>
                <th class="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="config in configs" :key="config.id">
                <!-- 名称 -->
                <td>
                  <span class="config-name">{{ config.name }}</span>
                </td>

                <!-- 服务商 -->
                <td>
                  <span v-if="config.provider" class="provider-label">{{ config.provider.label }}</span>
                  <span v-else class="text-muted">--</span>
                </td>

                <!-- 模型 -->
                <td>
                  <code class="model-name">{{ config.model }}</code>
                </td>

                <!-- API KEY -->
                <td>
                  <code class="apikey-masked">{{ maskApiKey(config.api_key) }}</code>
                </td>

                <!-- 状态 -->
                <td>
                  <div class="status-cell">
                    <span
                      class="status-dot"
                      :class="config.is_active ? 'status-on' : 'status-off'"
                    ></span>
                    <span class="status-text">{{ config.is_active ? '活跃' : '闲置' }}</span>
                  </div>
                </td>

                <!-- 最后测试 -->
                <td>
                  <span class="test-result" :class="config.last_test_ok === false ? 'test-fail' : ''">
                    {{ formatLastTest(config.last_test_ok) }}
                  </span>
                </td>

                <!-- 操作 -->
                <td>
                  <div class="action-cell">
                    <button class="action-link primary" @click="handleEditConfig(config)">编辑</button>
                    <span class="action-sep">·</span>
                    <button class="action-link primary" @click="handleActivate(config)">激活</button>
                    <span class="action-sep">·</span>
                    <button class="action-link danger" @click="handleRemove(config)">删除</button>
                  </div>
                </td>
              </tr>

              <tr v-if="configs.length === 0">
                <td colspan="7" class="empty-cell">暂无已保存配置</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
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
</template>

<style scoped>
.ai-config-page {
  padding: 24px 28px;
  max-width: 1320px;
  margin: 0 auto;
  width: 100%;
}

/* ==================== Loading & Error ==================== */
.loading-state,
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 80px 20px;
  text-align: center;
  color: #8b949e;
  font-size: 13px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: #58a6ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-message {
  color: #f85149;
  margin: 0;
}

.btn-retry {
  padding: 8px 16px;
  border: 1px solid #30363d;
  border-radius: 6px;
  background: transparent;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-retry:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

/* ==================== Section Blocks ==================== */
.section-block {
  background: #161b22;
  border: 1px solid #21262d;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #21262d;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
  margin: 0;
}

/* Segmented Control */
.segmented-control {
  display: flex;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.segment-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8b949e;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.segment-btn:hover {
  color: #c9d1d9;
}

.segment-btn.active {
  background: #58a6ff;
  color: #ffffff;
}

/* Add Button */
.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #1f6feb;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-add:hover {
  background: #388bfd;
}

/* ==================== Table ==================== */
.table-wrapper {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: #6e7681;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: #0d1117;
  border-bottom: 1px solid #21262d;
  white-space: nowrap;
}

.data-table td {
  padding: 16px;
  font-size: 13px;
  color: #c9d1d9;
  background: transparent;
  transition: background 0.15s;
}

.data-table tbody tr:hover td {
  background: rgba(88, 166, 255, 0.04);
}

/* Column widths */
.col-provider { width: 160px; }
.col-region { width: 80px; }
.col-model { min-width: 180px; }
.col-status { width: 100px; }
.col-action { width: 140px; text-align: right; }
.col-name { min-width: 140px; }
.col-apikey { min-width: 180px; }
.col-test { width: 90px; }

/* ==================== Provider Cell ==================== */
.provider-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.provider-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #ffffff;
  flex-shrink: 0;
}

.provider-name {
  font-weight: 500;
  color: #f0f6fc;
}

/* ==================== Region Tag ==================== */
.region-tag {
  display: inline-flex;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.region-tag.region-intl {
  background: rgba(139, 148, 158, 0.15);
  color: #8b949e;
}

.region-tag.region-cn {
  background: rgba(88, 166, 255, 0.15);
  color: #58a6ff;
}

/* ==================== Model Cell ==================== */
.model-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.model-name {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.03);
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #21262d;
}

.model-extra {
  font-size: 10px;
  color: #6e7681;
  background: rgba(255, 255, 255, 0.03);
  padding: 2px 6px;
  border-radius: 4px;
}

/* ==================== API Key ==================== */
.apikey-masked {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 11px;
  color: #8b949e;
}

/* ==================== Status ==================== */
.status-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.status-on {
  background: #3fb950;
  box-shadow: 0 0 6px rgba(63, 185, 80, 0.5);
}

.status-dot.status-off {
  background: #6e7681;
}

.status-text {
  font-size: 12px;
  color: #c9d1d9;
}

/* ==================== Test Result ==================== */
.test-result {
  font-size: 12px;
  color: #8b949e;
}

.test-result.test-fail {
  color: #f85149;
}

/* ==================== Actions ==================== */
.action-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
}

.action-link {
  padding: 4px 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 4px;
}

.action-link.primary {
  color: #58a6ff;
}

.action-link.primary:hover {
  background: rgba(88, 166, 255, 0.1);
}

.action-link.danger {
  color: #f85149;
}

.action-link.danger:hover {
  background: rgba(248, 81, 73, 0.1);
}

.action-sep {
  color: #484f58;
  font-size: 12px;
  margin: 0 2px;
}

/* ==================== Provider Label ==================== */
.provider-label {
  font-size: 13px;
  color: #c9d1d9;
}

.config-name {
  font-weight: 500;
  color: #f0f6fc;
}

.text-muted {
  color: #6e7681;
}

/* ==================== Empty Cell ==================== */
.empty-cell {
  text-align: center;
  color: #6e7681;
  padding: 40px 16px;
  font-size: 13px;
}

/* ==================== Responsive ==================== */
@media (max-width: 768px) {
  .ai-config-page {
    padding: 16px 20px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .data-table th,
  .data-table td {
    padding: 12px;
  }
}
</style>
