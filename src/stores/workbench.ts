import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { requestSqlConvert } from '@/api/sql-convert'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { ApiError } from '@/lib/edge'
import { DB_META_MAP, type DbMeta } from '@/features/sql/db-meta'
import { appConfigApi } from '@/api/app-config'
import { getJson, setJson } from '@/utils/storage'

const SAMPLE_CACHE_KEY = 'sqldev:workbench:sample_cache'
const SAMPLE_CACHE_TTL = 30 * 60 * 1000

interface SampleCacheData {
  version: number
  samples: Record<string, string>
  timestamp: number
}

function createEmptyCache(): SampleCacheData {
  return { version: 1, samples: {}, timestamp: Date.now() }
}

function getSampleCache(): SampleCacheData {
  const data = getJson<SampleCacheData | null>(SAMPLE_CACHE_KEY, null)
  if (!data || data.version !== 1 || Date.now() - data.timestamp > SAMPLE_CACHE_TTL)
    return createEmptyCache()
  return data
}

function persistSampleCache(samples: Record<string, string>): void {
  setJson(SAMPLE_CACHE_KEY, { version: 1, samples, timestamp: Date.now() })
}

export type WorkbenchPage = 'sqlConvert' | 'idTool' | 'ziweiTool' | 'aiConfig' | 'opLogs'

export type SqlType = 'ddl' | 'function' | 'procedure' | 'auto'
export type TranslateStatus = 'idle' | 'loading' | 'success' | 'error'

export interface DbOption {
  slug: string
  label: string
  abbr: string
}

const NAV_PAGES: WorkbenchPage[] = ['sqlConvert', 'idTool', 'ziweiTool', 'aiConfig', 'opLogs']

const PAGE_TITLES: Record<WorkbenchPage, { title: string; subtitle: string }> = {
  sqlConvert: { title: 'SQL 转换', subtitle: 'DDL / 函数 / 存储过程 AI 互转' },
  idTool: { title: '证件工具', subtitle: '身份证 / 统一社会信用代码' },
  ziweiTool: { title: '紫微斗数', subtitle: '命盘排盘与 AI 分析' },
  aiConfig: { title: 'AI 助手配置', subtitle: '管理 AI 供应商与密钥' },
  opLogs: { title: '操作日志', subtitle: 'API 调用记录与审计' }
}

export const useWorkbenchStore = defineStore('workbench', () => {
  // === Navigation State ===
  const activePage = ref<WorkbenchPage>('sqlConvert')
  const sidebarOpen = ref(false)
  const sidebarCollapsed = ref(false)
  const sidebarSettingsOpen = ref(false)
  const testToolsExpanded = ref(false)

  // === UI State ===
  const dbDropdown = ref('')
  const actionBarCollapsed = ref(false)
  const refCollapsed = ref(true)
  const isMacPlatform = ref(false)

  // === SQL Convert State (unified) ===
  const dbOptions = ref<DbOption[]>([])
  const dbMetaMap = DB_META_MAP
  const sourceDb = ref('oracle')
  const targetDb = ref('postgresql')
  const sqlType = ref<SqlType>('ddl')
  const inputSql = ref('')
  const outputSql = ref('')
  const converting = ref(false)
  const statusText = ref('工作台已就绪')
  const status = ref<TranslateStatus>('idle')
  const translateTimeMs = ref<number | null>(null)
  const aiRatio = ref<number | null>(null)
  const manualNeeded = ref<boolean>(false)
  const manualParts = ref<string[]>([])
  const notes = ref<string[]>([])
  const accuracy = ref<string | null>(null)
  const loadingSample = ref(false)

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
  const sourceLabel = computed(() => dbMetaMap[sourceDb.value]?.label ?? sourceDb.value)
  const targetLabel = computed(() => dbMetaMap[targetDb.value]?.label ?? targetDb.value)
  const sourceAbbr = computed(
    () => dbMetaMap[sourceDb.value]?.abbr ?? sourceDb.value.substring(0, 3).toUpperCase()
  )
  const targetAbbr = computed(
    () => dbMetaMap[targetDb.value]?.abbr ?? targetDb.value.substring(0, 3).toUpperCase()
  )
  const hasInput = computed(() => !!inputSql.value.trim())
  const hasOutput = computed(() => !!outputSql.value.trim())
  const inputLineCount = computed(() => {
    const text = inputSql.value || ''
    return text ? text.split('\n').length : 0
  })
  const canConvert = computed(() => hasInput.value && !converting.value)

  function resetOutputState(): void {
    outputSql.value = ''
    aiRatio.value = null
    manualNeeded.value = false
    manualParts.value = []
    notes.value = []
    accuracy.value = null
  }

  // === Actions ===
  function setPage(page: WorkbenchPage): void {
    activePage.value = page
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

  function pickDb(field: 'sourceDb' | 'targetDb', value: string): void {
    if (field === 'sourceDb') sourceDb.value = value
    else targetDb.value = value
    dbDropdown.value = ''
  }

  function swapDbs(): void {
    const temp = sourceDb.value
    sourceDb.value = targetDb.value
    targetDb.value = temp
  }

  function setSqlType(type: SqlType): void {
    sqlType.value = type
  }

  async function convert(): Promise<void> {
    if (converting.value) return
    if (!inputSql.value.trim()) {
      showAlert('提示', '请输入要转换的 SQL 语句')
      return
    }

    const startTime = Date.now()
    converting.value = true
    status.value = 'loading'
    statusText.value = 'AI 正在转换...'

    try {
      const result = await requestSqlConvert({
        sourceDb: sourceDb.value,
        targetDb: targetDb.value,
        sqlType: sqlType.value,
        inputSql: inputSql.value
      })

      translateTimeMs.value = Date.now() - startTime

      if (result.ok) {
        outputSql.value = result.outputSql || ''
        aiRatio.value = result.aiRatio ?? null
        manualNeeded.value = result.manualNeeded ?? false
        manualParts.value = result.manualParts ?? []
        notes.value = result.notes ?? []
        accuracy.value = result.accuracy ?? null
        status.value = 'success'
        statusText.value = result.model ? `转换完成 — ${result.model}` : '转换完成'
      } else {
        resetOutputState()
        status.value = 'error'
        statusText.value = '转换失败'
        showAlert('转换失败', mapErrorCodeToMessage(result.error || 'convert_failed'))
      }
    } catch (error) {
      resetOutputState()
      status.value = 'error'
      statusText.value = '转换失败'
      const code = error instanceof ApiError ? error.code : 'network_error'
      showAlert('转换失败', mapErrorCodeToMessage(code))
    } finally {
      converting.value = false
    }
  }

  async function loadSample(): Promise<void> {
    const db = sourceDb.value
    const type = sqlType.value === 'auto' ? 'ddl' : sqlType.value
    const cacheKey = `${db}_${type}`

    loadingSample.value = true
    statusText.value = '正在加载示例...'

    // localStorage 缓存命中
    const cache = getSampleCache()
    if (cache.samples[cacheKey]) {
      inputSql.value = cache.samples[cacheKey]
      resetOutputState()
      status.value = 'idle'
      statusText.value = '已加载示例'
      translateTimeMs.value = null
      loadingSample.value = false
      return
    }

    // 从 app_configs 获取并缓存全部示例
    try {
      const result = await appConfigApi.list('sql_convert_sample')
      let changed = false
      for (const c of result.configs ?? []) {
        if (c.key && c.value) {
          cache.samples[c.key] = c.value
          changed = true
        }
      }
      if (changed) persistSampleCache(cache.samples)

      if (cache.samples[cacheKey]) {
        inputSql.value = cache.samples[cacheKey]
        resetOutputState()
        status.value = 'idle'
        statusText.value = '已加载示例'
        translateTimeMs.value = null
        loadingSample.value = false
        return
      }
    } catch {
      status.value = 'idle'
      statusText.value = '网络错误，加载示例失败'
      loadingSample.value = false
      return
    }

    // 未配置
    status.value = 'idle'
    const dbLabel = dbMetaMap[db]?.label ?? db
    statusText.value = `"${dbLabel}" 数据库示例尚未配置，请在 app_configs 表中添加 sql_convert_sample 配置项`
    loadingSample.value = false
  }

  async function prefetchSamples(): Promise<void> {
    try {
      const result = await appConfigApi.list('sql_convert_sample')
      const cache = getSampleCache()
      let changed = false
      for (const c of result.configs ?? []) {
        if (c.key && c.value) {
          cache.samples[c.key] = c.value
          changed = true
        }
      }
      if (changed) persistSampleCache(cache.samples)
    } catch (err) {
      console.error('[SQLDev] Sample prefetch failed', err)
    }
  }

  function clearAll(): void {
    inputSql.value = ''
    resetOutputState()
    status.value = 'idle'
    statusText.value = '已清空'
    translateTimeMs.value = null
  }

  function setDbOptions(options: DbOption[]): void {
    dbOptions.value = options
  }

  function initDbOptionsFromConfig(slugs: string[]): void {
    const options: DbOption[] = []
    for (const slug of slugs) {
      const meta: DbMeta | undefined = dbMetaMap[slug]
      if (meta) {
        options.push({ slug: meta.slug, label: meta.label, abbr: meta.abbr })
      }
    }
    if (options.length > 0) {
      dbOptions.value = options
    }
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

  function toggleSidebarCollapse(): void {
    sidebarCollapsed.value = !sidebarCollapsed.value
  }

  function getCurrentInput(): string {
    return inputSql.value
  }

  function setCurrentInput(value: string): void {
    inputSql.value = value
    status.value = 'idle'
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
    actionBarCollapsed,
    refCollapsed,
    isMacPlatform,

    // SQL Convert (unified)
    dbOptions,
    dbMetaMap,
    sourceDb,
    targetDb,
    sqlType,
    inputSql,
    outputSql,
    converting,
    statusText,
    status,
    translateTimeMs,
    aiRatio,
    manualNeeded,
    manualParts,
    notes,
    accuracy,
    loadingSample,

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
    hasInput,
    hasOutput,
    inputLineCount,
    canConvert,

    // Constants
    NAV_PAGES,

    // Actions
    setPage,
    toggleTestToolsMenu,
    pickDb,
    swapDbs,
    setSqlType,
    convert,
    loadSample,
    prefetchSamples,
    clearAll,
    setDbOptions,
    initDbOptionsFromConfig,
    showAlert,
    hideAlert,
    showConfirm,
    resolveConfirm,
    getCurrentInput,
    setCurrentInput
  }
})
