// [2026-05-03] 新增：工作台状态管理（Pinia）
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { requestConvert } from '@/api/convert'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export type WorkbenchPage = 'ddl' | 'func' | 'proc' | 'idTool' | 'ziweiTool' | 'rules' | 'bodyRules'
export type Database = 'oracle' | 'mysql' | 'postgresql'

const NAV_PAGES: WorkbenchPage[] = ['ddl', 'func', 'proc', 'idTool', 'ziweiTool', 'rules', 'bodyRules']

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

const PAGE_TITLES: Record<WorkbenchPage, { title: string; subtitle: string }> = {
  ddl: { title: 'DDL 翻译', subtitle: '建表语句 / 索引 / COMMENT 互转' },
  func: { title: '函数翻译', subtitle: 'CREATE FUNCTION 互转' },
  proc: { title: '存储过程翻译', subtitle: 'CREATE PROCEDURE 互转' },
  idTool: { title: '证件工具', subtitle: '身份证 / 统一社会信用代码' },
  ziweiTool: { title: '紫微斗数', subtitle: '命盘排盘与 AI 分析' },
  rules: { title: 'DDL 映射规则', subtitle: '自定义类型/语法映射' },
  bodyRules: { title: '程序块映射规则', subtitle: '自定义函数/过程内部映射' }
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

  // === Procedure State ===
  const procSourceDb = ref<Database>('oracle')
  const procTargetDb = ref<Database>('postgresql')
  const procInput = ref('')
  const procOutput = ref('')
  const procConverting = ref(false)

  // === Modal State ===
  const alertModal = ref({ visible: false, title: '', message: '' })
  const confirmModal = ref({ visible: false, title: '', message: '', _resolve: null as ((value: boolean) => void) | null })

  // === Computed ===
  const isWorkbenchPage = computed(() => NAV_PAGES.includes(activePage.value))

  const primaryShortcutLabel = computed(() => isMacPlatform.value ? '⌘+Enter' : 'Ctrl+Enter')

  const currentPageTitle = computed(() => PAGE_TITLES[activePage.value]?.title ?? '')
  const currentPageSubtitle = computed(() => PAGE_TITLES[activePage.value]?.subtitle ?? '')

  const sourceLabel = computed(() => DB_OPTIONS.find(d => d.value === sourceDb.value)?.label ?? '')
  const targetLabel = computed(() => DB_OPTIONS.find(d => d.value === targetDb.value)?.label ?? '')

  const funcSourceLabel = computed(() => DB_OPTIONS.find(d => d.value === funcSourceDb.value)?.label ?? '')
  const funcTargetLabel = computed(() => DB_OPTIONS.find(d => d.value === funcTargetDb.value)?.label ?? '')

  const procSourceLabel = computed(() => DB_OPTIONS.find(d => d.value === procSourceDb.value)?.label ?? '')
  const procTargetLabel = computed(() => DB_OPTIONS.find(d => d.value === procTargetDb.value)?.label ?? '')

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
      try {
        const result = await requestConvert({
          sourceDialect: funcSourceDb.value,
          targetDialect: funcTargetDb.value,
          sql: funcInput.value,
          kind: 'func'
        })
        if (result.ok) {
          funcOutput.value = result.outputSql || ''
        } else {
          funcOutput.value = ''
          showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
        }
      } catch (error) {
        funcOutput.value = ''
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
      try {
        const result = await requestConvert({
          sourceDialect: procSourceDb.value,
          targetDialect: procTargetDb.value,
          sql: procInput.value,
          kind: 'proc'
        })
        if (result.ok) {
          procOutput.value = result.outputSql || ''
        } else {
          procOutput.value = ''
          showAlert('翻译失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
        }
      } catch (error) {
        procOutput.value = ''
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

  function pickDb(field: 'sourceDb' | 'targetDb' | 'funcSourceDb' | 'funcTargetDb' | 'procSourceDb' | 'procTargetDb', value: Database): void {
    if (field === 'sourceDb') sourceDb.value = value
    else if (field === 'targetDb') targetDb.value = value
    else if (field === 'funcSourceDb') funcSourceDb.value = value
    else if (field === 'funcTargetDb') funcTargetDb.value = value
    else if (field === 'procSourceDb') procSourceDb.value = value
    else if (field === 'procTargetDb') procTargetDb.value = value
    dbDropdown.value = ''
  }

  function swapDbs(): void {
    const temp = sourceDb.value
    sourceDb.value = targetDb.value
    targetDb.value = temp
  }

  function swapFuncDbs(): void {
    const temp = funcSourceDb.value
    funcSourceDb.value = funcTargetDb.value
    funcTargetDb.value = temp
  }

  function swapProcDbs(): void {
    const temp = procSourceDb.value
    procSourceDb.value = procTargetDb.value
    procTargetDb.value = temp
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
    } else if (activePage.value === 'proc') {
      procInput.value = SAMPLE_PROCEDURE
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
    } else if (activePage.value === 'proc') {
      procInput.value = ''
      procOutput.value = ''
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
    else if (activePage.value === 'func') funcInput.value = value
    else if (activePage.value === 'proc') procInput.value = value
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

    // Procedure
    procSourceDb,
    procTargetDb,
    procInput,
    procOutput,
    procConverting,

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
