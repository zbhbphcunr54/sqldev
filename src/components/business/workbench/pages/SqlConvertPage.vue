<script setup lang="ts">
// SQL 转换页面 — DDL / 函数 / 存储过程 AI 跨数据库互转
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useWorkbenchStore, type SqlType } from '@/stores/workbench'

const sqlTypes: { label: string; value: SqlType }[] = [
  { label: 'DDL', value: 'ddl' },
  { label: '函数', value: 'function' },
  { label: '存储过程', value: 'procedure' }
]
import { useClipboard } from '@/composables/useClipboard'
import { appConfigApi } from '@/api/app-config'
import FormSelect from '@/components/common/FormSelect.vue'

const store = useWorkbenchStore()
const { copyToClipboard } = useClipboard()

// 本地状态
const isCopying = ref(false)
const copySuccess = ref(false)
const dbOptionsLoading = ref(false)
const showDetails = ref(false)
const inputEverUsed = ref(false)
const outputEverUsed = ref(false)

// 计算属性
const statusClass = computed(() =>
  store.converting
    ? 'converting'
    : store.status === 'error'
      ? 'error'
      : store.status === 'success'
        ? 'success'
        : 'ready'
)
const showAiMeta = computed(() => store.hasOutput && store.aiRatio !== null)
const accuracyLabel = computed(() =>
  store.accuracy === 'high'
    ? '高'
    : store.accuracy === 'medium'
      ? '中'
      : store.accuracy === 'low'
        ? '低'
        : ''
)
const accuracyClass = computed(() => store.accuracy ?? '')
const hasDetailInfo = computed(
  () =>
    store.status === 'success' &&
    (store.manualParts.length > 0 || store.notes.length > 0 || store.aiRatio !== null)
)
const dbSelectOptions = computed(() =>
  store.dbOptions.length > 0
    ? store.dbOptions
    : Object.values(store.dbMetaMap).map((m) => ({ slug: m.slug, label: m.label, abbr: m.abbr }))
)
const showInputEmpty = computed(() => !store.hasInput && !inputEverUsed.value)
const showOutputEmpty = computed(() => !store.hasOutput && !outputEverUsed.value)

const dbFormOptions = computed(() =>
  dbSelectOptions.value.map((o) => ({ value: o.slug, label: o.label }))
)

// 方法
function resetOutputFields(): void {
  store.outputSql = ''
  store.aiRatio = null
  store.manualNeeded = false
  store.manualParts = []
  store.notes = []
  store.accuracy = null
  showDetails.value = false
}

async function loadDbOptions(): Promise<void> {
  dbOptionsLoading.value = true
  try {
    const result = await appConfigApi.list('sql_convert')
    const dbConfig = result.configs?.find((c) => c.key === 'databases')
    if (dbConfig?.value) {
      const slugs = JSON.parse(dbConfig.value) as string[]
      store.initDbOptionsFromConfig(slugs)
    }
  } catch {
    return
  } finally {
    dbOptionsLoading.value = false
  }
}

async function handleLoadSample(): Promise<void> {
  inputEverUsed.value = true
  await store.loadSample()
}

function handleClear(): void {
  store.clearAll()
}

function handleUploadFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.sql,.ddl,.txt'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      store.inputSql = text
      inputEverUsed.value = true
      resetOutputFields()
      store.statusText = `已加载文件: ${file.name}`
    } catch {
      store.showAlert('错误', '文件读取失败')
    }
  }
  input.click()
}

async function handleCopy(): Promise<void> {
  if (!store.outputSql) return
  isCopying.value = true
  const success = await copyToClipboard(store.outputSql)
  if (success) {
    copySuccess.value = true
    store.statusText = '已复制到剪贴板'
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  }
  isCopying.value = false
}

function handlePaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text/plain')
  if (text) {
    event.preventDefault()
    store.inputSql = text
    inputEverUsed.value = true
    resetOutputFields()
  }
}

function handleSwap(): void {
  store.swapDbs()
}

async function handleConvert(): Promise<void> {
  if (store.converting) return
  showDetails.value = false
  inputEverUsed.value = true
  await store.convert()
  if (store.status === 'success') outputEverUsed.value = true
}

function toggleDetails(): void {
  showDetails.value = !showDetails.value
}

function handleKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleConvert()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  loadDbOptions()
  store.prefetchSamples()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="sc-page">
    <!-- ==================== 顶栏（标题双行） ==================== -->
    <div class="sc-top-bar">
      <h1 class="sc-title">SQL 转换</h1>
      <p class="sc-subtitle">DDL / 函数 / 存储过程 AI 跨数据库互转</p>
    </div>

    <!-- ==================== 工具栏（DB选择器居中 + 操作按钮） ==================== -->
    <div class="sc-toolbar">
      <div class="sc-toolbar-left">
        <button class="sc-toolbar-btn" :disabled="store.loadingSample" @click="handleLoadSample">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect
              x="2"
              y="2"
              width="12"
              height="12"
              rx="2"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M5 6H11M5 8H9M5 10H10"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
          <span>{{ store.loadingSample ? '加载中...' : '加载示例' }}</span>
        </button>

        <span class="sc-toolbar-sep"></span>

        <button class="sc-toolbar-btn" @click="handleUploadFile">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 2H13V10L9 14H3V2Z"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linejoin="round"
            />
            <path d="M9 2V6H13" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
          </svg>
          <span>上传文件</span>
        </button>

        <!-- SQL 类型切换 -->
        <div class="sc-type-seg">
          <button
            v-for="t in sqlTypes"
            :key="t.value"
            class="sc-type-btn"
            :class="{ active: store.sqlType === t.value }"
            @click="store.setSqlType(t.value)"
          >
            {{ t.label }}
          </button>
        </div>

        <div class="sc-toolbar-spacer"></div>

        <div class="sc-db-selector">
          <span class="sc-db-badge" :style="{ background: `var(--db-${store.sourceDb})` }">{{
            store.sourceAbbr
          }}</span>
          <FormSelect
            :model-value="store.sourceDb"
            :options="dbFormOptions"
            borderless
            @update:model-value="(v: string) => store.pickDb('sourceDb', v)"
          />
        </div>
      </div>

      <div class="sc-toolbar-center">
        <button
          class="sc-swap-btn"
          title="交换源和目标数据库"
          aria-label="交换源和目标数据库"
          @click="handleSwap"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M5 2L2 5L5 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M2 5H11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path
              d="M11 14L14 11L11 8"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M14 11H5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div class="sc-toolbar-right">
        <div class="sc-db-selector">
          <span class="sc-db-badge" :style="{ background: `var(--db-${store.targetDb})` }">{{
            store.targetAbbr
          }}</span>
          <FormSelect
            :model-value="store.targetDb"
            :options="dbFormOptions"
            borderless
            @update:model-value="(v: string) => store.pickDb('targetDb', v)"
          />
        </div>

        <button class="sc-convert-btn" :disabled="!store.canConvert" @click="handleConvert">
          {{ store.converting ? '转换中...' : '开始转换' }}
          <span class="sc-shortcut">{{ store.primaryShortcutLabel }}</span>
        </button>

        <div class="sc-toolbar-spacer"></div>

        <button class="sc-toolbar-btn" :disabled="!store.hasOutput" @click="handleCopy">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect
              x="5"
              y="3"
              width="8"
              height="10"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M4 12V5C4 4.44772 4.44772 4 5 4H9"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
          <span>{{ copySuccess ? '已复制' : '复制输出' }}</span>
        </button>

        <span class="sc-toolbar-sep"></span>

        <button
          class="sc-toolbar-btn danger"
          :disabled="!store.hasInput && !store.hasOutput"
          @click="handleClear"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 4H14M5 4V3C5 2.44772 5.44772 2 6 2H10C10.5523 2 11 2.44772 11 3V4M12 4V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V4"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span>清空</span>
        </button>
      </div>
    </div>

    <!-- ==================== 双面板工作区 ==================== -->
    <div class="sc-workspace">
      <!-- 左面板：输入 -->
      <div class="sc-panel">
        <div class="sc-panel-header">
          <div class="sc-panel-title">
            <span class="sc-db-dot" :style="{ background: `var(--db-${store.sourceDb})` }"></span>
            <span>{{ store.sourceLabel }} 输入</span>
          </div>
          <span class="sc-line-count">{{ store.inputLineCount }} 行</span>
        </div>

        <div class="sc-panel-content">
          <!-- 空状态 — 使用 v-show 确保切换可靠 -->
          <div v-show="showInputEmpty" class="sc-empty" @paste="handlePaste">
            <span class="sc-badge-ready">源 SQL 准备就绪</span>
            <h2 class="sc-empty-title">输入 {{ store.sourceLabel }} SQL</h2>
            <p class="sc-empty-desc">粘贴 DDL、函数或存储过程语句，或直接加载示例开始转换。</p>
            <p class="sc-empty-tip">可粘贴 SQL 至此</p>
            <div class="sc-empty-actions">
              <button
                class="sc-btn-accent"
                :disabled="store.loadingSample"
                @click="handleLoadSample"
              >
                {{ store.loadingSample ? '加载中...' : '加载示例' }}
              </button>
              <button class="sc-btn-outline" @click="handleUploadFile">上传 SQL</button>
            </div>
          </div>

          <textarea
            v-show="!showInputEmpty"
            v-model="store.inputSql"
            class="sc-code-editor"
            placeholder="粘贴 SQL 语句..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="sc-panel-divider"></div>

      <!-- 右面板：输出 -->
      <div class="sc-panel">
        <div class="sc-panel-header">
          <div class="sc-panel-title">
            <span class="sc-db-dot" :style="{ background: `var(--db-${store.targetDb})` }"></span>
            <span>{{ store.targetLabel }} 输出</span>
          </div>
        </div>

        <div class="sc-panel-content">
          <!-- 空状态 -->
          <div v-show="showOutputEmpty" class="sc-empty right">
            <span class="sc-badge-preview">AI 转换预览</span>
            <h2 class="sc-empty-title right">{{ store.targetLabel }} 结果会显示在这里</h2>
            <p class="sc-empty-desc">先在左侧输入 SQL，或加载示例。</p>
            <div class="sc-steps">
              <span class="sc-step">1. 准备源 SQL</span>
              <span class="sc-step">2. 选择数据库方向</span>
              <span class="sc-step">3. 点击转换</span>
            </div>
            <div class="sc-empty-actions">
              <button class="sc-btn-accent" :disabled="!store.canConvert" @click="handleConvert">
                开始转换
              </button>
            </div>
          </div>

          <textarea
            v-show="!showOutputEmpty"
            v-model="store.outputSql"
            class="sc-code-editor"
            placeholder="转换结果..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- ==================== 转换详情面板 ==================== -->
    <Transition name="details-slide">
      <div v-if="showDetails && store.status === 'success'" class="sc-details-panel">
        <div class="sc-details-grid">
          <div v-if="store.aiRatio !== null" class="sc-detail-card">
            <span class="sc-detail-label">AI 转换率</span>
            <span class="sc-detail-value ratio">{{ store.aiRatio }}%</span>
          </div>
          <div v-if="store.accuracy" class="sc-detail-card">
            <span class="sc-detail-label">准确度评估</span>
            <span class="sc-detail-value" :class="'accuracy-' + accuracyClass">{{
              accuracyLabel
            }}</span>
          </div>
          <div v-if="store.manualNeeded" class="sc-detail-card">
            <span class="sc-detail-label">状态</span>
            <span class="sc-detail-value manual">需要人工介入</span>
          </div>
        </div>

        <div v-if="store.manualParts.length > 0" class="sc-detail-section">
          <h4 class="sc-detail-heading">需人工处理的部分</h4>
          <ul class="sc-detail-list">
            <li v-for="(item, idx) in store.manualParts" :key="idx">{{ item }}</li>
          </ul>
        </div>

        <div v-if="store.notes.length > 0" class="sc-detail-section">
          <h4 class="sc-detail-heading">注意事项</h4>
          <ul class="sc-detail-list notes">
            <li v-for="(note, idx) in store.notes" :key="idx">{{ note }}</li>
          </ul>
        </div>

        <div v-if="store.translateTimeMs !== null" class="sc-detail-meta">
          <span>方向：{{ store.sourceLabel }} → {{ store.targetLabel }}</span>
          <span>耗时：{{ store.translateTimeMs }} ms</span>
        </div>
      </div>
    </Transition>

    <!-- ==================== 状态栏 ==================== -->
    <div class="sc-status-bar">
      <div class="sc-status-left">
        <span class="sc-status-dot" :class="statusClass"></span>
        <span class="sc-status-text" :class="statusClass">{{ store.statusText }}</span>

        <template v-if="showAiMeta">
          <span class="sc-status-sep"></span>
          <span class="sc-status-chip ratio">AI {{ store.aiRatio }}%</span>
          <span class="sc-status-chip" :class="'accuracy-' + accuracyClass"
            >准确度 {{ accuracyLabel }}</span
          >
          <span v-if="store.manualNeeded" class="sc-status-chip manual">需人工介入</span>
        </template>
      </div>

      <div class="sc-status-right">
        <button v-if="hasDetailInfo" class="sc-detail-toggle" @click="toggleDetails">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            class="sc-detail-chevron"
            :class="{ open: showDetails }"
            aria-hidden="true"
          >
            <path d="M4 6L8 10L12 6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>{{ showDetails ? '收起详情' : '展开转换详情' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 布局 ==================== */
.sc-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 12px;
  background: var(--color-page-panel);
  color: var(--color-page-text);
  overflow: hidden;
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

/* ==================== 顶栏 ==================== */
.sc-top-bar {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  height: 52px;
  padding: 0 24px;
  flex-shrink: 0;
}

.sc-title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-page-text);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}

.sc-subtitle {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  margin: 0;
}

/* ==================== 工具栏 ==================== */
.sc-toolbar {
  display: flex;
  align-items: center;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
  background: var(--color-page-panel);
}

.sc-toolbar-left,
.sc-toolbar-right {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sc-toolbar-right {
  justify-content: flex-end;
}

.sc-toolbar-center {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

.sc-toolbar-spacer {
  flex: 1;
}

.sc-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-page-text-subtle);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.sc-toolbar-btn:hover:not(:disabled) {
  color: var(--color-page-text);
  background: var(--color-page-elevated);
}

.sc-toolbar-btn:focus-visible {
  outline: 2px solid var(--color-page-brand);
  outline-offset: 2px;
}

.sc-toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sc-toolbar-btn.danger {
  color: var(--color-page-danger);
}

.sc-toolbar-btn.danger:hover:not(:disabled) {
  background: var(--color-danger-bg);
}

/* === SQL 类型分段控件 === */
.sc-type-seg {
  display: inline-flex;
  gap: 0;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-page-border);
  overflow: hidden;
  flex-shrink: 0;
}

.sc-type-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--color-page-border);
  color: var(--color-page-text-subtle);
  font-size: var(--text-xs);
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}

.sc-type-btn:last-child {
  border-right: none;
}

.sc-type-btn:hover {
  color: var(--color-page-text);
  background: var(--color-page-elevated);
}

.sc-type-btn.active {
  color: var(--color-page-bg);
  background: var(--color-page-brand);
  border-color: var(--color-page-brand);
}

.sc-toolbar-sep {
  width: 1px;
  height: 18px;
  background: var(--color-page-border);
  margin: 0 6px;
  flex-shrink: 0;
}

/* ==================== 数据库选择器 ==================== */
.sc-db-selector {
  display: flex;
  align-items: center;
  height: 34px;
  width: 220px;
  flex-shrink: 0;
  background: var(--color-panel-2);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding-left: 8px;
  transition: all 0.15s ease;
}

.sc-db-selector:hover {
  border-color: var(--color-border-hover);
}

.sc-db-selector:focus-within {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-bg);
}

.sc-db-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: var(--color-btn-primary-text);
  font-family: var(--font-code);
  letter-spacing: var(--tracking-tight);
  flex-shrink: 0;
}

.sc-swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-sm);
  background: var(--color-page-panel);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}

.sc-swap-btn:hover {
  color: var(--color-page-brand);
  border-color: var(--color-page-brand);
}

.sc-swap-btn:focus-visible {
  outline: 2px solid var(--color-page-brand);
  outline-offset: 2px;
}

/* ==================== 转换按钮 ==================== */
.sc-convert-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  background: var(--color-page-brand);
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-btn-primary-text);
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: var(--font-body);
  letter-spacing: var(--tracking-tight);
  line-height: 1;
  cursor: pointer;
  transition:
    filter var(--duration-normal) var(--ease-out),
    transform var(--duration-normal) var(--ease-out),
    box-shadow var(--duration-normal) var(--ease-out);
  box-shadow: var(--shadow-xs);
  white-space: nowrap;
  flex-shrink: 0;
}

.sc-convert-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.sc-convert-btn:focus-visible {
  outline: 2px solid var(--color-page-brand);
  outline-offset: 2px;
}

.sc-convert-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sc-shortcut {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-xs);
  font-size: 10px;
  font-family: var(--font-code);
  line-height: 1.2;
}

/* ==================== 工作区 ==================== */
.sc-workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.sc-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-page-panel);
  overflow: hidden;
}

.sc-panel-divider {
  width: 1px;
  background: var(--color-page-border);
  flex-shrink: 0;
}

.sc-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background: var(--color-page-panel);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.sc-panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: var(--font-body);
}

.sc-db-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sc-line-count {
  font-size: var(--text-xs);
  color: var(--color-page-text-subtle);
  font-family: var(--font-body);
}

.sc-panel-content {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ==================== 空状态 ==================== */
.sc-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 40px;
  text-align: center;
}

.sc-badge-ready {
  display: inline-block;
  padding: 6px 14px;
  background: var(--color-success-bg);
  border-radius: var(--radius-pill);
  color: var(--color-success);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--spacing-24, 24px);
}

.sc-badge-preview {
  display: inline-block;
  padding: 6px 14px;
  background: var(--color-accent-bg);
  border-radius: var(--radius-pill);
  color: var(--color-accent);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: var(--tracking-wide);
  margin-bottom: var(--spacing-24, 24px);
}

.sc-empty-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-page-text);
  letter-spacing: var(--tracking-tight);
  margin: 0 0 14px;
}

.sc-empty-title.right {
  font-size: var(--text-xl);
}

.sc-empty-desc {
  max-width: 420px;
  font-size: var(--text-base);
  color: var(--color-page-text-subtle);
  line-height: 1.7;
  margin: 0 0 16px;
}

.sc-empty-tip {
  font-size: var(--text-sm);
  color: var(--color-purple);
  margin: 0 0 28px;
  font-weight: 500;
  padding: 8px 16px;
  background: var(--color-purple-bg);
  border: 1px dashed var(--color-purple);
  border-radius: var(--radius-md);
  user-select: none;
}

.sc-empty-actions {
  display: flex;
  gap: var(--spacing-12, 12px);
}

.sc-btn-accent {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 20px;
  background: var(--color-success);
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-btn-primary-text);
  font-size: var(--text-sm);
  font-weight: 600;
  font-family: var(--font-body);
  line-height: 1;
  cursor: pointer;
  transition: transform var(--duration-normal) var(--ease-out);
}

.sc-btn-accent:hover {
  transform: translateY(-1px);
}

.sc-btn-accent:focus-visible {
  outline: 2px solid var(--color-success);
  outline-offset: 2px;
}

.sc-btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 20px;
  background: transparent;
  border: 1.5px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  color: var(--color-page-text);
  font-size: var(--text-sm);
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.sc-btn-outline:hover {
  border-color: var(--color-page-border-hover);
  background: var(--color-page-elevated);
}

.sc-btn-outline:focus-visible {
  outline: 2px solid var(--color-page-brand);
  outline-offset: 2px;
}

.sc-steps {
  display: flex;
  gap: 28px;
  margin-bottom: 28px;
}

.sc-step {
  font-size: var(--text-xs);
  color: var(--color-page-text-subtle);
  font-weight: 500;
}

/* ==================== 代码编辑器 ==================== */
.sc-code-editor {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 16px;
  background: transparent;
  border: none;
  color: var(--color-page-text);
  font-family: 'Courier New', monospace;
  font-size: var(--text-base);
  line-height: 1.7;
  resize: none;
  outline: none;
  tab-size: 2;
}

.sc-code-editor::placeholder {
  color: var(--color-page-text-muted);
  font-family: var(--font-body);
}

/* ==================== 详情面板 ==================== */
.sc-details-panel {
  padding: 16px 24px;
  background: var(--color-page-panel);
  border-top: 1px solid var(--color-page-border);
  flex-shrink: 0;
  max-height: 240px;
  overflow-y: auto;
}

.sc-details-grid {
  display: flex;
  gap: var(--spacing-16, 16px);
  margin-bottom: 12px;
}

.sc-detail-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 16px;
  background: var(--color-page-bg);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-md);
  min-width: 120px;
}

.sc-detail-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--color-page-text-muted);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
}

.sc-detail-value {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-page-text);
  font-family: var(--font-body);
}

.sc-detail-value.ratio {
  color: var(--color-success);
}
.sc-detail-value.accuracy-high {
  color: var(--color-success);
}
.sc-detail-value.accuracy-medium {
  color: var(--color-warning);
}
.sc-detail-value.accuracy-low {
  color: var(--color-page-danger);
}
.sc-detail-value.manual {
  color: var(--color-page-danger);
  font-size: var(--text-sm);
}

.sc-detail-section {
  margin-bottom: 10px;
}

.sc-detail-heading {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--color-page-text);
  margin: 0 0 6px;
  font-family: var(--font-body);
}

.sc-detail-list {
  margin: 0;
  padding: 0 0 0 18px;
  font-size: var(--text-sm);
  color: var(--color-page-text-subtle);
  line-height: 1.6;
  font-family: var(--font-body);
}

.sc-detail-list.notes li::marker {
  color: var(--color-warning);
}

.sc-detail-meta {
  display: flex;
  gap: 20px;
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  font-family: var(--font-body);
}

.details-slide-enter-active,
.details-slide-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
  max-height: 240px;
}

.details-slide-enter-from,
.details-slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

@media (prefers-reduced-motion: reduce) {
  .details-slide-enter-active,
  .details-slide-leave-active {
    transition: none;
  }
}

/* ==================== 状态栏 ==================== */
.sc-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 16px;
  background: var(--color-page-panel);
  border-top: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.sc-status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sc-status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sc-status-dot.ready {
  background: var(--color-page-success);
}
.sc-status-dot.error {
  background: var(--color-page-danger);
}
.sc-status-dot.success {
  background: var(--color-page-success);
}

.sc-status-dot.converting {
  background: var(--color-warning);
  animation: sc-pulse 1.5s ease-in-out infinite;
}

@keyframes sc-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .sc-status-dot.converting {
    animation: none;
  }
}

.sc-status-text {
  font-size: var(--text-xs);
  color: var(--color-page-text-subtle);
  font-weight: 500;
  font-family: var(--font-body);
}

.sc-status-text.success {
  color: var(--color-page-success);
}
.sc-status-text.error {
  color: var(--color-page-danger);
}
.sc-status-text.converting {
  color: var(--color-warning);
}

.sc-status-sep {
  width: 1px;
  height: 14px;
  background: var(--color-page-border);
}

.sc-status-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
  font-family: var(--font-body);
  background: var(--color-page-bg);
  color: var(--color-page-text-subtle);
}

.sc-status-chip.ratio {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.sc-status-chip.accuracy-high {
  color: var(--color-success);
  background: var(--color-success-bg);
}

.sc-status-chip.accuracy-medium {
  color: var(--color-warning);
  background: var(--color-warning-bg);
}

.sc-status-chip.accuracy-low {
  color: var(--color-page-danger);
  background: var(--color-danger-bg);
}

.sc-status-chip.manual {
  color: var(--color-page-danger);
  background: var(--color-danger-bg);
}

.sc-status-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-16, 16px);
}

.sc-detail-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-page-text-subtle);
  font-size: var(--text-xs);
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.sc-detail-toggle:hover {
  color: var(--color-page-text);
  border-color: var(--color-page-border-hover);
  background: var(--color-page-bg);
}

.sc-detail-toggle:focus-visible {
  outline: 2px solid var(--color-page-brand);
  outline-offset: 2px;
}

.sc-detail-chevron {
  transition: transform var(--duration-fast) var(--ease-out);
}

.sc-detail-chevron.open {
  transform: rotate(180deg);
}
</style>
