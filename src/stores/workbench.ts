// [2026-05-03] 新增：工作台状态管理（Pinia）
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { requestConvert } from '@/api/convert'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export type WorkbenchPage =
  | 'ddl'
  | 'func'
  | 'proc'
  | 'idTool'
  | 'ziweiTool'
  | 'rules'
  | 'aiConfig'
  | 'appConfig'
  | 'opLogs'
export type Database = 'oracle' | 'mysql' | 'postgresql'
export type TranslateStatus = 'idle' | 'loading' | 'success' | 'error'

const NAV_PAGES: WorkbenchPage[] = [
  'ddl',
  'func',
  'proc',
  'idTool',
  'ziweiTool',
  'rules',
  'aiConfig',
  'appConfig',
  'opLogs'
]

const DB_OPTIONS: { value: Database; label: string; abbr: string }[] = [
  { value: 'oracle', label: 'Oracle', abbr: 'ORA' },
  { value: 'mysql', label: 'MySQL', abbr: 'MY' },
  { value: 'postgresql', label: 'PostgreSQL', abbr: 'PG' }
]

const DB_ABBR: Record<Database, string> = {
  oracle: 'ORA',
  mysql: 'MY',
  postgresql: 'PG'
}

// Helper: create a DB label computed property
function createDbLabelComputed(sourceRef: () => Database, targetRef: () => Database) {
  return {
    source: computed(() => DB_OPTIONS.find((d) => d.value === sourceRef())?.label ?? ''),
    target: computed(() => DB_OPTIONS.find((d) => d.value === targetRef())?.label ?? '')
  }
}

const PAGE_TITLES: Record<WorkbenchPage, { title: string; subtitle: string }> = {
  ddl: { title: 'DDL 翻译', subtitle: '建表语句 / 索引 / COMMENT 互转' },
  func: { title: '函数翻译', subtitle: 'CREATE FUNCTION 互转' },
  proc: { title: '存储过程翻译', subtitle: 'CREATE PROCEDURE 互转' },
  idTool: { title: '证件工具', subtitle: '身份证 / 统一社会信用代码' },
  ziweiTool: { title: '紫微斗数', subtitle: '命盘排盘与 AI 分析' },
  rules: { title: '映射规则', subtitle: '自定义类型/语法/函数映射' },
  aiConfig: { title: 'AI 助手配置', subtitle: '管理 AI 供应商与密钥' },
  appConfig: { title: '应用配置', subtitle: '全局配置参数管理' },
  opLogs: { title: '操作日志', subtitle: 'API 调用记录与审计' }
}

export const useWorkbenchStore = defineStore('workbench', () => {
  // === Navigation State ===
  const activePage = ref<WorkbenchPage>('ddl')
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(false)
  const sidebarSettingsOpen = ref(false)
  const testToolsExpanded = ref(false)

  // === UI State ===
  const dbDropdown = ref('')
  const showRulesMenu = ref(false)
  const actionBarCollapsed = ref(false)
  const refCollapsed = ref(true)
  const isMacPlatform = ref(false)

  // === DDL State ===
  const sourceDb = ref<Database>('oracle')
  const targetDb = ref<Database>('postgresql')
  const inputDdl = ref('')
  const outputDdl = ref('')
  const ddlRuleTab = ref('oracleToMysql')
  const ddlConverting = ref(false)
  const ddlStatusText = ref('')

  // === Function State ===
  const funcSourceDb = ref<Database>('oracle')
  const funcTargetDb = ref<Database>('postgresql')
  const funcInput = ref('')
  const funcOutput = ref('')
  const funcConverting = ref(false)
  const funcStatus = ref<TranslateStatus>('idle')

  // === Procedure State ===
  const procSourceDb = ref<Database>('oracle')
  const procTargetDb = ref<Database>('postgresql')
  const procInput = ref('')
  const procOutput = ref('')
  const procConverting = ref(false)
  const procStatus = ref<TranslateStatus>('idle')

  // === Modal State ===
  const alertModal = ref({ visible: false, title: '', message: '' })
  const confirmModal = ref({
    visible: false,
    title: '',
    message: '',
    _resolve: null as ((value: boolean) => void) | null
  })

  // === Computed ===
  const isWorkbenchPage = computed(() => NAV_PAGES.includes(activePage.value))

  const primaryShortcutLabel = computed(() => (isMacPlatform.value ? '⌘+Enter' : 'Ctrl+Enter'))

  const currentPageTitle = computed(() => PAGE_TITLES[activePage.value]?.title ?? '')
  const currentPageSubtitle = computed(() => PAGE_TITLES[activePage.value]?.subtitle ?? '')

  // === DB Label Computeds (using helper) ===
  const ddlLabels = createDbLabelComputed(
    () => sourceDb.value,
    () => targetDb.value
  )
  const funcLabels = createDbLabelComputed(
    () => funcSourceDb.value,
    () => funcTargetDb.value
  )
  const procLabels = createDbLabelComputed(
    () => procSourceDb.value,
    () => procTargetDb.value
  )
  const sourceLabel = ddlLabels.source
  const targetLabel = ddlLabels.target
  const funcSourceLabel = funcLabels.source
  const funcTargetLabel = funcLabels.target
  const procSourceLabel = procLabels.source
  const procTargetLabel = procLabels.target
  const sourceAbbr = computed(() => DB_ABBR[sourceDb.value] ?? '')
  const targetAbbr = computed(() => DB_ABBR[targetDb.value] ?? '')

  const inputLineCount = computed(() => {
    const text = inputDdl.value || ''
    return text ? text.split('\n').length : 0
  })

  // === Computed for conversion state ===
  const converting = computed(() => {
    if (activePage.value === 'ddl') return ddlConverting.value
    if (activePage.value === 'func') return funcConverting.value
    if (activePage.value === 'proc') return procConverting.value
    return false
  })

  const canConvert = computed(() => {
    if (activePage.value === 'ddl') return !!inputDdl.value.trim()
    if (activePage.value === 'func') return !!funcInput.value.trim()
    if (activePage.value === 'proc') return !!procInput.value.trim()
    return false
  })

  // === Actions ===
  async function convert(): Promise<void> {
    if (activePage.value === 'ddl') {
      if (!inputDdl.value.trim()) {
        showAlert('提示', '请输入要翻译的 DDL 语句')
        return
      }
      ddlConverting.value = true
      ddlStatusText.value = '正在翻译...'
      try {
        const result = await requestConvert({
          sourceDialect: sourceDb.value,
          targetDialect: targetDb.value,
          sql: inputDdl.value,
          kind: 'ddl'
        })
        if (result.ok) {
          outputDdl.value = result.outputSql || ''
          ddlStatusText.value = result.cached ? '翻译完成（缓存）' : '翻译完成'
        } else {
          outputDdl.value = ''
          ddlStatusText.value = '翻译失败'
          showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
        }
      } catch (error) {
        outputDdl.value = ''
        ddlStatusText.value = '翻译失败'
        showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
      } finally {
        ddlConverting.value = false
      }
    } else if (activePage.value === 'func') {
      if (!funcInput.value.trim()) {
        showAlert('提示', '请输入要翻译的函数语句')
        return
      }
      funcConverting.value = true
      funcStatus.value = 'loading'
      try {
        const result = await requestConvert({
          sourceDialect: funcSourceDb.value,
          targetDialect: funcTargetDb.value,
          sql: funcInput.value,
          kind: 'func'
        })
        if (result.ok) {
          funcOutput.value = result.outputSql || ''
          funcStatus.value = 'success'
        } else {
          funcOutput.value = ''
          funcStatus.value = 'error'
          showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
        }
      } catch (error) {
        funcOutput.value = ''
        funcStatus.value = 'error'
        showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
      } finally {
        funcConverting.value = false
      }
    } else if (activePage.value === 'proc') {
      if (!procInput.value.trim()) {
        showAlert('提示', '请输入要翻译的存储过程语句')
        return
      }
      procConverting.value = true
      procStatus.value = 'loading'
      try {
        const result = await requestConvert({
          sourceDialect: procSourceDb.value,
          targetDialect: procTargetDb.value,
          sql: procInput.value,
          kind: 'proc'
        })
        if (result.ok) {
          procOutput.value = result.outputSql || ''
          procStatus.value = 'success'
        } else {
          procOutput.value = ''
          procStatus.value = 'error'
          showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
        }
      } catch (error) {
        procOutput.value = ''
        procStatus.value = 'error'
        showAlert('翻译失败', mapErrorCodeToMessage(String(error)))
      } finally {
        procConverting.value = false
      }
    }
  }

  function setPage(page: WorkbenchPage): void {
    activePage.value = page
    // Close sidebars on mobile
    if (window.innerWidth < 768) {
      sidebarOpen.value = false
    }
  }

  function toggleTestToolsMenu(): void {
    testToolsExpanded.value = !testToolsExpanded.value
    if (!testToolsExpanded.value && activePage.value === 'ziweiTool') {
      setPage('idTool')
    }
  }

  function pickDb(
    field:
      | 'sourceDb'
      | 'targetDb'
      | 'funcSourceDb'
      | 'funcTargetDb'
      | 'procSourceDb'
      | 'procTargetDb',
    value: Database
  ): void {
    if (field === 'sourceDb') sourceDb.value = value
    else if (field === 'targetDb') targetDb.value = value
    else if (field === 'funcSourceDb') funcSourceDb.value = value
    else if (field === 'funcTargetDb') funcTargetDb.value = value
    else if (field === 'procSourceDb') procSourceDb.value = value
    else if (field === 'procTargetDb') procTargetDb.value = value
    dbDropdown.value = ''
  }

  function swapDbs(): void {
    swapRefs(sourceDb, targetDb)
  }

  function swapFuncDbs(): void {
    swapRefs(funcSourceDb, funcTargetDb)
  }

  function swapProcDbs(): void {
    swapRefs(procSourceDb, procTargetDb)
  }

  // Generic swap helper for two refs
  function swapRefs<T>(ref1: { value: T }, ref2: { value: T }): void {
    const temp = ref1.value
    ref1.value = ref2.value
    ref2.value = temp
  }

  function showAlert(title: string, message: string): void {
    alertModal.value = { visible: true, title, message }
  }

  function hideAlert(): void {
    alertModal.value = { visible: false, title: '', message: '' }
  }

  async function showConfirm(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmModal.value = { visible: true, title, message, _resolve: resolve }
    })
  }

  function resolveConfirm(value: boolean): void {
    if (confirmModal.value._resolve) {
      confirmModal.value._resolve(value)
    }
    confirmModal.value = { visible: false, title: '', message: '', _resolve: null }
  }

  // === File Actions ===
  const SAMPLE_DDL = `CREATE TABLE users (
  id NUMBER(20) NOT NULL,
  username VARCHAR2(50) NOT NULL,
  email VARCHAR2(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

COMMENT ON TABLE users IS '用户表';
CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_email ON users(email);`

  const SAMPLE_FUNCTION = `CREATE OR REPLACE FUNCTION get_user_count
  RETURN NUMBER
IS
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM users;
  RETURN v_count;
END get_user_count;`

  const SAMPLE_PROCEDURE = `CREATE OR REPLACE PROCEDURE add_user(
  p_username IN VARCHAR2,
  p_email IN VARCHAR2
)
IS
BEGIN
  INSERT INTO users (id, username, email)
  VALUES (users_seq.NEXTVAL, p_username, p_email);
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END add_user;`

  function loadSample(): void {
    if (activePage.value === 'ddl') {
      inputDdl.value = SAMPLE_DDL
      ddlStatusText.value = '已加载示例'
    } else if (activePage.value === 'func') {
      funcInput.value = SAMPLE_FUNCTION
      funcStatus.value = 'idle'
    } else if (activePage.value === 'proc') {
      procInput.value = SAMPLE_PROCEDURE
      procStatus.value = 'idle'
    }
  }

  function clearInput(): void {
    if (activePage.value === 'ddl') {
      inputDdl.value = ''
      outputDdl.value = ''
      ddlStatusText.value = '已清空'
    } else if (activePage.value === 'func') {
      funcInput.value = ''
      funcOutput.value = ''
      funcStatus.value = 'idle'
    } else if (activePage.value === 'proc') {
      procInput.value = ''
      procOutput.value = ''
      procStatus.value = 'idle'
    }
  }

  function getCurrentInput(): string {
    if (activePage.value === 'ddl') return inputDdl.value
    if (activePage.value === 'func') return funcInput.value
    if (activePage.value === 'proc') return procInput.value
    return ''
  }

  function setCurrentInput(value: string): void {
    if (activePage.value === 'ddl') inputDdl.value = value
    else if (activePage.value === 'func') {
      funcInput.value = value
      funcStatus.value = 'idle'
    } else if (activePage.value === 'proc') {
      procInput.value = value
      procStatus.value = 'idle'
    }
  }

  function toggleSidebarCollapse(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  return {
    // Navigation
    activePage,
    sidebarOpen,
    sidebarCollapsed,
    sidebarSettingsOpen,
    testToolsExpanded,
    toggleSidebarCollapse,

    // UI
    dbDropdown,
    showRulesMenu,
    actionBarCollapsed,
    refCollapsed,
    isMacPlatform,

    // DDL
    sourceDb,
    targetDb,
    inputDdl,
    outputDdl,
    ddlRuleTab,
    ddlConverting,
    ddlStatusText,

    // Function
    funcSourceDb,
    funcTargetDb,
    funcInput,
    funcOutput,
    funcConverting,
    funcStatus,

    // Procedure
    procSourceDb,
    procTargetDb,
    procInput,
    procOutput,
    procConverting,
    procStatus,

    // Modal
    alertModal,
    confirmModal,

    // Computed
    isWorkbenchPage,
    primaryShortcutLabel,
    currentPageTitle,
    currentPageSubtitle,
    sourceLabel,
    targetLabel,
    sourceAbbr,
    targetAbbr,
    funcSourceLabel,
    funcTargetLabel,
    procSourceLabel,
    procTargetLabel,
    inputLineCount,
    converting,
    canConvert,

    // Constants
    DB_OPTIONS,
    DB_ABBR,
    NAV_PAGES,

    // Actions
    setPage,
    toggleTestToolsMenu,
    pickDb,
    swapDbs,
    swapFuncDbs,
    swapProcDbs,
    showAlert,
    hideAlert,
    showConfirm,
    resolveConfirm,
    convert,
    loadSample,
    clearInput,
    getCurrentInput,
    setCurrentInput
  }
})
