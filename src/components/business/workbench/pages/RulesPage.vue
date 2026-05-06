<!-- [2026-05-05] 更新：DDL 映射规则管理页面 - 完全匹配 UI 预览 -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { fetchUserRules, saveUserRules, resetUserRules } from '@/api/rules'

// DDL Categories
const DDL_CATS = [
  { key: 'typeMapping', label: '类型映射' },
  { key: 'syntaxMapping', label: '语法映射' },
  { key: 'functionMapping', label: '函数映射' },
  { key: 'keywordMapping', label: '关键字映射' },
  { key: 'constraintMapping', label: '约束映射' },
  { key: 'indexMapping', label: '索引映射' },
  { key: 'sequenceMapping', label: '序列映射' },
  { key: 'commentMapping', label: '注释映射' }
]

// Body Categories
const BODY_CATS = [
  { key: 'variableMapping', label: '变量映射' },
  { key: 'cursorMapping', label: '游标映射' },
  { key: 'loopMapping', label: '循环映射' },
  { key: 'exceptionMapping', label: '异常映射' },
  { key: 'refcursorMapping', label: 'REF CURSOR 映射' }
]

// State
const activeTab = ref<'ddl' | 'body'>('ddl')
const ddlRules = ref<Record<string, { source: string; target: string }[]>>({})
const bodyRules = ref<Record<string, { source: string; target: string }[]>>({})
const selectedCategory = ref('typeMapping')
const loading = ref(false)
const saving = ref(false)
const status = ref<{ type: string; text: string }>({ type: '', text: '' })

// Modal state
const modalVisible = ref(false)
const modalMode = ref<'add' | 'edit'>('add')
const modalKind = ref<'ddl' | 'body'>('ddl')
const modalCategory = ref('')
const modalIndex = ref(-1)
const modalSource = ref('')
const modalTarget = ref('')
const modalSourceInputRef = ref<HTMLInputElement | null>(null)
const lastFocusedElement = ref<HTMLElement | null>(null)

// Computed
const currentRules = computed(() => activeTab.value === 'ddl' ? ddlRules.value : bodyRules.value)
const currentCats = computed(() => activeTab.value === 'ddl' ? DDL_CATS : BODY_CATS)

const filteredCategory = computed(() => {
  return currentCats.value.find(c => c.key === selectedCategory.value) || currentCats.value[0]
})

const filteredRules = computed(() => {
  return currentRules.value[selectedCategory.value] || []
})

const categoryOptions = computed(() => {
  return currentCats.value.map(cat => ({
    ...cat,
    count: (currentRules.value[cat.key] || []).length
  }))
})

// Methods
async function loadRules(): Promise<void> {
  loading.value = true
  status.value = { type: '', text: '' }

  try {
    const [ddlResult, bodyResult] = await Promise.all([
      fetchUserRules('ddl'),
      fetchUserRules('body')
    ])

    if (ddlResult.ok) {
      ddlRules.value = ddlResult.rules_json as Record<string, { source: string; target: string }[]>
    }

    if (bodyResult.ok) {
      bodyRules.value = bodyResult.rules_json as Record<string, { source: string; target: string }[]>
    }
  } catch (err) {
    status.value = { type: 'error', text: '规则加载失败：' + String(err) }
  } finally {
    loading.value = false
  }
}

async function saveRules(): Promise<void> {
  saving.value = true
  status.value = { type: '', text: '' }

  try {
    const rules = activeTab.value === 'ddl' ? ddlRules.value : bodyRules.value
    const result = await saveUserRules(activeTab.value, rules as Record<string, unknown>)

    if (result.ok) {
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
  if (!confirm('确定要重置所有规则为默认值吗？')) return

  loading.value = true
  status.value = { type: '', text: '' }

  try {
    const result = await resetUserRules(activeTab.value)

    if (result.ok) {
      status.value = { type: 'success', text: '规则已重置为默认值' }
      await loadRules()
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
  modalKind.value = activeTab.value
  modalCategory.value = selectedCategory.value
  modalIndex.value = -1
  modalSource.value = ''
  modalTarget.value = ''
  modalVisible.value = true
  nextTick(() => {
    modalSourceInputRef.value?.focus()
  })
}

function openEditModal(index: number): void {
  const rules = filteredRules.value
  if (index < 0 || index >= rules.length) return

  lastFocusedElement.value = document.activeElement instanceof HTMLElement ? document.activeElement : null
  modalMode.value = 'edit'
  modalKind.value = activeTab.value
  modalCategory.value = selectedCategory.value
  modalIndex.value = index
  modalSource.value = rules[index].source
  modalTarget.value = rules[index].target
  modalVisible.value = true
  nextTick(() => {
    modalSourceInputRef.value?.focus()
  })
}

function confirmModal(): void {
  const rules = activeTab.value === 'ddl' ? ddlRules.value : bodyRules.value
  const category = modalCategory.value

  if (!rules[category]) {
    rules[category] = []
  }

  if (!modalSource.value.trim() && !modalTarget.value.trim()) {
    if (modalIndex.value >= 0 && modalIndex.value < rules[category].length) {
      rules[category].splice(modalIndex.value, 1)
    }
  } else {
    const rule = { source: modalSource.value.trim(), target: modalTarget.value.trim() }

    if (modalMode.value === 'add') {
      rules[category].push(rule)
    } else if (modalIndex.value >= 0 && modalIndex.value < rules[category].length) {
      rules[category][modalIndex.value] = rule
    }
  }

  modalVisible.value = false
  status.value = { type: 'success', text: '规则已' + (modalMode.value === 'add' ? '添加' : '修改') + '，记得点击保存' }
  restoreFocus()
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

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (!modalVisible.value) return
  closeModal()
}

function switchTab(tab: 'ddl' | 'body'): void {
  activeTab.value = tab
  selectedCategory.value = tab === 'ddl' ? 'typeMapping' : 'variableMapping'
}

function switchCategory(key: string): void {
  selectedCategory.value = key
}

onMounted(() => {
  loadRules()
  window.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="rules-content">
    <!-- Header -->
    <div class="rules-header">
      <h2>映射规则管理</h2>
      <div class="rules-actions">
        <button class="btn" @click="resetRules" :disabled="loading">重置</button>
        <button class="btn primary" @click="saveRules" :disabled="saving">
          {{ saving ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        class="tab"
        :class="{ active: activeTab === 'ddl' }"
        @click="switchTab('ddl')"
      >
        DDL 规则
      </button>
      <button
        class="tab"
        :class="{ active: activeTab === 'body' }"
        @click="switchTab('body')"
      >
        程序块规则
      </button>
    </div>

    <!-- Categories -->
    <div class="category-pills">
      <button
        v-for="cat in categoryOptions"
        :key="cat.key"
        class="category-pill"
        :class="{ active: selectedCategory === cat.key }"
        @click="switchCategory(cat.key)"
      >
        {{ cat.label }}
        <span class="pill-count">{{ cat.count }}</span>
      </button>
    </div>

    <!-- Rules List -->
    <div class="rules-list" v-if="!loading">
      <div class="rules-list-header">
        <span class="dir-info">{{ filteredCategory?.label }}</span>
        <button class="btn-add" @click="openAddModal">+ 新增</button>
      </div>

      <div v-if="filteredRules.length === 0" class="empty-state">
        暂无规则，点击"新增"添加
      </div>

      <button
        v-for="(rule, idx) in filteredRules"
        :key="idx"
        class="rule-row"
        type="button"
        @click="openEditModal(idx)"
      >
        <span class="src">{{ rule.source }}</span>
        <span class="arr">→</span>
        <span class="tgt">{{ rule.target }}</span>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      加载中...
    </div>

    <!-- Status -->
    <div v-if="status.text" class="status-msg" :class="status.type">
      {{ status.text }}
    </div>

    <!-- Modal -->
    <div class="modal-overlay" v-if="modalVisible" @click.self="closeModal">
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rules-modal-title">
        <div class="modal-header">
          <h3 id="rules-modal-title">{{ modalMode === 'add' ? '新增规则' : '编辑规则' }}</h3>
          <button class="modal-close" type="button" aria-label="关闭规则编辑弹窗" @click="closeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="rules-source-input">源语法 / 类型</label>
            <input id="rules-source-input" ref="modalSourceInputRef" v-model="modalSource" placeholder="请输入源语法或类型" />
          </div>
          <div class="form-group">
            <label for="rules-target-input">目标语法 / 类型</label>
            <input id="rules-target-input" v-model="modalTarget" placeholder="请输入目标语法或类型" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" type="button" @click="closeModal">取消</button>
          <button class="btn primary" @click="confirmModal">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-content {
  flex: 1;
  padding: 24px 28px;
  overflow-y: auto;
  background: var(--color-bg);
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.rules-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.rules-actions {
  display: flex;
  gap: 8px;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  padding: 10px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--color-text);
}

.tab:focus-visible {
  color: var(--color-text);
}

.tab.active {
  color: var(--color-brand-500);
  border-bottom-color: var(--color-brand-500);
}

/* Category Pills */
.category-pills {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.category-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-panel);
  color: var(--color-text-subtle);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.category-pill:hover {
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.category-pill:focus-visible {
  border-color: var(--color-border-hover);
  color: var(--color-text);
}

.category-pill.active {
  background: var(--color-brand-50);
  border-color: var(--color-brand-500);
  color: var(--color-brand-500);
}

.pill-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--color-brand-500);
  color: white;
  font-size: 10px;
  font-weight: 600;
}

/* Rules List */
.rules-list {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  overflow: hidden;
  max-width: 800px;
}

.rules-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

.dir-info {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-brand-500);
}

.btn-add {
  padding: 5px 12px;
  border: 1px solid var(--color-brand-500);
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-brand-500);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add:hover {
  background: var(--color-brand-500);
  color: white;
}

.btn-add:focus-visible {
  background: var(--color-brand-500);
  color: white;
}

.rule-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 16px;
  border-bottom: 1px solid var(--color-border);
  border-left: none;
  border-right: none;
  border-top: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
  font-family: var(--font-code);
  font-size: 12px;
}

.rule-row:hover {
  background: var(--color-panel-2);
}

.rule-row:focus-visible {
  background: var(--color-panel-2);
}

.rule-row:last-child {
  border-bottom: none;
}

.src {
  flex: 1;
  color: var(--oracle);
}

.arr {
  color: var(--color-brand-500);
  margin: 0 12px;
  font-size: 12px;
}

.tgt {
  flex: 1;
  text-align: right;
  color: var(--color-text-subtle);
}

.empty-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.loading-state {
  padding: 40px;
  text-align: center;
  color: var(--color-text-muted);
}

.status-msg {
  margin-top: 12px;
  padding: 10px 16px;
  border-radius: var(--radius-control);
  font-size: 13px;
}

.status-msg.success {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.status-msg.error {
  background: var(--color-danger-bg);
  color: var(--color-danger);
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  width: 420px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-modal);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.modal-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 20px;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--color-panel-2);
}

.modal-close:focus-visible {
  background: var(--color-panel-2);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-subtle);
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-panel-2);
  color: var(--color-text);
  font-size: 13px;
  font-family: var(--font-code);
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: var(--color-brand-500);
  box-shadow: var(--shadow-focus-ring);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

/* Buttons */
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
}

.btn:hover:not(:disabled) {
  background: var(--color-panel-2);
}

.btn.primary {
  border: none;
  background: var(--gradient-brand-primary);
  color: white;
  box-shadow: var(--shadow-brand-primary);
}

.btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-brand-primary-hover);
}

.btn:focus-visible {
  background: var(--color-panel-2);
}

.btn.primary:focus-visible {
  background: var(--gradient-brand-primary);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
