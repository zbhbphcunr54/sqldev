<script setup lang="ts">
/**
 * 函数翻译页面
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
import { requestConvertVerify } from '@/api/convert-verify'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { useClipboard } from '@/composables/useClipboard'
import { SAMPLE_FUNC } from '@/features/sql/samples'

const store = useWorkbenchStore()
const router = useRouter()
const { copyToClipboard } = useClipboard()

// ==================== 状态 ====================

const referenceCollapsed = ref(true)
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

const hasInput = computed(() => !!store.funcInput.trim())
const hasOutput = computed(() => !!store.funcOutput.trim())
const isConverting = computed(() => store.funcConverting)

const statusText = computed(() => {
  if (isConverting.value) return '翻译中...'
  if (store.funcStatus === 'success') return '翻译完成'
  if (store.funcStatus === 'error') return '翻译失败'
  return '工作台已就绪'
})

const statusClass = computed(() => {
  if (isConverting.value) return 'converting'
  if (store.funcStatus === 'error') return 'error'
  if (hasOutput.value) return 'success'
  return 'ready'
})

const showMetaInfo = computed(() => hasOutput.value && translateTime.value !== null)

const inputLineCount = computed(() => {
  const text = store.funcInput || ''
  return text ? text.split('\n').length : 0
})

// ==================== 方法 ====================

/** 加载示例 */
function loadSample(): void {
  store.funcInput = SAMPLE_FUNC
  store.funcOutput = ''
  store.funcStatus = 'idle'
  translateTime.value = null
}

/** 清空 */
function clearAll(): void {
  store.funcInput = ''
  store.funcOutput = ''
  store.funcStatus = 'idle'
  translateTime.value = null
}

/** 上传文件 */
function handleUploadFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.sql,.txt'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      store.funcInput = text
      store.funcOutput = ''
      store.funcStatus = 'idle'
    } catch {
      store.showAlert('错误', '文件读取失败')
    }
  }
  input.click()
}

/** 复制输出 */
async function copyOutput(): Promise<void> {
  if (!store.funcOutput) return
  isCopying.value = true
  const success = await copyToClipboard(store.funcOutput)
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
  store.swapFuncDbs()
}

/** 开始翻译 */
async function handleConvert(): Promise<void> {
  if (!store.funcInput.trim()) {
    store.showAlert('提示', '请输入要翻译的函数语句')
    return
  }

  const startTime = Date.now()
  store.funcConverting = true
  store.funcStatus = 'loading'

  try {
    const result = await requestConvert({
      sourceDialect: store.funcSourceDb,
      targetDialect: store.funcTargetDb,
      sql: store.funcInput,
      kind: 'func'
    })

    translateTime.value = Date.now() - startTime

    if (result.ok) {
      store.funcOutput = result.outputSql || ''
      store.funcStatus = 'success'
    } else {
      store.funcOutput = ''
      store.funcStatus = 'error'
      store.showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
    }
  } catch (error) {
    store.funcOutput = ''
    store.funcStatus = 'error'
    store.showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.funcConverting = false
  }
}

/** AI 校验 */
async function aiVerify(): Promise<void> {
  if (!store.funcOutput) {
    store.showAlert('提示', '请先进行翻译后再使用 AI 校验')
    return
  }

  store.funcConverting = true
  store.funcStatusText = 'AI 校验中...'

  try {
    const result = await requestConvertVerify({
      kind: 'func',
      fromDb: store.funcSourceDb as 'oracle' | 'mysql' | 'postgresql',
      toDb: store.funcTargetDb as 'oracle' | 'mysql' | 'postgresql',
      inputSql: store.funcInput,
      outputSql: store.funcOutput
    })

    if (result.ok) {
      const score = result.overallScore ?? 0
      const issues = [
        ...(result.syntaxIssues ?? []),
        ...(result.semanticIssues ?? []),
        ...(result.logicRisks ?? [])
      ]
      const issueCount = issues.length
      const summary = result.summary || `综合评分 ${score} 分，发现 ${issueCount} 个问题`
      store.funcStatusText = `校验完成 - ${summary}`
      store.showAlert('AI 校验完成', summary)
    } else {
      store.funcStatusText = '校验失败'
      store.showAlert('校验失败', mapErrorCodeToMessage(result.error || 'verify_failed'))
    }
  } catch (error) {
    store.funcStatusText = '校验失败'
    store.showAlert('校验失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.funcConverting = false
  }
}

/** 键盘快捷键 */
function handleKeydown(e: KeyboardEvent): void {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    handleConvert()
  }
}

/** 切换类型映射参考 */
function toggleReference(): void {
  referenceCollapsed.value = !referenceCollapsed.value
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// 函数语法映射数据
const funcSyntaxMappings = [
  {
    title: '函数声明与参数',
    icon: 'func',
    items: [
      { oracle: 'CREATE FUNCTION name(p IN type)', mysql: 'CREATE FUNCTION name(p type)', postgresql: 'CREATE FUNCTION name(p type)' },
      { oracle: 'RETURN type', mysql: 'RETURNS type', postgresql: 'RETURNS type' },
      { oracle: 'IS / AS', mysql: 'NOT DETERMINISTIC', postgresql: 'AS $$' },
      { oracle: 'IN / OUT / IN OUT', mysql: 'IN / OUT / INOUT', postgresql: 'IN / OUT / INOUT' },
      { oracle: 'DEFAULT value', mysql: 'DEFAULT value', postgresql: 'DEFAULT value' }
    ]
  },
  {
    title: '数据类型与变量',
    icon: 'var',
    items: [
      { oracle: 'v_name NUMBER;', mysql: 'DECLARE v_name INT;', postgresql: 'v_name NUMERIC;' },
      { oracle: 'v_name VARCHAR2(100);', mysql: 'DECLARE v_name VARCHAR(100)', postgresql: 'v_name VARCHAR(100);' },
      { oracle: 'v_name DATE;', mysql: 'DECLARE v_name DATETIME', postgresql: 'v_name TIMESTAMP;' },
      { oracle: 'v_name CONSTANT type := val', mysql: 'DECLARE v_name type DEFAULT val', postgresql: 'v_name CONSTANT type := val' },
      { oracle: '%TYPE, %ROWTYPE', mysql: '不支持', postgresql: '%TYPE, %ROWTYPE' }
    ]
  },
  {
    title: '控制流与返回',
    icon: 'flow',
    items: [
      { oracle: 'IF condition THEN ... END IF', mysql: 'IF condition THEN ... END IF', postgresql: 'IF condition THEN ... END IF' },
      { oracle: 'FOR i IN 1..n LOOP ... END LOOP', mysql: 'WHILE i <= n DO ... END WHILE', postgresql: 'FOR i IN 1..n LOOP ... END LOOP' },
      { oracle: 'RETURN value', mysql: 'RETURN value', postgresql: 'RETURN value' },
      { oracle: 'RETURN query SELECT', mysql: '不支持', postgresql: 'RETURN QUERY SELECT' },
      { oracle: 'EXCEPTION WHEN THEN', mysql: 'DECLARE CONTINUE HANDLER', postgresql: 'EXCEPTION WHEN THEN' }
    ]
  }
]

// 支持的函数操作
const supportedFuncs = [
  'CREATE FUNCTION',
  'DROP FUNCTION',
  '函数参数模式 (IN/OUT/INOUT)',
  '局部变量声明',
  'RETURN 语句',
  '异常处理',
  '支持双向转换'
]
</script>

<template>
  <div class="func-page">
    <!-- ==================== 页面顶栏 ==================== -->
    <header class="top-bar">
      <!-- 左侧：标题 -->
      <div class="top-bar-left">
        <h1 class="page-title">函数翻译</h1>
        <div class="page-subtitle">
          <span>CREATE FUNCTION</span>
          <span class="dot">·</span>
          <span>存储函数</span>
          <span class="dot">·</span>
          <span>标量函数</span>
        </div>
      </div>

      <!-- 中间：翻译方向选择器 -->
      <div class="top-bar-center">
        <div class="db-selector">
          <span class="db-badge oracle">ORA</span>
          <select
            :value="store.funcSourceDb"
            class="db-select"
            aria-label="选择源数据库"
            @change="
              store.pickDb('funcSourceDb', ($event.target as HTMLSelectElement).value as 'oracle' | 'mysql' | 'postgresql')
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

        <button
          class="swap-btn"
          title="交换源和目标数据库" aria-label="交换源和目标数据库"
          @click="swapDbs"
        >
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
            :value="store.funcTargetDb"
            class="db-select"
            aria-label="选择目标数据库"
            @change="
              store.pickDb('funcTargetDb', ($event.target as HTMLSelectElement).value as 'oracle' | 'mysql' | 'postgresql')
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
        <button class="icon-btn" title="更多选项" aria-label="更多选项">
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

        <button class="toolbar-btn" @click="handleUploadFile">
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
          <span class="line-count">{{ inputLineCount }} 行</span>
        </div>

        <div class="panel-content">
          <div v-if="!hasInput" class="empty-state" @click="loadSample">
            <span class="badge-ready">Ready for Source SQL</span>
            <h2 class="empty-title">从函数开始</h2>
            <p class="empty-desc">粘贴 CREATE FUNCTION 语句，或加载示例。</p>
            <p class="empty-tip">点击此处加载示例 SQL</p>
            <div class="empty-actions">
              <button class="btn-success" @click.stop="loadSample">
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
              <button class="btn-outline" @click.stop="handleUploadFile">上传 SQL</button>
            </div>
          </div>

          <textarea
            v-else
            v-model="store.funcInput"
            class="code-editor"
            placeholder="粘贴 CREATE FUNCTION 语句..."
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
            <span v-if="hasOutput" class="ai-verify-badge">AI 校验</span>
          </div>
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
            v-model="store.funcOutput"
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
          <span class="meta-value">{{ store.funcSourceLabel }} → {{ store.funcTargetLabel }}</span>
        </span>
        <span class="meta-divider"></span>
        <span class="meta-item">
          <span class="meta-label">引擎：</span>
          <span class="meta-value">Function Parser v1.0</span>
        </span>
        <span class="meta-divider"></span>
        <span class="meta-item">
          <span class="meta-label">用时：</span>
          <span class="meta-value">{{ translateTime }} 毫秒</span>
        </span>
      </div>
    </div>

    <!-- ==================== 类型映射参考 ==================== -->
    <div class="reference-panel">
      <!-- 折叠头部 -->
      <div class="reference-header">
        <div class="reference-header-left">
          <span class="reference-title">函数语法参考</span>
          <span class="reference-tag">Quick Reference</span>
        </div>
        <button class="reference-toggle-btn" @click="toggleReference">
          <span>{{ referenceCollapsed ? '展开' : '收起' }}</span>
          <svg
            class="toggle-arrow"
            :class="{ expanded: !referenceCollapsed }"
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M2.5 4.5L6 8L9.5 4.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>

      <!-- 展开内容 -->
      <Transition name="slide">
        <div v-if="!referenceCollapsed" class="reference-content">
          <!-- 三栏布局 -->
          <div class="mapping-columns">
            <div v-for="(col, colIndex) in funcSyntaxMappings" :key="colIndex" class="mapping-column">
              <!-- 栏标题 -->
              <div class="column-header">
                <svg
                  v-if="col.icon === 'func'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg
                  v-else-if="col.icon === 'var'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M4 7V4h16v3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M9 20h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M12 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <svg
                  v-else-if="col.icon === 'flow'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M9 10l-3 3 3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M20 4v7a4 4 0 0 1-4 4H4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="column-title">{{ col.title }}</span>
              </div>

              <!-- 列头 -->
              <div class="col-headers">
                <span class="col-header-item">Oracle</span>
                <span class="col-header-item">MySQL</span>
                <span class="col-header-item">PostgreSQL</span>
              </div>

              <!-- 类型映射行 -->
              <div class="mapping-rows">
                <div v-for="(item, itemIndex) in col.items" :key="itemIndex" class="mapping-row">
                  <span class="type-oracle">{{ item.oracle }}</span>
                  <span class="type-mysql">{{ item.mysql }}</span>
                  <span class="type-pg">{{ item.postgresql }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部注释 -->
          <div class="reference-footer">
            <span class="footer-label">支持操作：</span>
            <div class="footer-items">
              <span v-for="(op, opIndex) in supportedFuncs" :key="opIndex" class="footer-item">{{
                op
              }}</span>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- ==================== 版本号 ==================== -->
    <div class="version-tag">Version 2026.04.13 / 95a8f3c</div>
  </div>
</template>

<style scoped>
/* ==================== 全局字体 ==================== */
.func-page {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: var(--font-code);
}

/* ==================== 布局 ==================== */
.func-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-page-bg);
  color: var(--color-page-text);
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
  background: var(--color-page-bg);
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
  color: var(--color-page-text-subtle);
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
  background: var(--color-page-card);
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
  font-family: var(--font-code);
}

.db-badge.oracle {
  background: var(--color-page-oracle);
}

.db-badge.postgresql {
  background: var(--color-page-postgres);
}

.db-select {
  background: transparent;
  border: none;
  color: var(--color-page-text);
  font-size: 13px;
  cursor: pointer;
  outline: none;
  padding-right: 4px;
}

.db-select option {
  background: var(--color-page-card);
  color: var(--color-page-text);
}

.select-arrow {
  color: var(--color-page-text-subtle);
}

.swap-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--color-page-card);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all 0.15s;
}

.swap-btn:hover {
  color: var(--color-page-brand);
  border-color: var(--color-page-brand);
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.text-link {
  background: none;
  border: none;
  color: var(--color-page-text-subtle);
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
  background: var(--color-page-brand);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-page-brand-hover);
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
  font-family: var(--font-code);
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
  color: var(--color-page-text-subtle);
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
  color: var(--color-page-text-subtle);
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
  color: var(--color-page-danger);
}

.toolbar-btn.danger:hover:not(:disabled) {
  color: var(--color-page-oracle);
  background: rgba(239, 68, 68, 0.1);
}

.toolbar-btn.ai {
  color: var(--color-purple);
}

.toolbar-btn.ai:hover:not(:disabled) {
  color: var(--color-page-brand);
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
  background: var(--color-page-card);
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
  background: var(--color-page-bg);
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
  background: var(--color-page-oracle);
}

.db-dot.postgresql {
  background: var(--color-page-brand);
}

.ai-verify-badge {
  padding: 2px 8px;
  background: var(--color-purple);
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  margin-left: 8px;
  animation: pulse-glow 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4);
  }
  50% {
    box-shadow: 0 0 8px 2px rgba(139, 92, 246, 0.4);
  }
}

.empty-tip {
  font-size: 13px;
  color: var(--color-purple);
  margin: 0 0 24px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 12px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px dashed var(--color-purple);
  border-radius: 6px;
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
  color: var(--color-page-text-subtle);
}

.line-count {
  font-size: 12px;
  color: var(--color-page-text-subtle);
  font-family: var(--font-code);
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
  color: var(--color-page-success);
  font-size: 11px;
  font-weight: 500;
  margin-bottom: 20px;
}

.badge-preview {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(99, 102, 241, 0.15);
  border-radius: 20px;
  color: var(--color-purple);
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
  color: var(--color-page-text-subtle);
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
  color: var(--color-page-text-subtle);
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
  background: var(--color-page-success);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-success:hover {
  background: var(--color-page-success-hover);
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
  background: var(--color-page-brand);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-primary-outline:hover {
  background: var(--color-page-brand-hover);
}

/* ==================== 代码编辑器 ==================== */
.code-editor {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 16px;
  background: var(--color-page-card);
  border: none;
  color: var(--color-page-text);
  font-family: var(--font-code);
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
  background: var(--color-page-bg);
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
  background: var(--color-page-success);
}

.status-dot.converting {
  background: var(--color-page-warning);
}

.status-dot.success {
  background: var(--color-page-success);
}

.status-dot.error {
  background: var(--color-page-danger);
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
  color: var(--color-page-text-subtle);
}

.status-text.success {
  color: var(--color-page-success);
}

.status-text.error {
  color: var(--color-page-danger);
}

.status-text.converting {
  color: var(--color-page-warning);
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
  color: var(--color-page-text-muted);
}

.meta-value {
  color: var(--color-page-text-subtle);
  font-family: var(--font-code);
}

.meta-divider {
  width: 1px;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
}

/* ==================== 类型映射参考 ==================== */
.reference-panel {
  background: var(--color-page-bg);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.reference-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 40px;
  padding: 0 16px;
  background: var(--color-page-elevated);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.reference-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reference-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-page-text);
}

.reference-tag {
  font-size: 11px;
  color: var(--color-page-text-subtle);
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.reference-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: var(--color-page-text-subtle);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.reference-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-page-text);
}

.toggle-arrow {
  transition: transform 0.2s;
}

.toggle-arrow.expanded {
  transform: rotate(180deg);
}

.reference-content {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* ==================== 三栏布局 ==================== */
.mapping-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 0;
}

.mapping-column {
  background: var(--color-page-bg);
  padding: 0;
}

.column-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.column-icon {
  color: var(--color-page-link);
}

.column-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-page-link);
}

.col-headers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.col-header-item {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-text);
}

.mapping-rows {
  padding: 4px 0;
}

.mapping-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 6px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.15s;
}

.mapping-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.mapping-row:last-child {
  border-bottom: none;
}

.type-oracle {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-warning);
}

.type-mysql {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-success);
}

.type-pg {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-chat-accent);
}

.reference-footer {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.footer-label {
  font-size: 11px;
  color: var(--color-page-text-subtle);
  white-space: nowrap;
  padding-top: 2px;
}

.footer-items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.footer-item {
  font-size: 10px;
  font-family: var(--font-code);
  color: var(--color-page-text-subtle);
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  max-height: 500px;
}

.version-tag {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 10px;
  color: var(--color-page-text-muted);
  font-family: var(--font-code);
}
</style>
