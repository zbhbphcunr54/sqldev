<script setup lang="ts">
/**
 * DDL 语句翻译页面
 *
 * 设计规范：
 * - 深色主题，五层布局
 * - 顶栏：标题 + 数据库选择器 + 操作按钮
 * - 工具栏：加载示例、上传文件、复制输出、保存文件、清空
 * - 双面板编辑器：Oracle 输入 / PostgreSQL 输出
 * - 状态栏：工作状态 + 翻译元信息
 * - 类型映射参考：可折叠面板
 */
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'
import { requestConvert } from '@/api/convert'
import { requestConvertVerify } from '@/api/convert-verify'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { useClipboard } from '@/composables/useClipboard'

const store = useWorkbenchStore()
const router = useRouter()
const { copyToClipboard } = useClipboard()

// ==================== 示例 DDL ====================

const SAMPLE_DDL = `-- 电商订单系统核心表结构
-- 订单主表
CREATE TABLE orders (
  order_id NUMBER(20) NOT NULL,
  order_no VARCHAR2(32) NOT NULL,
  customer_id NUMBER(20) NOT NULL,
  merchant_id NUMBER(20) NOT NULL,
  order_status NUMBER(2) DEFAULT 0,
  payment_status NUMBER(2) DEFAULT 0,
  shipping_status NUMBER(2) DEFAULT 0,
  order_amount NUMBER(12,2) NOT NULL,
  discount_amount NUMBER(12,2) DEFAULT 0,
  coupon_amount NUMBER(12,2) DEFAULT 0,
  freight_amount NUMBER(10,2) DEFAULT 0,
  total_amount NUMBER(12,2) NOT NULL,
  payment_amount NUMBER(12,2),
  payment_method VARCHAR2(20),
  payment_time TIMESTAMP,
  shipping_time TIMESTAMP,
  receive_time TIMESTAMP,
  receiver_name VARCHAR2(100),
  receiver_phone VARCHAR2(20),
  receiver_province VARCHAR2(50),
  receiver_city VARCHAR2(50),
  receiver_district VARCHAR2(50),
  receiver_address VARCHAR2(500),
  buyer_remark VARCHAR2(500),
  seller_remark VARCHAR2(500),
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  is_deleted NUMBER(1) DEFAULT 0,
  version NUMBER(10) DEFAULT 0,
  CONSTRAINT pk_orders PRIMARY KEY (order_id),
  CONSTRAINT uk_orders_order_no UNIQUE (order_no)
);

COMMENT ON TABLE orders IS '订单主表';
COMMENT ON COLUMN orders.order_id IS '订单ID';
COMMENT ON COLUMN orders.order_no IS '订单编号';
COMMENT ON COLUMN orders.customer_id IS '客户ID';
COMMENT ON COLUMN orders.merchant_id IS '商户ID';
COMMENT ON COLUMN orders.order_status IS '订单状态:0-待付款,1-已付款,2-已发货,3-已收货,4-已完成,5-已取消,6-已退款';
COMMENT ON COLUMN orders.total_amount IS '订单总金额';

-- 订单明细表
CREATE TABLE order_items (
  item_id NUMBER(20) NOT NULL,
  order_id NUMBER(20) NOT NULL,
  product_id NUMBER(20) NOT NULL,
  sku_id NUMBER(20),
  product_name VARCHAR2(200) NOT NULL,
  sku_name VARCHAR2(200),
  product_image VARCHAR2(500),
  original_price NUMBER(12,2) NOT NULL,
  unit_price NUMBER(12,2) NOT NULL,
  quantity NUMBER(8) NOT NULL DEFAULT 1,
  discount_amount NUMBER(12,2) DEFAULT 0,
  item_amount NUMBER(12,2) NOT NULL,
  is_gift NUMBER(1) DEFAULT 0,
  create_time TIMESTAMP DEFAULT SYSTIMESTAMP,
  update_time TIMESTAMP,
  CONSTRAINT pk_order_items PRIMARY KEY (item_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- 创建索引
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_merchant ON orders(merchant_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_create_time ON orders(create_time);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);`

// ==================== 状态 ====================

const referenceCollapsed = ref(false)
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

const hasInput = computed(() => !!store.inputDdl.trim())
const hasOutput = computed(() => !!store.outputDdl.trim())
const isConverting = computed(() => store.ddlConverting)

const statusText = computed(() => {
  if (isConverting.value) return '翻译中...'
  if (store.ddlStatusText) return store.ddlStatusText
  return '工作台已就绪'
})

const statusClass = computed(() => {
  if (isConverting.value) return 'converting'
  if (store.ddlStatusText?.includes('失败')) return 'error'
  if (hasOutput.value) return 'success'
  return 'ready'
})

const showMetaInfo = computed(() => hasOutput.value && translateTime.value !== null)

// ==================== 方法 ====================

/** 加载示例 */
function loadSample(): void {
  store.inputDdl = SAMPLE_DDL
  store.outputDdl = ''
  store.ddlStatusText = ''
  translateTime.value = null
}

/** 清空 */
function clearAll(): void {
  store.inputDdl = ''
  store.outputDdl = ''
  store.ddlStatusText = ''
  translateTime.value = null
}

/** 上传文件 */
function handleUploadFile(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.sql,.ddl,.txt'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      store.inputDdl = text
      store.outputDdl = ''
      store.ddlStatusText = `已加载文件: ${file.name}`
    } catch {
      store.showAlert('错误', '文件读取失败')
    }
  }
  input.click()
}

/** 复制输出 */
async function copyOutput(): Promise<void> {
  if (!store.outputDdl) return
  isCopying.value = true
  const success = await copyToClipboard(store.outputDdl)
  if (success) {
    copySuccess.value = true
    store.ddlStatusText = '已复制到剪贴板'
    setTimeout(() => {
      copySuccess.value = false
    }, 2000)
  }
  isCopying.value = false
}

/** 交换数据库 */
function swapDbs(): void {
  store.swapDbs()
}

/** AI 校验 */
async function aiVerify(): Promise<void> {
  if (!store.outputDdl) {
    store.showAlert('提示', '请先进行翻译后再使用 AI 校验')
    return
  }

  store.ddlConverting = true
  store.ddlStatusText = 'AI 校验中...'

  try {
    const result = await requestConvertVerify({
      kind: 'ddl',
      fromDb: store.sourceDb as 'oracle' | 'mysql' | 'postgresql',
      toDb: store.targetDb as 'oracle' | 'mysql' | 'postgresql',
      inputSql: store.inputDdl,
      outputSql: store.outputDdl
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
      store.ddlStatusText = `校验完成 - ${summary}`
      store.showAlert('AI 校验完成', summary)
    } else {
      store.ddlStatusText = '校验失败'
      store.showAlert('校验失败', mapErrorCodeToMessage(result.error || 'verify_failed'))
    }
  } catch (error) {
    store.ddlStatusText = '校验失败'
    store.showAlert('校验失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.ddlConverting = false
  }
}

/** 开始翻译 */
async function handleConvert(): Promise<void> {
  if (!store.inputDdl.trim()) {
    store.showAlert('提示', '请输入要翻译的 DDL 语句')
    return
  }

  const startTime = Date.now()
  store.ddlConverting = true
  store.ddlStatusText = '正在翻译...'

  try {
    const result = await requestConvert({
      sourceDialect: store.sourceDb,
      targetDialect: store.targetDb,
      sql: store.inputDdl,
      kind: 'ddl'
    })

    translateTime.value = Date.now() - startTime

    if (result.ok) {
      store.outputDdl = result.outputSql || ''
      store.ddlStatusText = result.cached ? '翻译完成（缓存）' : '翻译完成'
    } else {
      store.outputDdl = ''
      store.ddlStatusText = '翻译失败'
      store.showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
    }
  } catch (error) {
    store.outputDdl = ''
    store.ddlStatusText = '翻译失败'
    store.showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.ddlConverting = false
  }
}

/** 切换类型映射参考 */
function toggleReference(): void {
  referenceCollapsed.value = !referenceCollapsed.value
}

/** 键盘快捷键 */
function handleKeydown(e: KeyboardEvent): void {
  // Ctrl+Enter 或 Cmd+Enter 触发翻译
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

// 类型映射数据：三个分栏（数值类型、字符与日期、二进制与特殊）
const typeMappings = [
  {
    title: '数值类型',
    icon: 'hash',
    items: [
      { oracle: 'NUMBER(p,s)', mysql: 'DECIMAL(p,s)', postgresql: 'DECIMAL(p,s)' },
      { oracle: 'NUMBER(p)', mysql: 'DECIMAL(p)', postgresql: 'DECIMAL(p)' },
      { oracle: 'NUMBER', mysql: 'INT / BIGINT', postgresql: 'NUMERIC' },
      { oracle: 'INTEGER / INT', mysql: 'INTEGER', postgresql: 'INTEGER' },
      { oracle: 'BINARY_FLOAT', mysql: 'FLOAT', postgresql: 'REAL' },
      { oracle: 'BINARY_DOUBLE', mysql: 'DOUBLE', postgresql: 'DOUBLE PRECISION' }
    ]
  },
  {
    title: '字符与日期',
    icon: 'text',
    items: [
      { oracle: 'VARCHAR2(n)', mysql: 'VARCHAR(n)', postgresql: 'VARCHAR(n)' },
      { oracle: 'CHAR(n)', mysql: 'CHAR(n)', postgresql: 'CHAR(n)' },
      { oracle: 'NVARCHAR2(n)', mysql: 'NVARCHAR(n)', postgresql: 'VARCHAR(n)' },
      { oracle: 'CLOB', mysql: 'LONGTEXT', postgresql: 'TEXT' },
      { oracle: 'DATE', mysql: 'DATETIME', postgresql: 'TIMESTAMP' },
      { oracle: 'TIMESTAMP', mysql: 'DATETIME(6)', postgresql: 'TIMESTAMP(6)' }
    ]
  },
  {
    title: '二进制与特殊',
    icon: 'binary',
    items: [
      { oracle: 'BLOB', mysql: 'LONGBLOB', postgresql: 'BYTEA' },
      { oracle: 'RAW(n)', mysql: 'VARBINARY(n)', postgresql: 'BYTEA' },
      { oracle: 'LONG', mysql: 'LONGTEXT', postgresql: 'TEXT' },
      { oracle: 'BOOLEAN', mysql: 'TINYINT(1)', postgresql: 'BOOLEAN' },
      { oracle: 'SYSDATE', mysql: 'NOW()', postgresql: 'NOW()' },
      { oracle: 'SYSTIMESTAMP', mysql: 'NOW(6)', postgresql: 'NOW()' }
    ]
  }
]

// 支持的 DDL 操作说明
const supportedDdl = [
  'CREATE TABLE',
  'COMMENT ON',
  'CREATE INDEX / UNIQUE INDEX',
  'PRIMARY KEY',
  'FOREIGN KEY',
  'PARTITION BY RANGE / LIST / HASH',
  '支持双向转换'
]
</script>

<template>
  <div class="ddl-page">
    <!-- ==================== 页面顶栏 ==================== -->
    <header class="top-bar">
      <!-- 左侧：标题 -->
      <div class="top-bar-left">
        <h1 class="page-title">DDL 语句翻译</h1>
        <div class="page-subtitle">
          <span>建表</span>
          <span class="dot">·</span>
          <span>注释</span>
          <span class="dot">·</span>
          <span>索引</span>
          <span class="dot">·</span>
          <span>主键</span>
          <span class="dot">·</span>
          <span>外键</span>
          <span class="dot">·</span>
          <span>分区</span>
        </div>
      </div>

      <!-- 中间：翻译方向选择器 -->
      <div class="top-bar-center">
        <!-- 源数据库 -->
        <div class="db-selector">
          <span class="db-badge oracle">ORA</span>
          <select
            :value="store.sourceDb"
            class="db-select"
            aria-label="选择源数据库"
            @change="store.pickDb('sourceDb', ($event.target as HTMLSelectElement).value as any)"
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

        <!-- 交换按钮 -->
        <button
          class="swap-btn"
          title="交换源和目标数据库"
          aria-label="交换源和目标数据库"
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

        <!-- 目标数据库 -->
        <div class="db-selector">
          <span class="db-badge postgresql">PG</span>
          <select
            :value="store.targetDb"
            class="db-select"
            aria-label="选择目标数据库"
            @change="store.pickDb('targetDb', ($event.target as HTMLSelectElement).value as any)"
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
      <!-- 左侧按钮 -->
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

      <!-- 右侧按钮 -->
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
      <!-- 左面板：Oracle 输入 -->
      <div class="panel">
        <!-- 面板头部 -->
        <div class="panel-header">
          <div class="panel-title">
            <span class="db-dot oracle"></span>
            <span>Oracle 输入</span>
          </div>
          <span class="line-count">{{ store.inputLineCount }} 行</span>
        </div>

        <!-- 面板内容 -->
        <div class="panel-content">
          <!-- 空状态 -->
          <div v-if="!hasInput" class="empty-state" @click="loadSample">
            <span class="badge-ready">Ready for Source SQL</span>
            <h2 class="empty-title">从 Oracle DDL 开始</h2>
            <p class="empty-desc">
              先贴入建表语句，或直接加载示例。我们会保留字段、索引、注释和分区结构。
            </p>
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
              <button class="btn-outline" @click.stop="handleUploadFile">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2H12V10L8 14H2V2Z"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M8 2V6H12"
                    stroke="currentColor"
                    stroke-width="1.3"
                    stroke-linejoin="round"
                  />
                </svg>
                上传 SQL
              </button>
            </div>
          </div>

          <!-- 编辑器 -->
          <textarea
            v-else
            v-model="store.inputDdl"
            class="code-editor"
            placeholder="粘贴 CREATE TABLE 语句..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- 竖线分隔 -->
      <div class="panel-divider"></div>

      <!-- 右面板：PostgreSQL 输出 -->
      <div class="panel">
        <!-- 面板头部 -->
        <div class="panel-header">
          <div class="panel-title">
            <span class="db-dot postgresql"></span>
            <span>PostgreSQL 输出</span>
            <span v-if="hasOutput" class="ai-verify-badge">AI 校验</span>
          </div>
        </div>

        <!-- 面板内容 -->
        <div class="panel-content">
          <!-- 空状态 -->
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

          <!-- 编辑器 -->
          <textarea
            v-else
            v-model="store.outputDdl"
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
          <span class="meta-value">{{ store.sourceLabel }} → {{ store.targetLabel }}</span>
        </span>
        <span class="meta-divider"></span>
        <span class="meta-item">
          <span class="meta-label">引擎：</span>
          <span class="meta-value">DDL Parser v2.0</span>
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
          <span class="reference-title">类型映射参考</span>
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
            <div v-for="(col, colIndex) in typeMappings" :key="colIndex" class="mapping-column">
              <!-- 栏标题 -->
              <div class="column-header">
                <!-- 图标 -->
                <svg
                  v-if="col.icon === 'hash'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M4 9H20M4 15H20M10 3L8 21M16 3L14 21"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                <svg
                  v-else-if="col.icon === 'text'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M4 7V4H20V7M9 20H15M12 4V20"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg
                  v-else-if="col.icon === 'binary'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <path
                    d="M9 9V15M12 9V15M15 9V15"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
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
              <span v-for="(op, opIndex) in supportedDdl" :key="opIndex" class="footer-item">{{
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
.ddl-page {
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ==================== 布局 ==================== */
.ddl-page {
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
  padding: 0 24px;
  background: var(--color-page-bg);
  border-bottom: 1px solid var(--color-page-border);
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
  color: var(--color-page-text);
  letter-spacing: -0.02em;
  margin: 0;
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--color-page-text-subtle);
  letter-spacing: 0.01em;
}

.page-subtitle .dot {
  opacity: 0.4;
}

.top-bar-center {
  display: flex;
  align-items: center;
  gap: 16px;
}

.db-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--color-page-card);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-page-border);
  transition: all var(--duration-fast) var(--ease-apple);
}

.db-selector:hover {
  border-color: var(--color-page-border-hover);
}

.db-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 24px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  font-family: var(--font-code);
  letter-spacing: -0.01em;
}

.db-badge.oracle {
  background: var(--oracle);
}

.db-badge.postgresql {
  background: var(--pg);
}

.db-select {
  background: transparent;
  border: none;
  color: var(--color-page-text);
  font-size: 13px;
  font-weight: 500;
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
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid var(--color-page-border);
  background: var(--color-page-card);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.swap-btn:hover {
  color: var(--color-page-brand);
  border-color: var(--color-page-brand);
  transform: rotate(180deg);
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
  font-weight: 500;
  cursor: pointer;
  transition: color var(--duration-fast) var(--ease-apple);
  padding: 8px 12px;
  border-radius: var(--radius-pill);
}

.text-link:hover {
  color: var(--color-page-text);
  background: var(--color-page-border-light);
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--color-page-brand);
  border: none;
  border-radius: var(--radius-pill);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
  box-shadow: var(--shadow-xs);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-page-brand-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shortcut {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 10px;
  font-family: var(--font-code);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: var(--radius-pill);
  border: none;
  background: transparent;
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.icon-btn:hover {
  background: var(--color-page-border-light);
  color: var(--color-page-text);
}

/* ==================== 工具栏 ==================== */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 20px;
  background: transparent;
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: var(--radius-pill);
  color: var(--color-page-text-subtle);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.toolbar-btn:hover:not(:disabled) {
  color: var(--color-page-text);
  background: var(--color-page-border-light);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn.danger {
  color: var(--color-page-danger);
}

.toolbar-btn.danger:hover:not(:disabled) {
  color: var(--color-page-danger);
  background: var(--color-danger-bg);
}

.toolbar-btn.ai {
  color: var(--color-purple);
}

.toolbar-btn.ai:hover:not(:disabled) {
  color: var(--color-purple);
  background: var(--color-purple-bg);
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--color-page-border);
  margin: 0 6px;
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
  background: var(--color-page-border);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 20px;
  background: var(--color-page-bg);
  border-bottom: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.db-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.db-dot.oracle {
  background: var(--oracle);
}

.db-dot.postgresql {
  background: var(--pg);
}

.ai-verify-badge {
  padding: 3px 10px;
  background: var(--color-purple);
  border-radius: var(--radius-pill);
  font-size: 10px;
  font-weight: 600;
  color: #fff;
  margin-left: 8px;
  letter-spacing: 0.02em;
}

.panel-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.hint-tag {
  padding: 3px 10px;
  background: var(--color-page-border-light);
  border-radius: var(--radius-pill);
  font-size: 11px;
  color: var(--color-page-text-subtle);
}

.line-count {
  font-size: 12px;
  color: var(--color-page-text-subtle);
  font-family: var(--font-code);
  letter-spacing: -0.01em;
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
  padding: 48px 40px;
  text-align: center;
}

.empty-state.right {
  /* 右面板空状态样式 */
}

.badge-ready {
  display: inline-block;
  padding: 6px 14px;
  background: var(--color-success-bg);
  border-radius: var(--radius-pill);
  color: var(--color-success);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 24px;
}

.badge-preview {
  display: inline-block;
  padding: 6px 14px;
  background: var(--color-accent-bg);
  border-radius: var(--radius-pill);
  color: var(--color-accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 24px;
}

.empty-title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-page-text);
  letter-spacing: -0.03em;
  margin: 0 0 16px;
}

.empty-title.right {
  font-size: 28px;
}

.empty-desc {
  max-width: 420px;
  font-size: 14px;
  color: var(--color-page-text-subtle);
  line-height: 1.7;
  margin: 0 0 12px;
}

.empty-tip {
  font-size: 13px;
  color: var(--color-purple);
  margin: 0 0 28px;
  font-weight: 500;
  cursor: pointer;
  padding: 8px 16px;
  background: var(--color-purple-bg);
  border: 1px dashed var(--color-purple);
  border-radius: var(--radius-md);
}

.steps {
  display: flex;
  gap: 28px;
  margin-bottom: 28px;
}

.step {
  font-size: 12px;
  color: var(--color-page-text-subtle);
  font-weight: 500;
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
  background: var(--color-success);
  border: none;
  border-radius: var(--radius-pill);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.btn-success:hover {
  background: var(--color-success-hover, #2db551);
  transform: translateY(-1px);
}

.btn-outline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  background: transparent;
  border: 1.5px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  color: var(--color-page-text);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.btn-outline:hover {
  border-color: var(--color-page-border-hover);
  background: var(--color-page-border-light);
}

.btn-primary-outline {
  padding: 10px 20px;
  background: var(--color-page-brand);
  border: none;
  border-radius: var(--radius-pill);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.btn-primary-outline:hover {
  background: var(--color-page-brand-hover);
  transform: translateY(-1px);
}

/* ==================== 代码编辑器 ==================== */
.code-editor {
  flex: 1;
  width: 100%;
  height: 100%;
  padding: 20px;
  background: var(--color-page-card);
  border: none;
  color: var(--color-page-text);
  font-family: var(--font-code);
  font-size: 13px;
  line-height: 1.7;
  resize: none;
  outline: none;
  letter-spacing: -0.01em;
}

.code-editor::placeholder {
  color: var(--color-page-text-muted);
}

/* ==================== 状态栏 ==================== */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 20px;
  background: var(--color-page-bg);
  border-top: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.ready {
  background: var(--color-page-success);
}

.status-dot.converting {
  background: var(--color-page-warning);
  animation: pulse 1.5s ease-in-out infinite;
}

.status-dot.success {
  background: var(--color-page-success);
}

.status-dot.error {
  background: var(--color-page-danger);
  animation: none;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.2);
  }
}

.status-text {
  font-size: 12px;
  color: var(--color-page-text-subtle);
  font-weight: 500;
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
  gap: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}

.meta-label {
  color: var(--color-page-text-muted);
}

.meta-value {
  color: var(--color-page-text-subtle);
  font-family: var(--font-code);
  letter-spacing: -0.01em;
}

.meta-divider {
  width: 1px;
  height: 12px;
  background: var(--color-page-border);
}

/* ==================== 类型映射参考 ==================== */
.reference-panel {
  background: var(--color-page-bg);
  border-top: 1px solid var(--color-page-border);
  flex-shrink: 0;
}

.reference-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 44px;
  padding: 0 20px;
  background: var(--color-page-elevated);
  border-bottom: 1px solid var(--color-page-border-subtle);
}

.reference-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.reference-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-page-text);
  letter-spacing: -0.01em;
}

.reference-tag {
  font-size: 11px;
  color: var(--color-page-text-subtle);
  padding: 4px 10px;
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  letter-spacing: 0.02em;
}

.reference-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--color-page-border-light);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  color: var(--color-page-text-subtle);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.reference-toggle-btn:hover {
  background: var(--color-page-border);
  color: var(--color-page-text);
}

.toggle-arrow {
  transition: transform var(--duration-normal) var(--ease-out);
}

.toggle-arrow.expanded {
  transform: rotate(180deg);
}

.reference-content {
  border-top: 1px solid var(--color-page-border-subtle);
}

/* ==================== 三栏布局 ==================== */
.mapping-columns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: var(--color-page-border-subtle);
  margin: 0;
}

/* 每个分栏 */
.mapping-column {
  background: var(--color-page-bg);
  padding: 0;
}

/* 栏标题 */
.column-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--color-page-border-subtle);
}

.column-icon {
  color: var(--color-page-link);
}

.column-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-page-link);
  letter-spacing: -0.01em;
}

/* 列头（Oracle / MySQL / PostgreSQL） */
.col-headers {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 10px 20px;
  background: var(--color-page-border-subtle);
  border-bottom: 1px solid var(--color-page-border-subtle);
}

.col-header-item {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-page-text);
  letter-spacing: 0.02em;
}

/* 类型映射行 */
.mapping-rows {
  padding: 4px 0;
}

.mapping-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  padding: 8px 20px;
  border-bottom: 1px solid var(--color-page-border-subtle);
  transition: background var(--duration-fast) var(--ease-apple);
}

.mapping-row:hover {
  background: var(--color-page-border-light);
}

.mapping-row:last-child {
  border-bottom: none;
}

/* 各数据库类型颜色 */
.type-oracle {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-page-warning-alt);
  letter-spacing: -0.01em;
}

.type-mysql {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-page-success-alt);
  letter-spacing: -0.01em;
}

.type-pg {
  font-family: var(--font-code);
  font-size: 11px;
  color: var(--color-page-link);
  letter-spacing: -0.01em;
}

/* ==================== 底部注释 ==================== */
.reference-footer {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 20px;
  background: var(--color-page-border-subtle);
  border-top: 1px solid var(--color-page-border-subtle);
}

.footer-label {
  font-size: 11px;
  color: var(--color-page-text-subtle);
  white-space: nowrap;
  padding-top: 4px;
  font-weight: 500;
}

.footer-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.footer-item {
  font-size: 10px;
  font-family: var(--font-code);
  color: var(--color-page-text-subtle);
  padding: 4px 10px;
  background: var(--color-page-border-light);
  border: 1px solid var(--color-page-border);
  border-radius: var(--radius-pill);
  letter-spacing: -0.01em;
}

/* ==================== 折叠动画 ==================== */
.slide-enter-active,
.slide-leave-active {
  transition: all var(--duration-normal) var(--ease-out);
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

/* ==================== 版本号 ==================== */
.version-tag {
  position: absolute;
  bottom: 8px;
  right: 16px;
  font-size: 10px;
  color: var(--color-page-text-muted);
  font-family: var(--font-code);
  letter-spacing: -0.01em;
}
</style>
