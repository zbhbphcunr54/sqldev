<script setup lang="ts">
/**
 * 存储过程翻译页面
 *
 * 设计规范：
 * - 深色主题，五层布局
 * - 顶栏：标题 + 数据库选择器 + 操作按钮
 * - 工具栏：加载示例、上传文件、复制输出、保存文件、清空、AI校验
 * - 双面板编辑器：Oracle 输入 / PostgreSQL 输出
 * - 状态栏：工作状态 + 翻译元信息
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'
import { requestConvert } from '@/api/convert'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { useClipboard } from '@/composables/useClipboard'

const store = useWorkbenchStore()
const router = useRouter()
const { copyToClipboard } = useClipboard()

// ==================== 示例 SQL ====================

const SAMPLE_PROC = `-- 添加用户存储过程
CREATE OR REPLACE PROCEDURE add_user(
  p_username IN VARCHAR2,
  p_email IN VARCHAR2
)
IS
BEGIN
  INSERT INTO users (id, username, email, created_at)
  VALUES (users_seq.NEXTVAL, p_username, p_email, SYSDATE);
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END add_user;`

// ==================== 状态 ====================

const isCopying = ref(false)
const copySuccess = ref(false)

// 数据库选项
const dbOptions = [
  { value: 'oracle', label: 'Oracle', abbr: 'ORA' },
  { value: 'mysql', label: 'MySQL', abbr: 'MY' },
  { value: 'postgresql', label: 'PostgreSQL', abbr: 'PG' }
]

// 翻译用时
const translateTime = ref<number | null>(null)

// ==================== 计算属性 ====================

const hasInput = computed(() => !!store.procInput.trim())
const hasOutput = computed(() => !!store.procOutput.trim())
const isConverting = computed(() => store.procConverting)

const statusText = computed(() => {
  if (isConverting.value) return '翻译中...'
  if (store.procStatus === 'success') return '翻译完成'
  if (store.procStatus === 'error') return '翻译失败'
  return '工作台已就绪'
})

const statusClass = computed(() => {
  if (isConverting.value) return 'converting'
  if (store.procStatus === 'error') return 'error'
  if (hasOutput.value) return 'success'
  return 'ready'
})

const showMetaInfo = computed(() => hasOutput.value && translateTime.value !== null)

const inputLineCount = computed(() => {
  const text = store.procInput || ''
  return text ? text.split('\n').length : 0
})

// ==================== 方法 ====================

/** 加载示例 */
function loadSample(): void {
  store.procInput = SAMPLE_PROC
  store.procOutput = ''
  store.procStatus = 'idle'
  translateTime.value = null
}

/** 清空 */
function clearAll(): void {
  store.procInput = ''
  store.procOutput = ''
  store.procStatus = 'idle'
  translateTime.value = null
}

/** 复制输出 */
async function copyOutput(): Promise<void> {
  if (!store.procOutput) return
  isCopying.value = true
  const success = await copyToClipboard(store.procOutput)
  if (success) {
    copySuccess.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  }
  isCopying.value = false
}

/** 交换数据库 */
function swapDbs(): void {
  store.swapProcDbs()
}

/** 开始翻译 */
async function handleConvert(): Promise<void> {
  if (!store.procInput.trim()) {
    store.showAlert('提示', '请输入要翻译的存储过程语句')
    return
  }

  const startTime = Date.now()
  store.procConverting = true
  store.procStatus = 'loading'

  try {
    const result = await requestConvert({
      sourceDialect: store.procSourceDb,
      targetDialect: store.procTargetDb,
      sql: store.procInput,
      kind: 'proc'
    })

    translateTime.value = Date.now() - startTime

    if (result.ok) {
      store.procOutput = result.outputSql || ''
      store.procStatus = 'success'
    } else {
      store.procOutput = ''
      store.procStatus = 'error'
      store.showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
    }
  } catch (error) {
    store.procOutput = ''
    store.procStatus = 'error'
    store.showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.procConverting = false
  }
}

/** AI 校验 */
function aiVerify(): void {
  if (!store.procOutput) {
    store.showAlert('提示', '请先进行翻译后再使用 AI 校验')
    return
  }
  store.showAlert('AI 校验', 'AI 校验功能开发中...')
}

/** 键盘快捷键 */
function handleKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleConvert()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="proc-page">
    <!-- ==================== 页面顶栏 ==================== -->
    <header class="top-bar">
      <!-- 左侧：标题 -->
      <div class="top-bar-left">
        <h1 class="page-title">存储过程翻译</h1>
        <div class="page-subtitle">
          <span>CREATE PROCEDURE</span>
          <span class="dot">·</span>
          <span>存储过程</span>
          <span class="dot">·</span>
          <span>PL/SQL</span>
        </div>
      </div>

      <!-- 中间：翻译方向选择器 -->
      <div class="top-bar-center">
        <div class="db-selector">
          <span class="db-badge oracle">ORA</span>
          <select
            :value="store.procSourceDb"
            class="db-select"
            @change="
              store.pickDb('procSourceDb', ($event.target as HTMLSelectElement).value as any)
            "
          >
            <option v-for="db in dbOptions" :key="db.value" :value="db.value">
              {{ db.label }}
            </option>
          </select>
          <svg class="select-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 3.75L5 6.25L7.5 3.75"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        <button class="swap-btn" title="交换源和目标数据库" @click="swapDbs">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M12 5L14 7L12 9"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M14 7H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <path
              d="M4 11L2 9L4 7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M2 9H8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>

        <div class="db-selector">
          <span class="db-badge postgresql">PG</span>
          <select
            :value="store.procTargetDb"
            class="db-select"
            @change="
              store.pickDb('procTargetDb', ($event.target as HTMLSelectElement).value as any)
            "
          >
            <option v-for="db in dbOptions" :key="db.value" :value="db.value">
              {{ db.label }}
            </option>
          </select>
          <svg class="select-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2.5 3.75L5 6.25L7.5 3.75"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <!-- 右侧：操作按钮 -->
      <div class="top-bar-right">
        <button class="text-link" @click="router.push('/')">退回首页</button>
        <button class="btn-primary" :disabled="isConverting || !hasInput" @click="handleConvert">
          {{ isConverting ? '翻译中...' : '开始翻译' }}
          <span class="shortcut">Ctrl+Enter</span>
        </button>
        <button class="icon-btn" title="更多选项">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="3" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="13" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>
    </header>

    <!-- ==================== 工具栏 ==================== -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button class="toolbar-btn" @click="loadSample">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
          <span>加载示例</span>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
      </div>

      <div class="toolbar-right">
        <button class="toolbar-btn" :disabled="!hasOutput" @click="copyOutput">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
          <span>{{ copySuccess ? '已复制 ✓' : '复制输出' }}</span>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M13 10V12C13 12.5523 12.5523 13 12 13H4C3.44772 13 3 12.5523 3 12V4C3 3.44772 3.44772 3 4 3H6"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M8 3V8H13"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path d="M13 3L8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          </svg>
          <span>保存文件</span>
        </button>

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn danger" :disabled="!hasInput && !hasOutput" @click="clearAll">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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

        <div class="toolbar-divider"></div>

        <button class="toolbar-btn ai" :disabled="!hasOutput" @click="aiVerify">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 1V2.5M8 13.5V15M1 8H2.5M13.5 8H15M3.5 3.5L4.5 4.5M11.5 11.5L12.5 12.5M11.5 4.5L12.5 3.5M4.5 11.5L3.5 12.5"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3" />
          </svg>
          <span>AI 校验</span>
        </button>
      </div>
    </div>

    <!-- ==================== 双面板编辑器 ==================== -->
    <div class="workspace">
      <!-- 左面板 -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span class="db-dot oracle"></span>
            <span>Oracle 输入</span>
          </div>
          <span class="panel-hint">
            <span class="hint-tag">支持粘贴 SQL</span>
            <span class="hint-tag">Ctrl/⌘ + V</span>
          </span>
          <span class="line-count">{{ inputLineCount }} 行</span>
        </div>

        <div class="panel-content">
          <div v-if="!hasInput" class="empty-state">
            <span class="badge-ready">Ready for Source SQL</span>
            <h2 class="empty-title">从存储过程开始</h2>
            <p class="empty-desc">粘贴 CREATE PROCEDURE 语句，或加载示例。</p>
            <p class="empty-tip">提示：可直接粘贴 SQL（Ctrl / ⌘ + V）</p>
            <div class="empty-actions">
              <button class="btn-success" @click="loadSample">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M7 1V7M7 7L4 4M7 7L10 4"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M2 10V11.5C2 12.0523 2.44772 12.5 3 12.5H11C11.5523 12.5 12 12.0523 12 11.5V10"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
                加载示例
              </button>
              <button class="btn-outline">上传 SQL</button>
            </div>
          </div>

          <textarea
            v-else
            v-model="store.procInput"
            class="code-editor"
            placeholder="粘贴 CREATE PROCEDURE 语句..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <div class="panel-divider"></div>

      <!-- 右面板 -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <span class="db-dot postgresql"></span>
            <span>PostgreSQL 输出</span>
          </div>
          <span class="panel-hint">可直接编辑 · 审阅批注</span>
        </div>

        <div class="panel-content">
          <div v-if="!hasOutput" class="empty-state right">
            <span class="badge-preview">Translation Preview</span>
            <h2 class="empty-title right">PostgreSQL 结果会显示在这里</h2>
            <p class="empty-desc">先在左侧输入 SQL，或加载示例。</p>
            <div class="steps">
              <span class="step">1. 准备源 SQL</span>
              <span class="step">2. 检查转换方向</span>
              <span class="step">3. 开始翻译</span>
            </div>
            <div class="empty-actions">
              <button
                class="btn-outline"
                :disabled="!hasInput || isConverting"
                @click="handleConvert"
              >
                {{ isConverting ? '翻译中...' : '开始翻译' }}
              </button>
              <button class="btn-primary-outline" @click="loadSample">加载示例</button>
            </div>
          </div>

          <textarea
            v-else
            v-model="store.procOutput"
            class="code-editor"
            placeholder="翻译结果..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- ==================== 状态栏 ==================== -->
    <div class="status-bar">
      <div class="status-left">
        <span class="status-dot" :class="statusClass"></span>
        <span class="status-text" :class="statusClass">{{ statusText }}</span>
      </div>
      <div v-if="showMetaInfo" class="status-right">
        <span class="meta-item">
          <span class="meta-label">来源：</span>
          <span class="meta-value">{{ store.procSourceLabel }} → {{ store.procTargetLabel }}</span>
        </span>
        <span class="meta-divider"></span>
        <span class="meta-item">
          <span class="meta-label">引擎：</span>
          <span class="meta-value">Procedure Parser v1.0</span>
        </span>
        <span class="meta-divider"></span>
        <span class="meta-item">
          <span class="meta-label">用时：</span>
          <span class="meta-value">{{ translateTime }} 毫秒</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 全局字体 ==================== */
.proc-page {
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

/* ==================== 布局 ==================== */
.proc-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0b1120;
  color: #e2e8f0;
  overflow: hidden;
  position: relative;
}

/* ==================== 页面顶栏 ==================== */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.top-bar-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.page-subtitle .dot {
  opacity: 0.5;
}

.top-bar-center {
  display: flex;
  align-items: center;
  gap: 12px;
}

.db-selector {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: #111827;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.db-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.db-badge.oracle {
  background: #dc2626;
}

.db-badge.postgresql {
  background: #6366f1;
}

.db-select {
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  outline: none;
  padding-right: 4px;
}

.db-select option {
  background: #111827;
  color: #e2e8f0;
}

.select-arrow {
  color: #94a3b8;
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #111827;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.swap-btn:hover {
  color: #6366f1;
  border-color: #6366f1;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-link {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s;
}

.text-link:hover {
  color: #fff;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: #5558e3;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shortcut {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
  font-size: 10px;
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

/* ==================== 工具栏 ==================== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  background: transparent;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn:hover:not(:disabled) {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.danger {
  color: #ef4444;
}

.toolbar-btn.danger:hover:not(:disabled) {
  color: #dc2626;
  background: rgba(239, 68, 68, 0.1);
}

.toolbar-btn.ai {
  color: #818cf8;
}

.toolbar-btn.ai:hover:not(:disabled) {
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0 4px;
}

/* ==================== 工作区 ==================== */
.workspace {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

.panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #111827;
  overflow: hidden;
}

.panel-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.06);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 36px;
  padding: 0 16px;
  background: #0f172a;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
}

.db-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.db-dot.oracle {
  background: #dc2626;
}

.db-dot.postgresql {
  background: #6366f1;
}

.panel-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.hint-tag {
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 11px;
  color: #94a3b8;
}

.line-count {
  font-size: 12px;
  color: #94a3b8;
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.panel-content {
  flex: 1;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

/* ==================== 空状态 ==================== */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
}

.badge-ready {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(16, 185, 129, 0.15);
  border-radius: 20px;
  color: #10b981;
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 20px;
}

.badge-preview {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(99, 102, 241, 0.15);
  border-radius: 20px;
  color: #818cf8;
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 20px;
}

.empty-title {
  font-size: 28px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 16px;
}

.empty-title.right {
  font-size: 24px;
}

.empty-desc {
  max-width: 420px;
  font-size: 14px;
  color: #94a3b8;
  line-height: 1.6;
  margin: 0 0 12px;
}

.empty-tip {
  font-size: 12px;
  color: rgba(148, 163, 184, 0.6);
  margin: 0 0 24px;
}

.steps {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.step {
  font-size: 12px;
  color: #94a3b8;
}

.empty-actions {
  display: flex;
  gap: 12px;
}

.btn-success {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: #10b981;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-success:hover {
  background: #0ea472;
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-primary-outline {
  padding: 10px 20px;
  background: #6366f1;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary-outline:hover {
  background: #5558e3;
}

/* ==================== 代码编辑器 ==================== */
.code-editor {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 16px;
  background: #111827;
  border: none;
  color: #e2e8f0;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
  resize: none;
  outline: none;
}

.code-editor::placeholder {
  color: rgba(148, 163, 184, 0.5);
}

/* ==================== 状态栏 ==================== */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 16px;
  background: #0b1120;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-dot.ready {
  background: #10b981;
}

.status-dot.converting {
  background: #f59e0b;
}

.status-dot.success {
  background: #10b981;
}

.status-dot.error {
  background: #ef4444;
  animation: none;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.1);
  }
}

.status-text {
  font-size: 12px;
  color: #94a3b8;
}

.status-text.success {
  color: #10b981;
}

.status-text.error {
  color: #ef4444;
}

.status-text.converting {
  color: #f59e0b;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.meta-label {
  color: #64748b;
}

.meta-value {
  color: #94a3b8;
  font-family: 'JetBrains Mono', Consolas, monospace;
}

.meta-divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
}
</style>
