<!-- [2026-05-03] 新增：DDL 映射规则管理页面 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
  modalMode.value = 'add'
  modalKind.value = activeTab.value
  modalCategory.value = selectedCategory.value
  modalIndex.value = -1
  modalSource.value = ''
  modalTarget.value = ''
  modalVisible.value = true
}

function openEditModal(index: number): void {
  const rules = filteredRules.value
  if (index < 0 || index >= rules.length) return

  modalMode.value = 'edit'
  modalKind.value = activeTab.value
  modalCategory.value = selectedCategory.value
  modalIndex.value = index
  modalSource.value = rules[index].source
  modalTarget.value = rules[index].target
  modalVisible.value = true
}

function confirmModal(): void {
  const rules = activeTab.value === 'ddl' ? ddlRules.value : bodyRules.value
  const category = modalCategory.value

  // Initialize category if needed
  if (!rules[category]) {
    rules[category] = []
  }

  // If both empty, delete the rule
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
})
</script>

<template>
  <div class="rules-page">
    <div class="rules-header">
      <h2>{{ activeTab === 'ddl' ? 'DDL 映射规则管理' : '程序块映射规则管理' }}</h2>
      <div class="rules-actions">
        <button class="btn-rule" @click="resetRules" :disabled="loading">
          重置为默认
        </button>
        <button class="btn-rule primary" @click="saveRules" :disabled="saving">
          {{ saving ? '保存中...' : '保存修改' }}
        </button>
      </div>
    </div>

    <div class="rules-tabs">
      <button
        class="rules-tab"
        :class="{ active: activeTab === 'ddl' }"
        @click="switchTab('ddl')"
      >
        DDL 规则
      </button>
      <button
        class="rules-tab"
        :class="{ active: activeTab === 'body' }"
        @click="switchTab('body')"
      >
        程序块规则
      </button>
    </div>

    <div class="rules-categories">
      <button
        v-for="cat in categoryOptions"
        :key="cat.key"
        class="rules-cat-btn"
        :class="{ active: selectedCategory === cat.key }"
        @click="switchCategory(cat.key)"
      >
        {{ cat.label }}
        <span class="rules-cat-count">{{ cat.count }}</span>
      </button>
    </div>

    <div class="rules-grid" v-if="!loading">
      <div class="rules-card">
        <div class="rules-card-head">
          <h3>{{ filteredCategory?.label }}</h3>
          <button class="btn-add" @click="openAddModal">新增</button>
        </div>
        <div class="rules-card-body">
          <div v-if="filteredRules.length === 0" class="rules-empty">
            暂无规则，点击"新增"添加
          </div>
          <button
            class="rule-row"
            v-for="(rule, idx) in filteredRules"
            :key="idx"
            @click="openEditModal(idx)"
          >
            <span class="rule-source">{{ rule.source }}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-target">{{ rule.target }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="rules-loading">
      加载中...
    </div>

    <div v-if="status.text" class="rules-status" :class="status.type">
      {{ status.text }}
    </div>

    <!-- Rule Edit Modal -->
    <div class="rule-modal-mask" v-if="modalVisible" @click.self="modalVisible = false">
      <div class="rule-modal">
        <div class="rule-modal-head">
          <h4>{{ modalMode === 'add' ? '新增规则' : '维护规则' }}</h4>
          <button class="rule-modal-close" @click="modalVisible = false">×</button>
        </div>
        <div class="rule-modal-body">
          <div class="rule-modal-field">
            <label>源语法 / 类型</label>
            <input
              v-model="modalSource"
              placeholder="请输入源语法或类型"
              @keyup.enter="confirmModal"
            />
          </div>
          <div class="rule-modal-field">
            <label>目标语法 / 类型</label>
            <input
              v-model="modalTarget"
              placeholder="请输入目标语法或类型"
              @keyup.enter="confirmModal"
            />
          </div>
          <div class="rule-modal-hint" v-if="modalMode === 'edit'">
            提示: 两个输入框都清空后点击确定将删除该规则
          </div>
        </div>
        <div class="rule-modal-foot">
          <button class="btn-modal" @click="modalVisible = false">取消</button>
          <button class="btn-modal primary" @click="confirmModal">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rules-page {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.rules-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.rules-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.rules-actions {
  display: flex;
  gap: 8px;
}

.btn-rule {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-rule:hover:not(:disabled) {
  background: var(--color-panel-2);
}

.btn-rule:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-rule.primary {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: white;
}

.btn-rule.primary:hover:not(:disabled) {
  background: var(--color-brand-600);
}

.rules-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.rules-tab {
  padding: 8px 16px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.rules-tab:hover {
  color: var(--color-text);
}

.rules-tab.active {
  color: var(--color-brand-500);
  border-bottom-color: var(--color-brand-500);
}

.rules-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.rules-cat-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-panel);
  color: var(--color-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.rules-cat-btn:hover {
  border-color: var(--color-brand-500);
  color: var(--color-text);
}

.rules-cat-btn.active {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: white;
}

.rules-cat-count {
  font-size: 10px;
  opacity: 0.8;
}

.rules-grid {
  max-width: 800px;
}

.rules-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
}

.rules-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-panel-2);
}

.rules-card-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.btn-add {
  padding: 6px 12px;
  border: 1px solid var(--color-brand-500);
  border-radius: 4px;
  background: transparent;
  color: var(--color-brand-500);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-add:hover {
  background: var(--color-brand-500);
  color: white;
}

.rules-card-body {
  padding: 8px;
}

.rules-empty {
  padding: 32px;
  text-align: center;
  color: var(--color-text-subtle);
  font-size: 13px;
}

.rule-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.rule-row:hover {
  background: var(--color-panel-2);
}

.rule-source {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  font-family: 'JetBrains Mono', monospace;
}

.rule-arrow {
  margin: 0 12px;
  color: var(--color-text-subtle);
}

.rule-target {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  font-family: 'JetBrains Mono', monospace;
}

.rules-loading {
  padding: 48px;
  text-align: center;
  color: var(--color-text-subtle);
}

.rules-status {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
  text-align: center;
}

.rules-status.success {
  background: rgba(21, 145, 95, 0.1);
  color: var(--color-success);
}

.rules-status.error {
  background: rgba(214, 69, 69, 0.1);
  color: var(--color-danger);
}

/* Modal */
.rule-modal-mask {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.rule-modal {
  width: 400px;
  background: var(--color-panel);
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.rule-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
}

.rule-modal-head h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.rule-modal-close {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-subtle);
  font-size: 18px;
  cursor: pointer;
}

.rule-modal-close:hover {
  background: var(--color-panel-2);
  color: var(--color-text);
}

.rule-modal-body {
  padding: 16px;
}

.rule-modal-field {
  margin-bottom: 16px;
}

.rule-modal-field:last-child {
  margin-bottom: 0;
}

.rule-modal-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.rule-modal-field input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  box-sizing: border-box;
}

.rule-modal-field input:focus {
  outline: none;
  border-color: var(--color-brand-500);
}

.rule-modal-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--color-text-subtle);
}

.rule-modal-foot {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 16px;
  border-top: 1px solid var(--color-border);
}

.btn-modal {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
}

.btn-modal.primary {
  background: var(--color-brand-500);
  border-color: var(--color-brand-500);
  color: white;
}

.btn-modal.primary:hover {
  background: var(--color-brand-600);
}

@media (max-width: 768px) {
  .rules-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .rules-actions {
    width: 100%;
  }

  .btn-rule {
    flex: 1;
  }

  .rules-categories {
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 8px;
  }

  .rules-cat-btn {
    flex-shrink: 0;
  }
}
</style>
