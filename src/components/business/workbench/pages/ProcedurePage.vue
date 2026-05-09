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
import { requestConvertVerify } from '@/api/convert-verify'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { useClipboard } from '@/composables/useClipboard'

const store = useWorkbenchStore()
const router = useRouter()
const { copyToClipboard } = useClipboard()

// ==================== 示例 SQL ====================

const SAMPLE_PROC = `-- 处理订单支付并扣减库存存储过程
CREATE OR REPLACE PROCEDURE process_order_payment(
  p_order_id IN NUMBER,
  p_payment_method IN VARCHAR2,
  p_transaction_no IN VARCHAR2,
  p_result OUT NUMBER,
  p_message OUT VARCHAR2
)
IS
  v_order_status NUMBER(2);
  v_customer_id NUMBER(20);
  v_total_amount NUMBER(12,2);
  v_payment_amount NUMBER(12,2);
  v_points_to_add NUMBER(10);
  v_lock_timeout NUMBER(1) := 0;
  e_order_locked EXCEPTION;
  e_insufficient_stock EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_order_locked, -20001);
  PRAGMA EXCEPTION_INIT(e_insufficient_stock, -20002);
BEGIN
  -- 验证订单状态
  SELECT order_status, customer_id, total_amount, payment_amount
  INTO v_order_status, v_customer_id, v_total_amount, v_payment_amount
  FROM orders
  WHERE order_id = p_order_id
  FOR UPDATE WAIT 10;

  -- 检查订单状态是否为待付款
  IF v_order_status != 0 THEN
    p_result := -1;
    p_message := '订单状态不允许支付';
    RETURN;
  END IF;

  -- 创建支付记录
  INSERT INTO payment_records (
    payment_id, order_id, payment_method, transaction_no,
    payment_amount, payment_time, status, create_time
  ) VALUES (
    payment_seq.NEXTVAL, p_order_id, p_payment_method, p_transaction_no,
    NVL(v_payment_amount, v_total_amount), SYSTIMESTAMP, 'SUCCESS', SYSTIMESTAMP
  );

  -- 更新订单状态为已付款
  UPDATE orders
  SET order_status = 1,
      payment_status = 1,
      payment_method = p_payment_method,
      payment_time = SYSTIMESTAMP,
      update_time = SYSTIMESTAMP,
      version = version + 1
  WHERE order_id = p_order_id
    AND version = (SELECT version FROM orders WHERE order_id = p_order_id);

  -- 扣减库存（乐观锁）
  FOR item_rec IN (
    SELECT oi.product_id, oi.sku_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  ) LOOP
    UPDATE product_stock ps
    SET ps.stock_quantity = ps.stock_quantity - item_rec.quantity,
        ps.reserved_quantity = ps.reserved_quantity - item_rec.quantity,
        ps.update_time = SYSTIMESTAMP
    WHERE ps.product_id = item_rec.product_id
      AND ps.sku_id = item_rec.sku_id
      AND ps.stock_quantity >= item_rec.quantity;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE e_insufficient_stock;
    END IF;
  END LOOP;

  -- 增加客户积分（每消费1元得1积分）
  v_points_to_add := FLOOR(NVL(v_payment_amount, v_total_amount));
  INSERT INTO customer_points (
    point_id, customer_id, points, points_type,
    related_order_id, earn_time, expire_time, status
  ) VALUES (
    points_seq.NEXTVAL, v_customer_id, v_points_to_add, 'ORDER',
    p_order_id, SYSTIMESTAMP, ADD_MONTHS(SYSTIMESTAMP, 24), 'AVAILABLE'
  );

  -- 发送支付成功通知（异步）
  DBMS_AQ.ENQUEUE(
    queue_name => 'ORDER_NOTIFICATIONS',
    payload => JSON_OBJECT(
      'order_id' VALUE p_order_id,
      'customer_id' VALUE v_customer_id,
      'event_type' VALUE 'PAYMENT_SUCCESS',
      'amount' VALUE v_payment_amount
    )
  );

  COMMIT;
  p_result := 0;
  p_message := '支付处理成功';

EXCEPTION
  WHEN e_order_locked THEN
    ROLLBACK;
    p_result := -2;
    p_message := '订单被锁定，请稍后重试';

  WHEN e_insufficient_stock THEN
    ROLLBACK;
    p_result := -3;
    p_message := '库存不足，支付失败';

  WHEN OTHERS THEN
    ROLLBACK;
    p_result := -99;
    p_message := '系统错误: ' || SQLERRM;
END process_order_payment;`

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
      store.procInput = text
      store.procOutput = ''
      store.procStatus = 'idle'
    } catch {
      store.showAlert('错误', '文件读取失败')
    }
  }
  input.click()
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
async function aiVerify(): Promise<void> {
  if (!store.procOutput) {
    store.showAlert('提示', '请先进行翻译后再使用 AI 校验')
    return
  }

  store.procConverting = true
  store.procStatusText = 'AI 校验中...'

  try {
    const result = await requestConvertVerify({
      kind: 'proc',
      fromDb: store.procSourceDb as 'oracle' | 'mysql' | 'postgresql',
      toDb: store.procTargetDb as 'oracle' | 'mysql' | 'postgresql',
      inputSql: store.procInput,
      outputSql: store.procOutput
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
      store.procStatusText = `校验完成 - ${summary}`
      store.showAlert('AI 校验完成', summary)
    } else {
      store.procStatusText = '校验失败'
      store.showAlert('校验失败', mapErrorCodeToMessage(result.error || 'verify_failed'))
    }
  } catch (error) {
    store.procStatusText = '校验失败'
    store.showAlert('校验失败', mapErrorCodeToMessage(String(error)))
  } finally {
    store.procConverting = false
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

// 存储过程语法映射数据
const procSyntaxMappings = [
  {
    title: '过程声明与参数',
    icon: 'proc',
    items: [
      { oracle: 'CREATE PROCEDURE name(p IN type)', mysql: 'CREATE PROCEDURE name(IN p type)', postgresql: 'CREATE OR REPLACE PROCEDURE name(p IN type)' },
      { oracle: 'OUT parameter', mysql: 'OUT parameter', postgresql: 'OUT parameter' },
      { oracle: 'IN OUT parameter', mysql: 'INOUT parameter', postgresql: 'INOUT parameter' },
      { oracle: 'IS / AS', mysql: '无对应', postgresql: 'AS $$' },
      { oracle: 'PRAGMA AUTONOMOUS_TRANSACTION', mysql: '不支持', postgresql: '不支持（需扩展）' }
    ]
  },
  {
    title: '事务控制',
    icon: 'tx',
    items: [
      { oracle: 'COMMIT', mysql: 'COMMIT', postgresql: 'COMMIT' },
      { oracle: 'ROLLBACK', mysql: 'ROLLBACK', postgresql: 'ROLLBACK' },
      { oracle: 'SAVEPOINT name', mysql: '不支持', postgresql: 'SAVEPOINT name' },
      { oracle: 'ROLLBACK TO SAVEPOINT', mysql: '不支持', postgresql: 'ROLLBACK TO SAVEPOINT' },
      { oracle: 'FOR UPDATE NOWAIT', mysql: 'FOR UPDATE', postgresql: 'FOR UPDATE NOWAIT' }
    ]
  },
  {
    title: '游标与异常',
    icon: 'cursor',
    items: [
      { oracle: 'CURSOR name IS SELECT', mysql: 'DECLARE CURSOR', postgresql: 'DECLARE CURSOR' },
      { oracle: 'OPEN/FETCH/CLOSE', mysql: 'OPEN/FETCH/CLOSE', postgresql: 'OPEN/FETCH/CLOSE' },
      { oracle: 'FOR rec IN cur LOOP', mysql: 'WHILE DO + FETCH', postgresql: 'FOR rec IN cur LOOP' },
      { oracle: 'RAISE_APPLICATION_ERROR', mysql: 'SIGNAL / RESIGNAL', postgresql: 'RAISE' },
      { oracle: 'PRAGMA EXCEPTION_INIT', mysql: '不支持', postgresql: 'GET DIAGNOSTICS' }
    ]
  }
]

// 支持的存储过程操作
const supportedProcs = [
  'CREATE PROCEDURE',
  'DROP PROCEDURE',
  'IN / OUT / INOUT 参数',
  '事务控制 (COMMIT/ROLLBACK)',
  '游标操作',
  '异常处理',
  '支持双向转换'
]
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
            aria-label="选择源数据库"
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

        <div class="db-selector">
          <span class="db-badge postgresql">PG</span>
          <select
            :value="store.procTargetDb"
            class="db-select"
            aria-label="选择目标数据库"
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
            <h2 class="empty-title">从存储过程开始</h2>
            <p class="empty-desc">粘贴 CREATE PROCEDURE 语句，或加载示例。</p>
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

    <!-- ==================== 类型映射参考 ==================== -->
    <div class="reference-panel">
      <!-- 折叠头部 -->
      <div class="reference-header">
        <div class="reference-header-left">
          <span class="reference-title">存储过程语法参考</span>
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
            <div v-for="(col, colIndex) in procSyntaxMappings" :key="colIndex" class="mapping-column">
              <!-- 栏标题 -->
              <div class="column-header">
                <svg
                  v-if="col.icon === 'proc'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M9 9l6 0M9 12l6 0M9 15l4 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg
                  v-else-if="col.icon === 'tx'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg
                  v-else-if="col.icon === 'cursor'"
                  class="column-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                  <path d="M4 9h16M9 9v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
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
              <span v-for="(op, opIndex) in supportedProcs" :key="opIndex" class="footer-item">{{
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
.proc-page {
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: var(--font-code);
}

/* ==================== 布局 ==================== */
.proc-page {
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
  color: #f59e0b;
}

.type-mysql {
  font-family: var(--font-code);
  font-size: 11px;
  color: #10b981;
}

.type-pg {
  font-family: var(--font-code);
  font-size: 11px;
  color: #6366f1;
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
