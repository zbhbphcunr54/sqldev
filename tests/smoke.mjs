import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath))
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const indexHtml = read('index.html')
const legacyHtml = read('legacy.html')
const testHtml = exists('test.html') ? read('test.html') : ''
const packageJson = JSON.parse(read('package.json'))
const prettierIgnore = read('.prettierignore')
const eslintConfig = read('eslint.config.mjs')
const router = read('src/router/index.ts')
const appEntry = read('src/main.ts')
const appRoot = read('src/App.vue')
const routerGuards = read('src/router/guards.ts')
const viteConfig = read('vite.config.mjs')
const apiHttp = read('src/api/http.ts')
const supabaseClient = read('src/lib/supabase.ts')
const typeIndex = read('src/types/index.ts')
const authComposable = read('src/composables/useAuth.ts')
const authStore = read('src/stores/auth.ts')
const appStore = read('src/stores/app.ts')
const themeRuntime = read('src/composables/useThemeRuntime.ts')
const errorMap = read('src/utils/error-map.ts')
const loginPage = read('src/pages/auth/login.vue')
const authLayout = read('src/layouts/AuthLayout.vue')
const defaultLayout = read('src/layouts/DefaultLayout.vue')
const notFoundPage = read('src/pages/not-found.vue')
const splashPage = read('src/pages/splash/index.vue')
const legacyFrameView = read('src/components/business/legacy/LegacyFrameView.vue')
const feedbackWidget = read('src/components/business/feedback/FeedbackWidget.vue')
const workbenchSidebar = read('src/components/business/workbench/WorkbenchSidebar.vue')
const asyncStateComposable = read('src/composables/useAsyncState.ts')
const mainCss = read('src/styles/main.css')
const envExample = read('.env.example')
const legacyApp = read('src/legacy/app.js')
const legacyAuth = read('src/legacy/auth.js')
const legacyStyle = read('src/legacy/style.css')
const legacyRuntimeConfig = read('src/legacy/runtime-config.js')
const legacyBootstrap = read('src/legacy/bootstrap.js')
const legacyPreferencesRuntime = read('src/legacy/preferences-runtime.js')
const legacyStartupView = read('src/legacy/startup-view.js')
const legacyNavigationState = read('src/legacy/modules/navigation-state.js')
const workbenchSections = read('src/features/navigation/workbench-sections.ts')
const legacySqlEditorComponent = read('src/legacy/modules/sql-editor-component.js')
const legacySqlConversionActions = read('src/legacy/modules/sql-conversion-actions.js')
const legacyIdToolActions = read('src/legacy/modules/id-tool-actions.js')
const legacyZiweiAiCooldown = read('src/legacy/modules/ziwei-ai-cooldown.js')
const legacyZiweiAiSuggestions = read('src/legacy/modules/ziwei-ai-suggestions.js')
const legacyZiweiAiRequests = read('src/legacy/modules/ziwei-ai-requests.js')
const legacyZiweiSharePoster = read('src/legacy/modules/ziwei-share-poster.js')
const migration = read('supabase/migrations/202604230001_create_feedback_entries.sql')
const profilesMigration = read('supabase/migrations/202604290001_create_profiles.sql')
const authStrategy = read('supabase/FUNCTION-AUTH-STRATEGY.md')
const edgeResponseShared = read('supabase/functions/_shared/response.ts')
const convertSharedEngine = read('supabase/functions/_shared/convert-engine/app-engine.js')
const convertSharedRules = read('supabase/functions/_shared/convert-engine/rules.js')
const convertSharedSamples = read('supabase/functions/_shared/convert-engine/samples.js')
const convertFunction = read('supabase/functions/convert/index.ts')
const feedbackFunction = read('supabase/functions/feedback/index.ts')
const ziweiAnalysisFunction = read('supabase/functions/ziwei-analysis/index.ts')
const ziweiAnalysisHandler = read('supabase/functions/ziwei-analysis/handler.ts')
const ziweiAnalysisProvider = read('supabase/functions/ziwei-analysis/provider.ts')
const ziweiAnalysisPromptTemplate = read('supabase/functions/ziwei-analysis/prompt-template.ts')
const ziweiAnalysisResponseParser = read('supabase/functions/ziwei-analysis/response-parser.ts')
const sqlFormat = read('src/features/sql/sql-format.ts')
const sqlLegacyBridge = read('src/features/sql/legacy-bridge.ts')
const browserFileActions = read('src/features/browser/file-actions.ts')
const browserDomUtils = read('src/utils/browser-dom.ts')
const browserLegacyBridge = read('src/features/browser/legacy-bridge.ts')
const preferencesStorage = read('src/features/preferences/storage.ts')
const preferencesLegacyBridge = read('src/features/preferences/legacy-bridge.ts')
const rulesPersistence = read('src/features/rules/persistence.ts')
const rulesLegacyBridge = read('src/features/rules/legacy-bridge.ts')
const navigationRoute = read('src/features/navigation/legacy-route.ts')
const navigationRedirect = read('src/features/navigation/redirect.ts')
const navigationLegacyBridge = read('src/features/navigation/legacy-bridge.ts')
const idCardTools = read('src/features/id-tools/id-card.ts')
const usccTools = read('src/features/id-tools/uscc.ts')
const idToolsLegacyBridge = read('src/features/id-tools/legacy-bridge.ts')
const ziweiAiUtils = read('src/features/ziwei/ai-utils.ts')
const ziweiHistory = read('src/features/ziwei/history.ts')
const ziweiHistoryLegacyBridge = read('src/features/ziwei/history-legacy-bridge.ts')
const ziweiPresentation = read('src/features/ziwei/presentation.ts')
const ziweiPresentationLegacyBridge = read('src/features/ziwei/presentation-legacy-bridge.ts')
const ziweiShare = read('src/features/ziwei/share.ts')
const ziweiShareLegacyBridge = read('src/features/ziwei/share-legacy-bridge.ts')
const ziweiLegacyBridge = read('src/features/ziwei/legacy-bridge.ts')
const testRunner = read('tests/run-all.mjs')
const testHelper = read('tests/helpers/load-ts-module.mjs')
const sqlFormatTest = read('tests/sql-format.mjs')
const preferencesStorageTest = read('tests/preferences-storage.mjs')
const rulesPersistenceTest = read('tests/rules-persistence.mjs')
const idToolsTest = read('tests/id-tools.mjs')
const navigationRouteTest = read('tests/navigation-route.mjs')
const navigationWorkbenchSectionsTest = read('tests/navigation-workbench-sections.mjs')
const navigationRedirectTest = read('tests/navigation-redirect.mjs')
const ziweiHistoryTest = read('tests/ziwei-history.mjs')
const ziweiPresentationTest = read('tests/ziwei-presentation.mjs')
const ziweiShareTest = read('tests/ziwei-share.mjs')
const ziweiAiUtilsTest = read('tests/ziwei-ai-utils.mjs')

assert(indexHtml.includes('/src/main.ts'), 'index.html must load the Vue app entry')
assert(indexHtml.includes('rel="icon"'), 'index.html must declare a favicon')
assert(indexHtml.includes('og:title'), 'index.html must declare Open Graph metadata')
assert(!exists('index.vite.html'), 'obsolete index.vite.html redirect shell must be removed')
if (exists('test.html')) {
  assert(
    testHtml.includes('Deprecated Preview'),
    'test.html must be an explicit deprecated preview notice'
  )
}
assert(
  eslintConfig.includes('@typescript-eslint/no-explicit-any') &&
    eslintConfig.includes('@typescript-eslint/no-unused-vars'),
  'ESLint must enforce strict TypeScript safety rules'
)
assert(
  packageJson.scripts?.test === 'node ./tests/run-all.mjs',
  'test script must use the unified runner'
)
assert(
  packageJson.scripts?.['perf:report'] === 'node ./scripts/perf-report.mjs',
  'perf:report script must provide repeatable local build metrics'
)
assert(
  packageJson.scripts?.verify ===
    'pnpm typecheck && pnpm lint && pnpm check:utf8 && pnpm check:css-colors && pnpm test && pnpm test:unit',
  'verify script must run static checks, legacy tests and Vitest unit tests'
)
assert(
  testRunner.includes('const testFiles = [') && testRunner.includes('tests/smoke.mjs'),
  'tests/run-all.mjs must define the unified suite list'
)
assert(
  prettierIgnore.includes('legacy.html'),
  'Prettier must ignore legacy.html to avoid noisy formatting churn'
)
assert(
  prettierIgnore.includes('src/legacy/**'),
  'Prettier must ignore legacy runtime files during migration'
)
assert(
  legacyHtml.includes('src/legacy/bootstrap.js'),
  'legacy.html must retain the legacy bootstrap script'
)
assert(legacyHtml.includes('rel="icon"'), 'legacy.html must declare a favicon')
assert(
  legacyHtml.includes('src/legacy/runtime-config.js'),
  'legacy.html must load runtime config as an external module'
)
assert(
  legacyHtml.includes('src/legacy/preferences-runtime.js'),
  'legacy.html must load the shared legacy preference runtime before startup scripts'
)
assert(
  legacyHtml.includes('src/features/sql/legacy-bridge.ts'),
  'legacy.html must load the typed SQL utility bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/browser/legacy-bridge.ts'),
  'legacy.html must load the typed browser utility bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/preferences/legacy-bridge.ts'),
  'legacy.html must load the typed preference bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/rules/legacy-bridge.ts'),
  'legacy.html must load the typed rules persistence bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/id-tools/legacy-bridge.ts'),
  'legacy.html must load the typed ID tools bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/navigation/legacy-bridge.ts'),
  'legacy.html must load the typed route bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/navigation-state.js'),
  'legacy.html must load the split legacy navigation-state module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/sql-editor-component.js'),
  'legacy.html must load the split legacy SQL editor component module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/sql-conversion-actions.js'),
  'legacy.html must load the split legacy SQL conversion actions module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/id-tool-actions.js'),
  'legacy.html must load the split legacy ID tool actions module before app boot'
)
assert(
  legacyHtml.includes('src/features/ziwei/legacy-bridge.ts'),
  'legacy.html must load the typed Ziwei AI bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/ziwei/history-legacy-bridge.ts'),
  'legacy.html must load the typed Ziwei history bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/ziwei/presentation-legacy-bridge.ts'),
  'legacy.html must load the typed Ziwei presentation bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/ziwei/share-legacy-bridge.ts'),
  'legacy.html must load the typed Ziwei share bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/ziwei-ai-cooldown.js'),
  'legacy.html must load the split legacy Ziwei AI cooldown module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/ziwei-ai-suggestions.js'),
  'legacy.html must load the split legacy Ziwei AI suggestions module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/ziwei-ai-requests.js'),
  'legacy.html must load the split legacy Ziwei AI request module before app boot'
)
assert(
  legacyHtml.includes('src/legacy/modules/ziwei-share-poster.js'),
  'legacy.html must load the split legacy Ziwei share poster module before app boot'
)
assert(
  !legacyHtml.includes('loadRuntimeSupabaseConfig'),
  'legacy.html must not rely on CSP-blocked inline runtime config'
)
assert(
  router.includes("path: '/workbench'") &&
    router.includes("redirect: '/workbench/ddl'") &&
    router.includes("path: '/workbench/:section'") &&
    router.includes("component: () => import('@/pages/workbench/index.vue')"),
  'router must expose one normalized workbench section route'
)
assert(
  !exists('src/pages/workbench/ziwei.vue'),
  'Ziwei workbench must use the normalized section route'
)
assert(
  workbenchSections.includes('WORKBENCH_SECTION_NAV_ITEMS') &&
    workbenchSections.includes('normalizeWorkbenchSection') &&
    workbenchSections.includes('buildWorkbenchPath'),
  'workbench section route metadata must live in a typed single source'
)
assert(
  read('src/pages/workbench/index.vue').includes('router.replace(buildWorkbenchPath(normalized))'),
  'workbench page must normalize invalid section routes'
)
assert(
  router.includes("component: () => import('@/pages/splash/index.vue')"),
  'router page components must use lazy imports'
)
assert(
  router.includes('meta: { fullPage: true }'),
  'splash route must render as a native full page'
)
assert(router.includes('legacyFrame: true'), 'legacy-backed routes must be marked with legacyFrame')
assert(
  appEntry.includes('setupRouterGuards(router)'),
  'router guards must be installed after Pinia is active'
)
assert(appEntry.includes('app.config.errorHandler'), 'Vue app must register a global error handler')
assert(
  appEntry.includes('showGlobalErrorNotice'),
  'Vue global error handler must show a friendly user-facing notice'
)
assert(
  appRoot.includes('@/layouts/DefaultLayout.vue'),
  'App.vue must delegate shell layout to DefaultLayout'
)
assert(
  appRoot.includes('@/layouts/AuthLayout.vue'),
  'App.vue must delegate auth pages to AuthLayout'
)
assert(
  appRoot.includes('isFullPage') && appRoot.includes('isLegacyFramePage || isFullPage'),
  'App.vue must allow native full-page routes without the default shell'
)
assert(
  !splashPage.includes('LegacyFrameView') &&
    splashPage.includes('id="splash-poster"') &&
    splashPage.includes('sp-enter-btn') &&
    splashPage.includes('FeedbackWidget'),
  'splash page must render the preserved homepage layout as a native Vue SFC'
)
assert(routerGuards.includes('to.meta.requiresAuth'), 'router guards must handle protected routes')
assert(
  exists('src/types/database.types.ts'),
  'generated Supabase types must use database.types.ts naming'
)
assert(
  typeIndex.includes('./database.types'),
  'src/types/index.ts must re-export generated database types'
)
assert(typeIndex.includes('./result'), 'src/types/index.ts must re-export the shared Result type')
assert(
  !exists('src/types/supabase.ts'),
  'obsolete duplicate supabase.ts type barrel must be removed'
)
assert(
  supabaseClient.includes("import type { Database } from '@/types'"),
  'Supabase client must import Database from the type barrel'
)
assert(
  !supabaseClient.includes('@/types/supabase'),
  'Supabase client must not import the obsolete supabase.ts type path'
)
assert(
  authComposable.includes('signInWithPassword'),
  'useAuth composable must expose password login'
)
assert(
  loginPage.includes('@/composables/useAuth'),
  'login page must consume auth through the composable boundary'
)
assert(
  !loginPage.includes('@/stores/auth'),
  'login page must not couple directly to the auth store'
)
assert(authStore.includes('let initPromise'), 'auth store must serialize initAuth calls')
assert(
  authStore.includes('disposeAuthListener') && authStore.includes('unsubscribe()'),
  'auth store must expose subscription cleanup for HMR/tests'
)
assert(
  authStore.includes('function applySession'),
  'auth store must use a single helper to apply auth session state'
)
assert(
  !authStore.includes('loading.value = false\r\n    })') &&
    !authStore.includes('loading.value = false\n    })'),
  'auth state change callback must not race initAuth loading state'
)
assert(!appStore.includes('document.'), 'app store must not operate DOM directly')
assert(!appStore.includes('localStorage'), 'app store must not own browser storage side effects')
assert(
  themeRuntime.includes('applyThemeToDocument') && themeRuntime.includes('matchMedia'),
  'theme DOM and system-theme runtime must live in a composable'
)
assert(
  apiHttp.includes('@/utils/error-map'),
  'API client must use the centralized error message mapper'
)
assert(apiHttp.includes('AbortController'), 'API client must enforce fetch timeouts')
assert(apiHttp.includes('refreshSession()'), 'API client must refresh near-expired tokens')
assert(
  apiHttp.includes('VITE_API_TIMEOUT_MS'),
  'API client timeout must be configurable through VITE_API_TIMEOUT_MS'
)
assert(
  apiHttp.includes('parsed.code'),
  'API client must accept normalized error codes from Edge Functions'
)
assert(errorMap.includes('network_timeout'), 'error map must include a safe timeout message')
assert(
  errorMap.includes('session_refresh_failed'),
  'error map must include a safe session refresh failure message'
)
assert(
  asyncStateComposable.includes('mapErrorCodeToMessage'),
  'useAsyncState must use the centralized error message mapper'
)
assert(
  viteConfig.includes("base: './'"),
  'vite base must stay relative for sub-path static hosting'
)
assert(viteConfig.includes('loadEnv(mode'), 'vite config must load mode-specific env values')
assert(viteConfig.includes('VITE_DEV_PORT'), 'vite dev port must be configurable')
assert(viteConfig.includes('VITE_PREVIEW_PORT'), 'vite preview port must be configurable')
assert(
  viteConfig.includes("mode === 'staging'") && viteConfig.includes('VITE_BUILD_SOURCEMAP'),
  'vite sourcemap must be enabled for staging or explicit env opt-in'
)
assert(
  viteConfig.includes('const legacyFiles = [') &&
    viteConfig.includes('vendor/codemirror.min.js') &&
    !viteConfig.includes('cp(sourceDir, targetDir'),
  'copyLegacyAssetsPlugin must copy a curated legacy asset allowlist instead of the whole directory'
)
assert(
  authLayout.includes('Transition name="page-soft"') &&
    defaultLayout.includes('Transition name="page-soft"') &&
    mainCss.includes('.page-soft-enter-active'),
  'app layouts must use the shared lightweight page transition'
)
assert(
  notFoundPage.includes('进入工作台') && notFoundPage.includes('Route inspector'),
  '404 page must provide branded guidance and homepage/workbench CTAs'
)
assert(
  legacyFrameView.includes('import.meta.env.BASE_URL'),
  'legacy iframe must resolve from Vite base URL'
)
assert(
  legacyFrameView.includes('sandbox="allow-same-origin allow-scripts allow-forms"'),
  'legacy iframe must be sandboxed'
)
assert(
  legacyFrameView.includes('@load="handleFrameLoad"') &&
    legacyFrameView.includes('legacy-frame-state'),
  'legacy iframe must expose a loading/error state'
)
assert(
  legacyFrameView.includes("data.type === 'sqldev:navigate-home'") &&
    legacyFrameView.includes("router.push('/')"),
  'legacy iframe must delegate homepage navigation back to the Vue router'
)
assert(
  legacyFrameView.includes("'sqldev:navigate-workbench-section'") &&
    legacyFrameView.includes("'sqldev:set-workbench-hash'") &&
    legacyFrameView.includes('allowedWorkbenchSections') &&
    legacyFrameView.includes('router.replace(target)') &&
    legacyFrameView.includes('router.push(target)'),
  'legacy iframe must sync workbench section navigation back to the Vue router'
)
assert(!legacyHtml.includes('id="splash-poster"'), 'legacy splash poster DOM must move to Vue SFC')
assert(!legacyHtml.includes('id="sp-enter-btn"'), 'legacy splash CTA DOM must move to Vue SFC')
assert(
  !legacyHtml.includes('src/legacy/splash.js'),
  'legacy splash must not require a separate splash.js runtime'
)
assert(!exists('src/legacy/splash.js'), 'legacy splash.js runtime must stay retired')
assert(!viteConfig.includes("'splash.js'"), 'retired splash.js runtime must not be copied')
assert(
  feedbackWidget.includes("console.error('[SQLDev] Feedback submit failed'"),
  'feedback widget must log submit errors'
)
assert(
  feedbackWidget.includes('error instanceof ApiError'),
  'feedback widget must classify API errors'
)
assert(
  feedbackWidget.includes('mapErrorCodeToMessage'),
  'feedback widget must use centralized status/error messages'
)
assert(
  workbenchSidebar.includes('exact-active-class=') && !workbenchSidebar.includes('route.path ==='),
  'workbench sidebar must use RouterLink active matching instead of fragile path comparison'
)
assert(
  workbenchSidebar.includes('WORKBENCH_SECTION_NAV_ITEMS'),
  'workbench sidebar must read section navigation from the shared section metadata'
)
assert(
  mainCss.includes('focus-visible:ring-2') && mainCss.includes('focus-visible:ring-offset-bg'),
  'primary button styles must include visible keyboard focus states'
)
assert(
  sqlFormat.includes('export function splitSqlStatements'),
  'SQL splitter must live in the typed feature module'
)
assert(
  sqlFormat.includes('export function formatSqlText'),
  'SQL formatter must live in the typed feature module'
)
assert(
  sqlLegacyBridge.includes('window.SQLDEV_SQL_UTILS'),
  'SQL feature module must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_SQL_UTILS.splitStatements'),
  'legacy app must prefer the typed SQL splitter bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_SQL_UTILS.formatSqlText'),
  'legacy app must prefer the typed SQL formatter bridge'
)
assert(
  browserFileActions.includes('export async function copyTextToClipboard'),
  'browser file actions must expose typed clipboard helper'
)
assert(
  !browserFileActions.includes('document.createElement') &&
    browserDomUtils.includes('document.createElement'),
  'feature browser file actions must delegate DOM work to utils'
)
assert(
  browserFileActions.includes('export function downloadSqlTextFile'),
  'browser file actions must expose typed SQL download helper'
)
assert(
  browserLegacyBridge.includes('window.SQLDEV_BROWSER_UTILS'),
  'browser feature module must expose a legacy bridge'
)
assert(
  preferencesStorage.includes('export function getThemePreference'),
  'preference storage must live in typed feature module'
)
assert(
  preferencesLegacyBridge.includes('window.SQLDEV_PREFERENCE_UTILS'),
  'preference storage feature must expose a legacy bridge'
)
assert(
  rulesPersistence.includes('export function persistRulesToStorage'),
  'rules persistence must live in typed feature module'
)
assert(
  rulesLegacyBridge.includes('window.SQLDEV_RULE_STORAGE_UTILS'),
  'rules persistence feature must expose a legacy bridge'
)
assert(
  navigationRoute.includes('export function parseLegacyRouteInfoFromPath'),
  'route parsing must live in typed feature module'
)
assert(
  navigationRedirect.includes('export function sanitizeInternalRedirectPath'),
  'redirect sanitization must live in typed feature module'
)
assert(
  navigationLegacyBridge.includes('window.SQLDEV_ROUTE_UTILS'),
  'navigation feature module must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_BROWSER_UTILS.copyTextToClipboard'),
  'legacy app must prefer the typed clipboard bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_BROWSER_UTILS.downloadSqlTextFile'),
  'legacy app must prefer the typed download bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_PREFERENCE_UTILS.saveThemePreference'),
  'legacy app must prefer the typed preference bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_RULE_STORAGE_UTILS.persistRulesToStorage'),
  'legacy app must prefer the typed rules persistence bridge'
)
assert(
  idCardTools.includes('export function calcIdCardCheckDigit'),
  'ID card check digit must live in typed feature module'
)
assert(
  usccTools.includes('export function calcUsccCheckChar'),
  'USCC check char must live in typed feature module'
)
assert(
  idToolsLegacyBridge.includes('window.SQLDEV_ID_TOOL_UTILS'),
  'ID tools feature must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ID_TOOL_UTILS.calcIdCardCheckDigit'),
  'legacy app must prefer the typed ID card check bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ID_TOOL_UTILS.validateUsccOrLegacyToken') ||
    legacyIdToolActions.includes('idUtils.validateUsccOrLegacyToken'),
  'legacy ID tool flow must prefer the typed USCC validation bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_NAV_STATE.createLegacyNavigationState'),
  'legacy app must delegate navigation state helpers to the split legacy module'
)
assert(
  legacyNavigationState.includes('window.SQLDEV_LEGACY_NAV_STATE') &&
    legacyNavigationState.includes('parseRouteInfoFromLocation') &&
    legacyNavigationState.includes('buildWorkbenchHash'),
  'legacy navigation state module must own route parsing and workbench hash helpers'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_SQL_EDITOR.registerSqlEditorComponent'),
  'legacy app must delegate SQL editor component registration to the split legacy module'
)
assert(
  legacySqlEditorComponent.includes('export function registerSqlEditorComponent') &&
    legacySqlEditorComponent.includes("app.component('sql-editor'") &&
    legacySqlEditorComponent.includes('CodeMirror(wrap.value'),
  'legacy SQL editor component module must own the CodeMirror wrapper'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_SQL_CONVERSION_ACTIONS.createSqlConversionActions'),
  'legacy app must delegate repeated SQL conversion actions to the split legacy module'
)
assert(
  legacySqlConversionActions.includes('export function createSqlConversionActions') &&
    legacySqlConversionActions.includes('function createPairActions') &&
    legacySqlConversionActions.includes("kind: 'ddl'") &&
    legacySqlConversionActions.includes("kind: 'func'") &&
    legacySqlConversionActions.includes("kind: 'proc'"),
  'legacy SQL conversion actions module must own DDL/function/procedure action wiring'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_ID_TOOL_ACTIONS.createIdToolActions'),
  'legacy app must delegate ID/USCC action handlers to the split legacy module'
)
assert(
  legacyIdToolActions.includes('export function createIdToolActions') &&
    legacyIdToolActions.includes('function generateIdNumber') &&
    legacyIdToolActions.includes('function validateIdNumber') &&
    legacyIdToolActions.includes('function generateUsccCode') &&
    legacyIdToolActions.includes('function validateUsccCode'),
  'legacy ID tool actions module must own ID/USCC generate and validate actions'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_SHARE_POSTER.renderZiweiSharePoster'),
  'legacy app must delegate Ziwei share poster rendering to the split legacy module'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_SUGGESTIONS.createZiweiAiSuggestionActions'),
  'legacy app must delegate Ziwei AI suggestion UI/config logic to the split legacy module'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_COOLDOWN.createZiweiAiCooldownActions'),
  'legacy app must delegate Ziwei AI cooldown state logic to the split legacy module'
)
assert(
  legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_REQUESTS.createZiweiAiRequestActions'),
  'legacy app must delegate Ziwei AI request actions to the split legacy module'
)
assert(
  legacyApp.includes("window.parent.postMessage({ type: 'sqldev:navigate-home' }"),
  'legacy workbench home action must request parent Vue navigation instead of reviving legacy splash'
)
assert(
  legacyApp.includes("type: 'sqldev:navigate-workbench-section'") &&
    legacyApp.includes('notifyParentWorkbenchRoute(page') &&
    legacyApp.includes('section: segment') &&
    legacyApp.includes("data.type !== 'sqldev:set-workbench-hash'") &&
    legacyApp.includes('applyRouteFromParentMessage'),
  'legacy workbench route changes must sync with the parent Vue router without forcing iframe reloads'
)
assert(
  legacyZiweiAiCooldown.includes('export function createZiweiAiCooldownActions') &&
    legacyZiweiAiCooldown.includes('function ensureRequestAllowed') &&
    legacyZiweiAiCooldown.includes('function startCooldown'),
  'legacy Ziwei AI cooldown module must own cooldown and request interval gating'
)
assert(
  legacyZiweiAiRequests.includes('export function createZiweiAiRequestActions') &&
    legacyZiweiAiRequests.includes('async function submitQuestion') &&
    legacyZiweiAiRequests.includes('async function requestAnalysis') &&
    legacyZiweiAiRequests.includes("invokeFunction('ziwei-analysis'"),
  'legacy Ziwei AI request module must own analysis and QA invoke actions'
)
assert(
  legacyZiweiAiSuggestions.includes('export function createZiweiAiSuggestionActions') &&
    legacyZiweiAiSuggestions.includes('function normalizeZiweiQaSuggestionText') &&
    legacyZiweiAiSuggestions.includes("invokeFunction('ziwei-analysis'"),
  'legacy Ziwei AI suggestions module must own suggestion layout and server config loading'
)
assert(
  legacyZiweiSharePoster.includes('export function renderZiweiSharePoster') &&
    legacyZiweiSharePoster.includes('canvas.toDataURL') &&
    legacyZiweiSharePoster.includes('export function downloadZiweiSharePosterDataUrl'),
  'legacy Ziwei share poster module must own canvas poster rendering and download'
)
assert(
  ziweiAiUtils.includes('export function buildZiweiAiPayload'),
  'Ziwei AI payload builder must live in typed feature module'
)
assert(
  ziweiHistory.includes('export function loadZiweiHistoryRecords'),
  'Ziwei history persistence must live in typed feature module'
)
assert(
  ziweiHistoryLegacyBridge.includes('window.SQLDEV_ZIWEI_HISTORY_UTILS'),
  'Ziwei history feature module must expose a legacy bridge'
)
assert(
  ziweiPresentation.includes('export function formatZiweiDurationText'),
  'Ziwei presentation formatters must live in typed feature module'
)
assert(
  ziweiPresentationLegacyBridge.includes('window.SQLDEV_ZIWEI_PRESENTATION_UTILS'),
  'Ziwei presentation feature module must expose a legacy bridge'
)
assert(
  ziweiShare.includes('export function createZiweiSharePosterSpec'),
  'Ziwei share poster spec must live in typed feature module'
)
assert(
  ziweiShareLegacyBridge.includes('window.SQLDEV_ZIWEI_SHARE_UTILS'),
  'Ziwei share feature module must expose a legacy bridge'
)
assert(
  ziweiLegacyBridge.includes('window.SQLDEV_ZIWEI_AI_UTILS'),
  'Ziwei feature module must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ZIWEI_AI_UTILS.buildZiweiAiPayload'),
  'legacy app must prefer the typed Ziwei AI payload bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ZIWEI_AI_UTILS.mapZiweiAiErrorMessage'),
  'legacy app must prefer the typed Ziwei AI error bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ZIWEI_HISTORY_UTILS.loadZiweiHistoryRecords'),
  'legacy app must prefer the typed Ziwei history bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ZIWEI_PRESENTATION_UTILS.formatZiweiDurationText'),
  'legacy app must prefer the typed Ziwei presentation bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ZIWEI_SHARE_UTILS.createZiweiSharePosterSpec'),
  'legacy app must prefer the typed Ziwei share bridge'
)
assert(
  legacyAuth.includes('if (!Number.isFinite(exp) || exp <= 0) return true;'),
  'legacy auth must treat invalid JWT exp as expired'
)
assert(
  routerGuards.includes('sanitizeInternalRedirectPath'),
  'router guards must sanitize login redirect paths'
)
assert(
  loginPage.includes('sanitizeInternalRedirectPath(route.query.redirect)'),
  'login page must sanitize redirect query before router.push'
)
assert(
  !exists('src/legacy/supabase-config.js'),
  'legacy Supabase config must be consolidated into runtime-config.js'
)
assert(
  legacyRuntimeConfig.includes('window.SUPABASE_URL = url') &&
    legacyRuntimeConfig.includes('sb_secret_'),
  'legacy runtime config must inject public config and reject privileged browser keys'
)
assert(
  legacyRuntimeConfig.includes('import.meta.env.VITE_SUPABASE_URL'),
  'legacy runtime config must be injected by Vite env'
)
assert(
  legacyBootstrap.includes('waitForRuntimeConfig'),
  'legacy auth stack must wait for runtime config before auth init'
)
assert(
  legacyPreferencesRuntime.includes('window.__SQDEV_PREFERENCES__'),
  'legacy startup layer must share a single preference runtime helper'
)
assert(
  legacyStartupView.includes("window.__SQDEV_STARTUP_VIEW = 'workbench'") &&
    legacyStartupView.includes("window.__SQDEV_STARTUP_VIEW = 'splash'"),
  'legacy startup view must support both splash and workbench entry modes'
)
assert(legacyApp.includes('splashApi'), 'legacy app must keep splash bridge hooks during migration')
assert(legacyAuth.includes('splashApi'), 'legacy auth must keep splash auth hooks during migration')
assert(
  legacyStyle.includes('#splash-poster'),
  'legacy stylesheet must preserve homepage splash poster rules'
)
assert(
  legacyHtml.includes('<div class="auth-modal-mask" id="auth-modal-mask" hidden>') &&
    !legacyHtml.includes('id="splash-poster"'),
  'legacy auth modal may remain for workbench, but splash poster must live in Vue'
)
assert(
  legacyAuth.includes('ensureGlobalModalHost'),
  'legacy auth must keep the modal host guard for the preserved homepage'
)
assert(
  legacyBootstrap.includes("boot('startup-workbench')") &&
    legacyBootstrap.includes('scheduleIdleBoot') &&
    legacyBootstrap.includes('bindAuthIntent'),
  'legacy bootstrap must support direct workbench boot and preserved splash lazy boot'
)
assert(
  migration.includes('create table if not exists public.feedback_entries'),
  'feedback migration must create feedback_entries'
)
assert(migration.includes('enable row level security'), 'feedback migration must enable RLS')
assert(
  profilesMigration.includes('create table if not exists public.profiles') &&
    profilesMigration.includes('enable row level security'),
  'profiles migration must define the typed profiles table with RLS'
)
for (const indexName of [
  'idx_feedback_entries_category',
  'idx_feedback_entries_source',
  'idx_feedback_entries_client_ip',
  'idx_feedback_entries_user_id_created_at'
]) {
  assert(migration.includes(indexName), `feedback migration must include ${indexName}`)
}
assert(
  convertFunction.includes('function validateEngineModuleShape') &&
    convertFunction.includes('app-engine export') &&
    convertFunction.includes(
      "validateEngineModuleShape(await import('../_shared/convert-engine/app-engine.js'))"
    ),
  'convert function must validate dynamically imported engine module shape'
)
assert(
  convertFunction.includes("await import('../_shared/convert-engine/samples.js')") &&
    convertFunction.includes("await import('../_shared/convert-engine/rules.js')"),
  'convert function must load conversion engine assets from _shared/convert-engine'
)
assert(
  convertSharedEngine.includes('export { convertDDL, convertFunction, convertProcedure }') &&
    convertSharedRules.includes('export { _ddlRulesData, _bodyRulesData, _bodyRulesDefault }') &&
    convertSharedSamples.includes('export const DB_LABELS'),
  'shared convert engine must expose engine, rules and sample metadata modules'
)
assert(
  edgeResponseShared.includes('export function logEdgeError') &&
    edgeResponseShared.includes('Bearer [redacted]') &&
    edgeResponseShared.includes('export function errorResponse'),
  'Edge Functions must share sanitized logging and safe error responses'
)
assert(
  convertFunction.includes("logEdgeError('convert'") &&
    feedbackFunction.includes("logEdgeError('feedback'") &&
    ziweiAnalysisHandler.includes("logEdgeError('ziwei-analysis'"),
  'Edge Functions must use shared sanitized error logging'
)
assert(
  feedbackFunction.includes("Deno.env.get('CORS_PRIMARY_ORIGIN')"),
  'feedback function CORS must read CORS_PRIMARY_ORIGIN'
)
assert(
  ziweiAnalysisFunction.trim() ===
    "import { handleZiweiAnalysisRequest } from './handler.ts'\n\nDeno.serve(handleZiweiAnalysisRequest)",
  'ziwei analysis index must stay as a thin function entry'
)
assert(
  ziweiAnalysisHandler.includes('export async function handleZiweiAnalysisRequest') &&
    ziweiAnalysisHandler.includes('createRateLimiter') &&
    ziweiAnalysisHandler.includes('validateBearerToken'),
  'ziwei analysis handler must own auth, rate limit and request routing'
)
assert(
  ziweiAnalysisProvider.includes('export async function requestAiAnalysis') &&
    ziweiAnalysisProvider.includes('export async function requestAiQa') &&
    ziweiAnalysisProvider.includes('fetchAiChat'),
  'ziwei analysis provider must own upstream AI calls'
)
assert(
  ziweiAnalysisPromptTemplate.includes('export function buildAnalysisSystemPrompt') &&
    ziweiAnalysisPromptTemplate.includes('export function normalizeQaTemplate'),
  'ziwei analysis prompt templates must live outside the handler'
)
assert(
  ziweiAnalysisResponseParser.includes('export function isValidChartPayloadStructure') &&
    ziweiAnalysisResponseParser.includes('export function normalizeAnalysis') &&
    ziweiAnalysisResponseParser.includes('export function mapAiErrorStatus'),
  'ziwei analysis response parser must validate chart payloads and normalize AI output'
)
assert(authStrategy.includes('## convert'), 'function auth strategy must document convert')
assert(authStrategy.includes('## feedback'), 'function auth strategy must document feedback')
assert(
  authStrategy.includes('## ziwei-analysis'),
  'function auth strategy must document ziwei-analysis'
)
assert(
  packageJson.scripts?.lint?.includes('src/**/*.{ts,vue}'),
  'lint script must stay scoped to Vue/TS source'
)
assert(
  packageJson.scripts?.['test:smoke'] === 'node ./tests/smoke.mjs',
  'smoke test entry must live under tests/'
)
assert(
  envExample.includes('VITE_API_TIMEOUT_MS') && envExample.includes('supabase secrets set'),
  '.env.example must document frontend env and Edge Function secret ownership'
)
assert(testHelper.includes('export function loadTsModule'), 'TS module test loader must be shared')
for (const testFile of [
  sqlFormatTest,
  preferencesStorageTest,
  rulesPersistenceTest,
  idToolsTest
]) {
  assert(
    testFile.includes('./helpers/load-ts-module.mjs'),
    'feature tests must reuse the shared TS module loader'
  )
}
for (const testFile of [
  navigationRouteTest,
  navigationWorkbenchSectionsTest,
  navigationRedirectTest,
  ziweiHistoryTest,
  ziweiPresentationTest,
  ziweiShareTest,
  ziweiAiUtilsTest
]) {
  assert(
    testFile.includes('./helpers/load-ts-module.mjs'),
    'new feature tests must reuse the shared TS module loader'
  )
}

const functionConfigs = [
  'supabase/functions/convert/config.toml',
  'supabase/functions/feedback/config.toml',
  'supabase/functions/ziwei-analysis/config.toml',
  'supabase/functions/convert-verify/config.toml'
]

for (const configPath of functionConfigs) {
  const config = read(configPath)
  assert(config.includes('verify_jwt = false'), `${configPath} must declare verify_jwt strategy`)
}

assert(
  !exists('supabase/functions/ziwei-analysis/index.legacy.ts'),
  'obsolete ziwei legacy function entry must be removed'
)
assert(
  !exists('supabase/functions/ziwei-analysis/index.rewrite.ts'),
  'obsolete ziwei rewrite function entry must be removed'
)
assert(
  !exists('src/composables/useZiweiTool.ts'),
  'unused Vue-side Ziwei composable must be removed'
)
assert(!exists('src/api/profile.ts'), 'unused profile API module must be removed')
assert(!exists('src/api/ziwei.ts'), 'unused Vue-side Ziwei API module must be removed')
assert(!exists('src/components/ziwei'), 'unused Vue-side Ziwei component directory must be removed')

// AI Verify Edge Function checks
const convertVerifyFunction = read('supabase/functions/convert-verify/index.ts')
const convertVerifyPromptTemplate = read('supabase/functions/convert-verify/prompt-template.ts')
const convertVerifyProvider = read('supabase/functions/convert-verify/provider.ts')
const convertVerifyQuota = read('supabase/functions/convert-verify/quota.ts')
const convertVerifyProfile = read('supabase/functions/convert-verify/profile.ts')
const convertVerifyApi = read('src/api/convert-verify.ts')
const convertVerifyProfilesApi = read('src/api/verify-profiles.ts')

assert(
  convertVerifyFunction.includes('export async function handleConvertVerifyRequest') ||
    convertVerifyFunction.includes('Deno.serve'),
  'convert-verify function must export a handler'
)
assert(
  convertVerifyFunction.includes('requestAiVerify') &&
    convertVerifyPromptTemplate.includes('buildVerifySystemPrompt') &&
    convertVerifyPromptTemplate.includes('buildVerifyUserPrompt'),
  'convert-verify must implement AI verification prompt templates'
)
assert(
  convertVerifyProvider.includes('export async function requestAiVerify'),
  'convert-verify must export AI verification request function'
)
assert(
  convertVerifyQuota.includes('checkQuota') &&
    convertVerifyQuota.includes('incrementQuota') &&
    convertVerifyQuota.includes('getQuotaInfo'),
  'convert-verify must implement quota management'
)
assert(
  convertVerifyProfile.includes('loadVerifyProfile'),
  'convert-verify must implement profile loading'
)
assert(
  convertVerifyApi.includes('requestConvertVerify') &&
    convertVerifyApi.includes('fetchVerifyQuota'),
  'convert-verify API must expose client-side functions'
)
assert(
  convertVerifyProfilesApi.includes('fetchVerifyProfiles') &&
    convertVerifyProfilesApi.includes('saveVerifyProfile') &&
    convertVerifyProfilesApi.includes('deleteVerifyProfile'),
  'verify-profiles API must expose CRUD operations'
)

// AI Verify Vue components
assert(
  exists('src/components/business/convert-verify/ConvertVerifyPanel.vue'),
  'ConvertVerifyPanel component must exist'
)
assert(
  exists('src/components/business/convert-verify/VerifyScoreBadge.vue'),
  'VerifyScoreBadge component must exist'
)
assert(
  exists('src/components/business/convert-verify/VerifyIssueList.vue'),
  'VerifyIssueList component must exist'
)
assert(
  exists('src/components/business/convert-verify/VerifySuggestionCard.vue'),
  'VerifySuggestionCard component must exist'
)

// AI Verify error codes
assert(
  errorMap.includes('quota_exceeded') &&
    errorMap.includes('verify_failed') &&
    errorMap.includes('invalid_kind'),
  'error map must include convert-verify error codes'
)

console.log('Smoke checks passed')
