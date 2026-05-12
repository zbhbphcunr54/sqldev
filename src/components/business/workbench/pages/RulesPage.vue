<!-- [2026-05-07] 映射规则管理页面 - 按数据库方向展示 -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { fetchUserRules, saveUserRules, resetUserRules, type DbType, type RuleKind, type RuleItem, type BodyRuleItem } from '@/api/rules'

// Database options
const DB_OPTIONS: { value: DbType; label: string }[] = [
  { value: 'oracle', label: 'Oracle' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'pg', label: 'PostgreSQL' }
]

// State
const sourceDb = ref<DbType>('oracle')
const targetDb = ref<DbType>('pg')
const activeTab = ref<RuleKind>('ddl')
const rules = ref<(RuleItem | BodyRuleItem)[]>([])
const loading = ref(false)
const saving = ref(false)
const status = ref<{ type: string; text: string }>({ type: '', text: '' })
const lastSavedAt = ref<string | null>(null)
const isDefault = ref(false)

// Modal state
const modalVisible = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const modalIndex = ref(-1)
const modalSource = ref('')
const modalTarget = ref('')
const modalSourceInputRef = ref<HTMLInputElement | null>(null)
const lastFocusedElement = ref<HTMLElement | null>(null)

// Computed
const currentRuleKind = computed((): 'source' | 's' => activeTab.value === 'ddl' ? 'source' : 's')
const targetKey = computed((): 'target' | 't' => activeTab.value === 'ddl' ? 'target' : 't')

const sourceLabel = computed(() => DB_OPTIONS.find(d => d.value === sourceDb.value)?.label || '')
const targetLabel = computed(() => DB_OPTIONS.find(d => d.value === targetDb.value)?.label || '')

const ruleCount = computed(() => rules.value.length)

const formattedLastSaved = computed(() => {
  if (!lastSavedAt.value) return ''
  const date = new Date(lastSavedAt.value)
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
})

// Get target value safely (avoids template type assertion parsing issue)
function getRuleTarget(rule: RuleItem | BodyRuleItem): string {
  return String((rule as Record<string, unknown>)[targetKey.value] ?? '')
}

// Methods
async function loadRules(): Promise<void> {
  loading.value = true
  status.value = { type: '', text: '' }

  try {
    const result = await fetchUserRules(sourceDb.value, targetDb.value, activeTab.value)

    if (result.ok) {
      rules.value = result.rules_json as (RuleItem | BodyRuleItem)[]
      lastSavedAt.value = result.updated_at
      isDefault.value = result.id === 0
    } else {
      status.value = { type: 'error', text: '规则加载失败' }
    }
  } catch (err) {
    status.value = { type: 'error', text: '规则加载失败：' + String(err) }
    rules.value = []
  } finally {
    loading.value = false
  }
}

async function saveRules(): Promise<void> {
  if (rules.value.length === 0) {
    status.value = { type: 'warning', text: '规则列表为空，无需保存' }
    return
  }

  saving.value = true
  status.value = { type: '', text: '' }

  try {
    const result = await saveUserRules(sourceDb.value, targetDb.value, activeTab.value, rules.value)

    if (result.ok) {
      lastSavedAt.value = result.updated_at
      isDefault.value = false
      status.value = { type: 'success', text: '规则保存成功' }
    } else {
      status.value = { type: 'error', text: '规则保存失败' }
    }
  } catch (err) {
    status.value = { type: 'error', text: '规则保存失败：' + String(err) }
  } finally {
    saving.value = false
  }
}

async function resetRules(): Promise<void> {
  if (!confirm(`确定要重置 ${sourceLabel.value} → ${targetLabel.value} 的${activeTab.value === 'ddl' ? 'DDL' : '程序块'}规则为默认值吗？`)) {
    return
  }

  loading.value = true
  status.value = { type: '', text: '' }

  try {
    const result = await resetUserRules(sourceDb.value, targetDb.value, activeTab.value)

    if (result.ok) {
      await loadRules()
      status.value = { type: 'success', text: '规则已重置为默认值' }
    } else {
      status.value = { type: 'error', text: '规则重置失败' }
    }
  } catch (err) {
    status.value = { type: 'error', text: '规则重置失败：' + String(err) }
  } finally {
    loading.value = false
  }
}

function openAddModal(): void {
  lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modalMode.value = 'add'
  modalIndex.value = -1
  modalSource.value = ''
  modalTarget.value = ''
  modalVisible.value = true
  nextTick(() => modalSourceInputRef.value?.focus())
}

function openEditModal(index: number): void {
  const rule = rules.value[index]
  if (!rule) return

  lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modalMode.value = 'edit'
  modalIndex.value = index
  modalSource.value = (rule as RuleItem)[currentRuleKind.value] || ''
  modalTarget.value = (rule as Record<string, unknown>)[targetKey.value] as string || ''
  modalVisible.value = true
  nextTick(() => modalSourceInputRef.value?.focus())
}

function confirmModal(): void {
  if (!modalSource.value.trim() && !modalTarget.value.trim()) {
    // Both empty - delete the rule if editing
    if (modalMode.value === 'edit' && modalIndex.value >= 0) {
      rules.value.splice(modalIndex.value, 1)
    }
  } else {
    const rule = activeTab.value === 'ddl'
      ? { source: modalSource.value.trim(), target: modalTarget.value.trim() }
      : { s: modalSource.value.trim(), t: modalTarget.value.trim() }

    if (modalMode.value === 'add') {
      rules.value.push(rule as RuleItem | BodyRuleItem)
    } else if (modalIndex.value >= 0) {
      rules.value[modalIndex.value] = rule as RuleItem | BodyRuleItem
    }
  }

  modalVisible.value = false
  isDefault.value = false
  status.value = {
    type: 'success',
    text: `规则已${modalMode.value === 'add' ? '添加' : '修改'}，记得点击保存`
  }
  restoreFocus()
}

function deleteRule(index: number): void {
  if (!confirm('确定要删除这条规则吗？')) return
  rules.value.splice(index, 1)
  isDefault.value = false
  status.value = { type: 'success', text: '规则已删除，记得点击保存' }
}

function closeModal(): void {
  modalVisible.value = false
  restoreFocus()
}

function restoreFocus(): void {
  nextTick(() => {
    lastFocusedElement.value?.focus()
    lastFocusedElement.value = null
  })
}

function swapDb(): void {
  const temp = sourceDb.value
  sourceDb.value = targetDb.value
  targetDb.value = temp
}

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (modalVisible.value) closeModal()
}

// Watch for source/target db or tab changes
watch([sourceDb, targetDb, activeTab], () => {
  loadRules()
})

onMounted(() => {
  loadRules()
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="rules-page">
    <!-- Header -->
    <div class="rules-header">
      <h1>映射规则管理</h1>
      <div class="header-actions">
        <button class="btn btn-ghost" :disabled="loading" @click="resetRules">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 7a6 6 0 1 0 1.5-3.5M1 1v3.5h3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          重置
        </button>
        <button class="btn btn-primary" :disabled="saving || loading" @click="saveRules">
          <svg v-if="!saving" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="saving" class="spinner"></span>
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <!-- Database Direction Selector -->
    <div class="db-selector">
      <div class="db-select-group">
        <label class="db-label">源数据库</label>
        <select v-model="sourceDb" class="db-select">
          <option v-for="db in DB_OPTIONS" :key="db.value" :value="db.value">
            {{ db.label }}
          </option>
        </select>
      </div>

      <button class="swap-btn" title="交换源和目标" aria-label="交换源和目标" @click="swapDb">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M4 10h9M11 6l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 10H7M9 14l-4-4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <div class="db-select-group">
        <label class="db-label">目标数据库</label>
        <select v-model="targetDb" class="db-select">
          <option v-for="db in DB_OPTIONS" :key="db.value" :value="db.value">
            {{ db.label }}
          </option>
        </select>
      </div>

      <div class="direction-badge">
        {{ sourceLabel }} → {{ targetLabel }}
      </div>
    </div>

    <!-- Tabs -->
    <div class="tab-bar">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'ddl' }"
        @click="activeTab = 'ddl'"
      >
        DDL 规则
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'body' }"
        @click="activeTab = 'body'"
      >
        程序块规则
      </button>
    </div>

    <!-- Rules Table -->
    <div class="rules-table-wrapper">
      <div class="rules-table-header">
        <div class="rules-table-title">
          <span class="rule-count">{{ ruleCount }} 条规则</span>
          <span v-if="isDefault" class="default-badge">系统默认</span>
        </div>
        <button class="btn-add" @click="openAddModal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          新增
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="loading-state">
        <div class="spinner large"></div>
        <span>加载中...</span>
      </div>

      <!-- Empty State -->
      <div v-else-if="rules.length === 0" class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" stroke-width="2"/>
          <path d="M6 18h36M14 26h20M14 32h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>暂无规则数据</p>
        <span>点击"新增"添加第一条规则</span>
      </div>

      <!-- Rules List -->
      <div v-else class="rules-list">
        <div v-for="(rule, index) in rules" :key="index" class="rule-item">
          <div class="rule-content">
            <span class="rule-source">{{ (rule as RuleItem)[currentRuleKind] || (rule as BodyRuleItem).s }}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-target">{{ getRuleTarget(rule) }}</span>
          </div>
          <div class="rule-actions">
            <button class="action-btn edit" title="编辑" aria-label="编辑" @click="openEditModal(index)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M10 2l2 2-7 7H3v-2l7-7z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button class="action-btn delete" title="删除" aria-label="删除" @click="deleteRule(index)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M5 4V2h4v2M5 6v5M9 6v5M3 4l1 8h6l1-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="rules-footer">
      <span v-if="formattedLastSaved">上次保存：{{ formattedLastSaved }}</span>
      <span v-else>尚未保存</span>
    </div>

    <!-- Status Toast -->
    <Transition name="toast">
      <div v-if="status.text" class="status-toast" :class="status.type">
        {{ status.text }}
      </div>
    </Transition>

    <!-- Modal -->
    <Transition name="modal">
      <div v-if="modalVisible" class="modal-overlay" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3>{{ modalMode === 'add' ? '新增规则' : '编辑规则' }}</h3>
            <button class="modal-close" @click="closeModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>源表达式</label>
              <input
                ref="modalSourceInputRef"
                v-model="modalSource"
                :placeholder="activeTab === 'ddl' ? '例如: VARCHAR2(n)' : '例如: NVL(a, b)'"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <label>目标表达式</label>
              <input
                v-model="modalTarget"
                :placeholder="activeTab === 'ddl' ? '例如: VARCHAR(n)' : '例如: IFNULL(a, b)'"
                class="form-input"
              />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" @click="closeModal">取消</button>
            <button class="btn btn-primary" @click="confirmModal">确定</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rules-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-page-bg);
  color: var(--color-page-text);
  overflow: hidden;
}

/* Header */
.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--color-page-card);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.rules-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--color-page-text);
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  gap: 10px;
}

/* Database Selector */
.db-selector {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: var(--color-page-card);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.db-select-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.db-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.db-select {
  padding: 10px 36px 10px 14px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
  color: var(--color-page-text);
  font-size: 14px;
  font-family: var(--font-body);
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5l3 3 3-3' stroke='%238b949e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  min-width: 150px;
  transition: all var(--duration-fast) var(--ease-apple);
}

.db-select:hover {
  border-color: var(--color-page-border-hover);
}

.db-select:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.db-select option {
  background: var(--color-page-card);
  color: var(--color-page-text);
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border);
  border-radius: 50%;
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  flex-shrink: 0;
}

.swap-btn:hover {
  background: var(--color-page-elevated);
  color: var(--color-accent);
  border-color: var(--color-accent);
  transform: rotate(180deg);
}

.direction-badge {
  margin-left: auto;
  padding: 8px 16px;
  background: var(--color-accent-bg);
  border: 1px solid var(--color-accent-border);
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-accent);
  letter-spacing: -0.01em;
}

/* Tab Bar */
.tab-bar {
  display: flex;
  gap: 4px;
  padding: 12px 24px;
  background: var(--color-page-card);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.tab-btn {
  padding: 10px 20px;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-page-text-subtle);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.tab-btn:hover {
  color: var(--color-page-text);
  background: var(--color-page-border-light);
}

.tab-btn.active {
  background: var(--color-accent);
  color: #ffffff;
}

/* Rules Table Wrapper */
.rules-table-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin: 20px 24px;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  min-height: 0;
}

.rules-table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  background: var(--color-page-elevated);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.rules-table-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-count {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-page-text);
  letter-spacing: -0.01em;
}

.default-badge {
  padding: 4px 12px;
  background: var(--color-page-gray-bg);
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-gray);
  letter-spacing: 0.02em;
}

.btn-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--color-accent);
  border: none;
  border-radius: var(--radius-pill);
  color: #ffffff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.btn-add:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

/* Loading State */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--color-page-text-subtle);
  font-size: 13px;
}

/* Empty State */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-page-text-muted);
  padding: 48px;
}

.empty-state svg {
  color: var(--color-page-text-muted);
  opacity: 0.4;
}

.empty-state p {
  margin: 8px 0 0;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-page-text-subtle);
  letter-spacing: -0.01em;
}

.empty-state span {
  font-size: 13px;
}

/* Rules List */
.rules-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-page-scrollbar-thumb) transparent;
}

.rules-list::-webkit-scrollbar {
  width: 6px;
}

.rules-list::-webkit-scrollbar-track {
  background: transparent;
}

.rules-list::-webkit-scrollbar-thumb {
  background: var(--color-page-scrollbar-thumb);
  border-radius: 3px;
}

.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-page-border);
  transition: background var(--duration-fast) var(--ease-apple);
}

.rule-item:last-child {
  border-bottom: none;
}

.rule-item:hover {
  background: var(--color-page-input);
}

.rule-content {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  min-width: 0;
  font-family: var(--font-code);
  font-size: 13px;
  letter-spacing: -0.01em;
}

.rule-source {
  padding: 6px 12px;
  background: var(--color-warning-bg);
  border-radius: var(--radius-md);
  color: var(--color-warning);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 40%;
}

.rule-arrow {
  color: var(--color-accent);
  flex-shrink: 0;
  font-weight: 300;
}

.rule-target {
  padding: 6px 12px;
  background: rgba(34, 197, 94, 0.15);
  border-radius: var(--radius-md);
  color: #22c55e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 40%;
}

.rule-actions {
  display: flex;
  gap: 6px;
  margin-left: 16px;
  flex-shrink: 0;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-md);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.action-btn:hover {
  background: var(--color-page-input);
  border-color: var(--color-page-border-hover);
}

.action-btn.edit:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.action-btn.delete:hover {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

/* Footer */
.rules-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 14px 24px;
  background: var(--color-page-card);
  border-top: 1px solid var(--color-page-border);
  font-size: 12px;
  color: var(--color-page-text-muted);
  flex-shrink: 0;
}

/* Status Toast */
.status-toast {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  z-index: 1000;
  box-shadow: var(--shadow-lg);
}

.status-toast.success {
  background: var(--color-page-success-bg);
  color: var(--color-page-success);
  border: 1px solid var(--color-page-success);
}

.status-toast.error {
  background: var(--color-page-danger-bg);
  color: var(--color-page-danger);
  border: 1px solid var(--color-page-danger);
}

.status-toast.warning {
  background: var(--color-page-gray-bg);
  color: var(--color-page-warning);
  border: 1px solid var(--color-page-warning);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.modal {
  width: 480px;
  background: var(--color-page-card);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-xl);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 24px;
  border-bottom: 1px solid var(--color-page-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-page-text);
  letter-spacing: -0.01em;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--color-page-text-muted);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.modal-close:hover {
  background: var(--color-page-input);
  color: var(--color-page-text);
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-page-text-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-lg);
  color: var(--color-page-text);
  font-size: 14px;
  font-family: var(--font-code);
  box-sizing: border-box;
  transition: all var(--duration-fast) var(--ease-apple);
}

.form-input:hover {
  border-color: var(--color-page-border-hover);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.form-input::placeholder {
  color: var(--color-page-text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px 24px;
  border-top: 1px solid var(--color-page-border);
  background: var(--color-page-elevated);
  border-radius: 0 0 var(--radius-xl) var(--radius-xl);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-page-border);
  color: var(--color-page-text);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--color-page-input);
  color: var(--color-page-text);
  border-color: var(--color-page-border-hover);
}

.btn-primary {
  background: var(--color-accent);
  border: none;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid transparent;
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner.large {
  width: 28px;
  height: 28px;
  border-width: 2.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all var(--duration-normal) var(--ease-spring);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(16px);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--duration-normal) var(--ease-out);
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform var(--duration-normal) var(--ease-spring);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal,
.modal-leave-to .modal {
  transform: scale(0.95) translateY(8px);
}
</style>
