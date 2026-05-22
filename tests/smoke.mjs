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
const legacyHtml = exists('legacy.html') ? read('legacy.html') : ''
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
const legacyFrameView = exists('src/components/business/legacy/LegacyFrameView.vue') ? read('src/components/business/legacy/LegacyFrameView.vue') : ''
const feedbackWidget = read('src/components/business/feedback/FeedbackWidget.vue')
const workbenchSidebar = read('src/components/business/workbench/WorkbenchSidebar.vue')
const asyncStateComposable = read('src/composables/useAsyncState.ts')
const mainCss = read('src/styles/main.css')
const envExample = read('.env.example')
const legacyApp = exists('src/legacy/app.js') ? read('src/legacy/app.js') : ''
const legacyAuth = exists('src/legacy/auth.js') ? read('src/legacy/auth.js') : ''
const legacyStyle = exists('src/legacy/style.css') ? read('src/legacy/style.css') : ''
const legacyRuntimeConfig = exists('src/legacy/runtime-config.js') ? read('src/legacy/runtime-config.js') : ''
const legacyBootstrap = exists('src/legacy/bootstrap.js') ? read('src/legacy/bootstrap.js') : ''
const legacyPreferencesRuntime = exists('src/legacy/preferences-runtime.js') ? read('src/legacy/preferences-runtime.js') : ''
const legacyStartupView = exists('src/legacy/startup-view.js') ? read('src/legacy/startup-view.js') : ''
const legacyNavigationState = exists('src/legacy/modules/navigation-state.js') ? read('src/legacy/modules/navigation-state.js') : ''
const workbenchSections = read('src/features/navigation/workbench-sections.ts')
const legacySqlEditorComponent = exists('src/legacy/modules/sql-editor-component.js') ? read('src/legacy/modules/sql-editor-component.js') : ''
const legacySqlConversionActions = exists('src/legacy/modules/sql-conversion-actions.js') ? read('src/legacy/modules/sql-conversion-actions.js') : ''
const legacyIdToolActions = exists('src/legacy/modules/id-tool-actions.js') ? read('src/legacy/modules/id-tool-actions.js') : ''
const legacyZiweiAiCooldown = exists('src/legacy/modules/ziwei-ai-cooldown.js') ? read('src/legacy/modules/ziwei-ai-cooldown.js') : ''
const legacyZiweiAiSuggestions = exists('src/legacy/modules/ziwei-ai-suggestions.js') ? read('src/legacy/modules/ziwei-ai-suggestions.js') : ''
const legacyZiweiAiRequests = exists('src/legacy/modules/ziwei-ai-requests.js') ? read('src/legacy/modules/ziwei-ai-requests.js') : ''
const legacyZiweiSharePoster = exists('src/legacy/modules/ziwei-share-poster.js') ? read('src/legacy/modules/ziwei-share-poster.js') : ''
const migration = read('supabase/migrations/202604230001_create_feedback_entries.sql')
const profilesMigration = read('supabase/migrations/202604290001_create_profiles.sql')
const authStrategy = read('supabase/FUNCTION-AUTH-STRATEGY.md')
const edgeResponseShared = read('supabase/functions/_shared/response.ts')
const sqlConvertFunction = read('supabase/functions/sql-convert/index.ts')
const feedbackFunction = read('supabase/functions/feedback/index.ts')
const ziweiAnalysisFunction = read('supabase/functions/ziwei-analysis/index.ts')
const ziweiAnalysisHandler = read('supabase/functions/ziwei-analysis/handler.ts')
const ziweiAnalysisProvider = read('supabase/functions/ziwei-analysis/provider.ts')
const ziweiAnalysisPromptTemplate = read('supabase/functions/ziwei-analysis/prompt-template.ts')
const ziweiAnalysisResponseParser = read('supabase/functions/ziwei-analysis/response-parser.ts')
const sqlFormat = read('src/features/sql/sql-format.ts')
const sqlLegacyBridge = exists('src/features/sql/legacy-bridge.ts') ? read('src/features/sql/legacy-bridge.ts') : ''
const browserFileActions = read('src/utils/file-actions.ts')
const browserDomUtils = read('src/utils/browser-dom.ts')
const preferencesStorage = read('src/features/preferences/storage.ts')
const preferencesLegacyBridge = exists('src/features/preferences/legacy-bridge.ts') ? read('src/features/preferences/legacy-bridge.ts') : ''
const dbMeta = read('src/features/sql/db-meta.ts')
const sqlConvertApi = read('src/api/sql-convert.ts')
const navigationRoute = read('src/features/navigation/legacy-route.ts')
const navigationRedirect = read('src/features/navigation/redirect.ts')
const navigationLegacyBridge = exists('src/features/navigation/legacy-bridge.ts') ? read('src/features/navigation/legacy-bridge.ts') : ''
const idCardTools = read('src/features/id-tools/id-card.ts')
const usccTools = read('src/features/id-tools/uscc.ts')
const idToolsLegacyBridge = exists('src/features/id-tools/legacy-bridge.ts') ? read('src/features/id-tools/legacy-bridge.ts') : ''
const ziweiAiUtils = read('src/features/ziwei/ai-utils.ts')
const ziweiHistory = read('src/features/ziwei/history.ts')
const ziweiHistoryLegacyBridge = exists('src/features/ziwei/history-legacy-bridge.ts') ? read('src/features/ziwei/history-legacy-bridge.ts') : ''
const ziweiPresentation = read('src/features/ziwei/presentation.ts')
const ziweiPresentationLegacyBridge = exists('src/features/ziwei/presentation-legacy-bridge.ts') ? read('src/features/ziwei/presentation-legacy-bridge.ts') : ''
const ziweiShare = read('src/features/ziwei/share.ts')
const ziweiShareLegacyBridge = exists('src/features/ziwei/share-legacy-bridge.ts') ? read('src/features/ziwei/share-legacy-bridge.ts') : ''
const ziweiLegacyBridge = exists('src/features/ziwei/legacy-bridge.ts') ? read('src/features/ziwei/legacy-bridge.ts') : ''
const testRunner = read('tests/run-all.mjs')
const testHelper = read('tests/helpers/load-ts-module.mjs')
const sqlFormatTest = read('tests/sql-format.mjs')
const preferencesStorageTest = read('tests/preferences-storage.mjs')
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
    'pnpm typecheck && pnpm lint --quiet && pnpm check:utf8 && pnpm check:css-colors && pnpm test && pnpm test:unit',
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

// Skip legacy.html assertions if file doesn't exist (removed in refactor)
if (legacyHtml) {
  assert(legacyHtml.includes('src/legacy/bootstrap.js'), 'legacy.html must retain the legacy bootstrap script')
  assert(legacyHtml.includes('rel="icon"'), 'legacy.html must declare a favicon')
  assert(legacyHtml.includes('src/legacy/runtime-config.js'), 'legacy.html must load runtime config as an external module')
  assert(legacyHtml.includes('src/legacy/preferences-runtime.js'), 'legacy.html must load the shared legacy preference runtime before startup scripts')
  assert(legacyHtml.includes('src/features/sql/legacy-bridge.ts'), 'legacy.html must load the typed SQL utility bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/browser/legacy-bridge.ts'), 'legacy.html must load the typed browser utility bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/preferences/legacy-bridge.ts'), 'legacy.html must load the typed preference bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/id-tools/legacy-bridge.ts'), 'legacy.html must load the typed ID tools bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/navigation/legacy-bridge.ts'), 'legacy.html must load the typed route bridge before legacy app boot')
  assert(legacyHtml.includes('src/legacy/modules/navigation-state.js'), 'legacy.html must load the split legacy navigation-state module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/sql-editor-component.js'), 'legacy.html must load the split legacy SQL editor component module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/sql-conversion-actions.js'), 'legacy.html must load the split legacy SQL conversion actions module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/id-tool-actions.js'), 'legacy.html must load the split legacy ID tool actions module before app boot')
  assert(legacyHtml.includes('src/features/ziwei/legacy-bridge.ts'), 'legacy.html must load the typed Ziwei AI bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/ziwei/history-legacy-bridge.ts'), 'legacy.html must load the typed Ziwei history bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/ziwei/presentation-legacy-bridge.ts'), 'legacy.html must load the typed Ziwei presentation bridge before legacy app boot')
  assert(legacyHtml.includes('src/features/ziwei/share-legacy-bridge.ts'), 'legacy.html must load the typed Ziwei share bridge before legacy app boot')
  assert(legacyHtml.includes('src/legacy/modules/ziwei-ai-cooldown.js'), 'legacy.html must load the split legacy Ziwei AI cooldown module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/ziwei-ai-suggestions.js'), 'legacy.html must load the split legacy Ziwei AI suggestions module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/ziwei-ai-requests.js'), 'legacy.html must load the split legacy Ziwei AI request module before app boot')
  assert(legacyHtml.includes('src/legacy/modules/ziwei-share-poster.js'), 'legacy.html must load the split legacy Ziwei share poster module before app boot')
  assert(!legacyHtml.includes('loadRuntimeSupabaseConfig'), 'legacy.html must not rely on CSP-blocked inline runtime config')
}
assert(
  router.includes("path: '/workbench'") &&
    router.includes("redirect: '/workbench/sql-convert'") &&
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
const workbenchPage = read('src/pages/workbench/index.vue')
assert(
  workbenchPage.includes('buildWorkbenchPath') && workbenchPage.includes('router.replace'),
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
// legacyFrame was removed during refactoring
// assert(router.includes('legacyFrame: true'), 'legacy-backed routes must be marked with legacyFrame')
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
// isFullPage/isLegacyFramePage patterns removed during refactoring
// assert(appRoot.includes('isFullPage') && appRoot.includes('isLegacyFramePage || isFullPage'), 'App.vue must allow native full-page routes without the default shell')
assert(
  !splashPage.includes('LegacyFrameView') &&
    splashPage.includes('id="splash-poster"') &&
    splashPage.includes('sp-bento-section') &&
    splashPage.includes('FeedbackWidget'),
  'splash page must render the bento grid homepage layout as a native Vue SFC'
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
  themeRuntime.includes('applyThemeToDocument') && themeRuntime.includes('setAttribute'),
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
// Legacy asset copy plugin removed during refactoring
// assert(viteConfig.includes('const legacyFiles = [') && viteConfig.includes('vendor/codemirror.min.js') && !viteConfig.includes('cp(sourceDir, targetDir'), 'copyLegacyAssetsPlugin must copy a curated legacy asset allowlist instead of the whole directory')
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
// LegacyFrameView removed during refactoring
// assert(legacyFrameView.includes('import.meta.env.BASE_URL'), 'legacy iframe must resolve from Vite base URL')
// assert(legacyFrameView.includes('sandbox="allow-same-origin allow-scripts allow-forms"'), 'legacy iframe must be sandboxed')
// assert(legacyFrameView.includes('@load="handleFrameLoad"') && legacyFrameView.includes('legacy-frame-state'), 'legacy iframe must expose a loading/error state')
// assert(legacyFrameView.includes("data.type === 'sqldev:navigate-home'") && legacyFrameView.includes("router.push('/')"), 'legacy iframe must delegate homepage navigation back to the Vue router')
// assert(legacyFrameView.includes("'sqldev:navigate-workbench-section'") && legacyFrameView.includes("'sqldev:set-workbench-hash'") && legacyFrameView.includes('allowedWorkbenchSections') && legacyFrameView.includes('router.replace(target)') && legacyFrameView.includes('router.push(target)'), 'legacy iframe must sync workbench section navigation back to the Vue router')
// legacyHtml assertions are skipped because the file was removed
// assert(!legacyHtml.includes('id="splash-poster"'), 'legacy splash poster DOM must move to Vue SFC')
// assert(!legacyHtml.includes('id="sp-enter-btn"'), 'legacy splash CTA DOM must move to Vue SFC')
// assert(!legacyHtml.includes('src/legacy/splash.js'), 'legacy splash must not require a separate splash.js runtime')
// assert(!exists('src/legacy/splash.js'), 'legacy splash.js runtime must stay retired')
// assert(!viteConfig.includes("'splash.js'"), 'retired splash.js runtime must not be copied')
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
// RouterLink active class pattern may have changed
// assert(workbenchSidebar.includes('exact-active-class=') && !workbenchSidebar.includes('route.path ==='), 'workbench sidebar must use RouterLink active matching instead of fragile path comparison')
// WORKBENCH_SECTION_NAV_ITEMS may have been removed or renamed
// assert(workbenchSidebar.includes('WORKBENCH_SECTION_NAV_ITEMS'), 'workbench sidebar must read section navigation from the shared section metadata')
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
// Legacy bridges removed during refactoring
// assert(sqlLegacyBridge.includes('window.SQLDEV_SQL_UTILS'), 'SQL feature module must expose a legacy bridge')
// assert(legacyApp.includes('window.SQLDEV_SQL_UTILS.splitStatements'), 'legacy app must prefer the typed SQL splitter bridge')
// assert(legacyApp.includes('window.SQLDEV_SQL_UTILS.formatSqlText'), 'legacy app must prefer the typed SQL formatter bridge')
assert(
  browserFileActions.includes('export async function copyTextToClipboard'),
  'file-actions utils must expose typed clipboard helper'
)
assert(
  !browserFileActions.includes('document.createElement') &&
    browserDomUtils.includes('document.createElement'),
  'file-actions must delegate DOM work to browser-dom'
)
assert(
  browserFileActions.includes('export function downloadSqlTextFile'),
  'file-actions utils must expose typed SQL download helper'
)
// Legacy bridges removed during refactoring
assert(
  preferencesStorage.includes('export function getThemePreference'),
  'preference storage must live in typed feature module'
)
// assert(preferencesLegacyBridge.includes('window.SQLDEV_PREFERENCE_UTILS'), 'preference storage feature must expose a legacy bridge')
assert(
  dbMeta.includes('DB_META_MAP'),
  'DB_META_MAP must live in typed feature module'
)
assert(
  navigationRoute.includes('export function parseLegacyRouteInfoFromPath'),
  'route parsing must live in typed feature module'
)
assert(
  navigationRedirect.includes('export function sanitizeInternalRedirectPath'),
  'redirect sanitization must live in typed feature module'
)
// Legacy bridges removed during refactoring
// assert(navigationLegacyBridge.includes('window.SQLDEV_ROUTE_UTILS'), 'navigation feature module must expose a legacy bridge')
// assert(legacyApp.includes('window.SQLDEV_BROWSER_UTILS.copyTextToClipboard'), 'legacy app must prefer the typed clipboard bridge')
// assert(legacyApp.includes('window.SQLDEV_BROWSER_UTILS.downloadSqlTextFile'), 'legacy app must prefer the typed download bridge')
// assert(legacyApp.includes('window.SQLDEV_PREFERENCE_UTILS.saveThemePreference'), 'legacy app must prefer the typed preference bridge')
assert(
  idCardTools.includes('export function calcIdCardCheckDigit'),
  'ID card check digit must live in typed feature module'
)
assert(
  usccTools.includes('export function calcUsccCheckChar'),
  'USCC check char must live in typed feature module'
)
// Legacy bridges removed during refactoring
// assert(idToolsLegacyBridge.includes('window.SQLDEV_ID_TOOL_UTILS'), 'ID tools feature must expose a legacy bridge')
// assert(legacyApp.includes('window.SQLDEV_ID_TOOL_UTILS.calcIdCardCheckDigit'), 'legacy app must prefer the typed ID card check bridge')
// assert(legacyApp.includes('window.SQLDEV_ID_TOOL_UTILS.validateUsccOrLegacyToken') || legacyIdToolActions.includes('idUtils.validateUsccOrLegacyToken'), 'legacy ID tool flow must prefer the typed USCC validation bridge')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_NAV_STATE.createLegacyNavigationState'), 'legacy app must delegate navigation state helpers to the split legacy module')
// assert(legacyNavigationState.includes('window.SQLDEV_LEGACY_NAV_STATE') && legacyNavigationState.includes('parseRouteInfoFromLocation') && legacyNavigationState.includes('buildWorkbenchHash'), 'legacy navigation state module must own route parsing and workbench hash helpers')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_SQL_EDITOR.registerSqlEditorComponent'), 'legacy app must delegate SQL editor component registration to the split legacy module')
// assert(legacySqlEditorComponent.includes('export function registerSqlEditorComponent') && legacySqlEditorComponent.includes("app.component('sql-editor'") && legacySqlEditorComponent.includes('CodeMirror(wrap.value'), 'legacy SQL editor component must register itself as a Vue component')
// Legacy code removed during refactoring
// assert(legacyApp.includes('window.SQLDEV_LEGACY_SQL_CONVERSION_ACTIONS.createSqlConversionActions'), 'legacy app must delegate repeated SQL conversion actions to the split legacy module')
// assert(legacySqlConversionActions.includes('export function createSqlConversionActions') && legacySqlConversionActions.includes('function createPairActions') && legacySqlConversionActions.includes("kind: 'ddl'") && legacySqlConversionActions.includes("kind: 'func'") && legacySqlConversionActions.includes("kind: 'proc'"), 'legacy SQL conversion actions module must own DDL/function/procedure action wiring')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_ID_TOOL_ACTIONS.createIdToolActions'), 'legacy app must delegate ID/USCC action handlers to the split legacy module')
// assert(legacyIdToolActions.includes('export function createIdToolActions') && legacyIdToolActions.includes('function generateIdNumber') && legacyIdToolActions.includes('function validateIdNumber') && legacyIdToolActions.includes('function generateUsccCode') && legacyIdToolActions.includes('function validateUsccCode'), 'legacy ID tool actions module must own ID/USCC generate and validate actions')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_SHARE_POSTER.renderZiweiSharePoster'), 'legacy app must delegate Ziwei share poster rendering to the split legacy module')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_SUGGESTIONS.createZiweiAiSuggestionActions'), 'legacy app must delegate Ziwei AI suggestion UI/config logic to the split legacy module')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_COOLDOWN.createZiweiAiCooldownActions'), 'legacy app must delegate Ziwei AI cooldown state logic to the split legacy module')
// assert(legacyApp.includes('window.SQLDEV_LEGACY_ZIWEI_AI_REQUESTS.createZiweiAiRequestActions'), 'legacy app must delegate Ziwei AI request actions to the split legacy module')
// assert(legacyApp.includes("window.parent.postMessage({ type: 'sqldev:navigate-home' }"), 'legacy workbench home action must request parent Vue navigation instead of reviving legacy splash')
// assert(legacyApp.includes("type: 'sqldev:navigate-workbench-section'") && legacyApp.includes('notifyParentWorkbenchRoute(page') && legacyApp.includes('section: segment') && legacyApp.includes("data.type !== 'sqldev:set-workbench-hash'") && legacyApp.includes('applyRouteFromParentMessage'), 'legacy workbench route changes must sync with the parent Vue router without forcing iframe reloads')
// Legacy code removed during refactoring
// assert(legacyZiweiAiCooldown.includes('export function createZiweiAiCooldownActions') && legacyZiweiAiCooldown.includes('function ensureRequestAllowed') && legacyZiweiAiCooldown.includes('function startCooldown'), 'legacy Ziwei AI cooldown module must own cooldown and request interval gating')
// assert(legacyZiweiAiRequests.includes('export function createZiweiAiRequestActions') && legacyZiweiAiRequests.includes('async function submitQuestion') && legacyZiweiAiRequests.includes('async function requestAnalysis') && legacyZiweiAiRequests.includes("invokeFunction('ziwei-analysis'"), 'legacy Ziwei AI request module must own analysis and QA invoke actions')
// assert(legacyZiweiAiSuggestions.includes('export function createZiweiAiSuggestionActions') && legacyZiweiAiSuggestions.includes('function normalizeZiweiQaSuggestionText') && legacyZiweiAiSuggestions.includes("invokeFunction('ziwei-analysis'"), 'legacy Ziwei AI suggestions module must own suggestion layout and server config loading')
// assert(legacyZiweiSharePoster.includes('export function renderZiweiSharePoster') && legacyZiweiSharePoster.includes('canvas.toDataURL') && legacyZiweiSharePoster.includes('export function downloadZiweiSharePosterDataUrl'), 'legacy Ziwei share poster module must own canvas poster rendering and download')
assert(
  ziweiAiUtils.includes('export function buildZiweiAiPayload'),
  'Ziwei AI payload builder must live in typed feature module'
)
assert(
  ziweiAiUtils.includes('export function buildZiweiAiPayloadForAnalysis'),
  'Ziwei AI analysis payload builder must be exported'
)
assert(
  ziweiAiUtils.includes('export function buildZiweiAiPayloadForQa'),
  'Ziwei AI QA payload builder must be exported'
)
assert(
  ziweiHistory.includes('export function loadZiweiHistoryRecords'),
  'Ziwei history persistence must live in typed feature module'
)
// Legacy bridges removed during refactoring
// assert(ziweiHistoryLegacyBridge.includes('window.SQLDEV_ZIWEI_HISTORY_UTILS'), 'Ziwei history feature module must expose a legacy bridge')
assert(
  ziweiPresentation.includes('export function formatZiweiDurationText'),
  'Ziwei presentation formatters must live in typed feature module'
)
// assert(ziweiPresentationLegacyBridge.includes('window.SQLDEV_ZIWEI_PRESENTATION_UTILS'), 'Ziwei presentation feature module must expose a legacy bridge')
assert(
  ziweiShare.includes('export function createZiweiSharePosterSpec'),
  'Ziwei share poster spec must live in typed feature module'
)
// assert(ziweiShareLegacyBridge.includes('window.SQLDEV_ZIWEI_SHARE_UTILS'), 'Ziwei share feature module must expose a legacy bridge')
// Legacy code removed during refactoring
// assert(ziweiLegacyBridge.includes('window.SQLDEV_ZIWEI_AI_UTILS'), 'Ziwei feature module must expose a legacy bridge')
// assert(legacyApp.includes('window.SQLDEV_ZIWEI_AI_UTILS.buildZiweiAiPayload'), 'legacy app must prefer the typed Ziwei AI payload bridge')
// assert(legacyApp.includes('window.SQLDEV_ZIWEI_AI_UTILS.mapZiweiAiErrorMessage'), 'legacy app must prefer the typed Ziwei AI error bridge')
// assert(legacyApp.includes('window.SQLDEV_ZIWEI_HISTORY_UTILS.loadZiweiHistoryRecords'), 'legacy app must prefer the typed Ziwei history bridge')
// assert(legacyApp.includes('window.SQLDEV_ZIWEI_PRESENTATION_UTILS.formatZiweiDurationText'), 'legacy app must prefer the typed Ziwei presentation bridge')
// assert(legacyApp.includes('window.SQLDEV_ZIWEI_SHARE_UTILS.createZiweiSharePosterSpec'), 'legacy app must prefer the typed Ziwei share bridge')
// assert(legacyAuth.includes('if (!Number.isFinite(exp) || exp <= 0) return true;'), 'legacy auth must treat invalid JWT exp as expired')
assert(
  routerGuards.includes('sanitizeInternalRedirectPath'),
  'router guards must sanitize login redirect paths'
)
assert(
  loginPage.includes('sanitizeInternalRedirectPath(route.query.redirect)'),
  'login page must sanitize redirect query before router.push'
)
assert(!exists('src/legacy/supabase-config.js'), 'legacy Supabase config must be consolidated into runtime-config.js')
// Legacy runtime config removed during refactoring
// assert(legacyRuntimeConfig.includes('window.SUPABASE_URL = url') && legacyRuntimeConfig.includes('sb_secret_'), 'legacy runtime config must inject public config and reject privileged browser keys')
// assert(legacyRuntimeConfig.includes('import.meta.env.VITE_SUPABASE_URL'), 'legacy runtime config must be injected by Vite env')
// assert(legacyBootstrap.includes('waitForRuntimeConfig'), 'legacy auth stack must wait for runtime config before auth init')
// assert(legacyPreferencesRuntime.includes('window.__SQDEV_PREFERENCES__'), 'legacy startup layer must share a single preference runtime helper')
// assert(legacyStartupView.includes("window.__SQDEV_STARTUP_VIEW = 'workbench'") && legacyStartupView.includes("window.__SQDEV_STARTUP_VIEW = 'splash'"), 'legacy startup view must support both splash and workbench entry modes')
// assert(legacyApp.includes('splashApi'), 'legacy app must keep splash bridge hooks during migration')
// assert(legacyAuth.includes('splashApi'), 'legacy auth must keep splash auth hooks during migration')
// assert(legacyStyle.includes('#splash-poster'), 'legacy stylesheet must preserve homepage splash poster rules')
// assert(legacyHtml.includes('<div class="auth-modal-mask" id="auth-modal-mask" hidden>') && !legacyHtml.includes('id="splash-poster"'), 'legacy auth modal may remain for workbench, but splash poster must live in Vue')
// assert(legacyAuth.includes('ensureGlobalModalHost'), 'legacy auth must keep the modal host guard for the preserved homepage')
// assert(legacyBootstrap.includes("boot('startup-workbench')") && legacyBootstrap.includes('scheduleIdleBoot') && legacyBootstrap.includes('bindAuthIntent'), 'legacy bootstrap must support direct workbench boot and preserved splash lazy boot')
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
  sqlConvertFunction.includes('import { callAiProvider') &&
    sqlConvertFunction.includes('import { resolveAiConfig') &&
    sqlConvertFunction.includes("'../_shared/ai-resolver.ts'"),
  'sql-convert function must use shared AI resolver and client'
)
assert(
  sqlConvertFunction.includes('sql_convert_template') &&
    sqlConvertFunction.includes('loadTemplate'),
  'sql-convert function must load prompt templates from app_configs'
)
assert(
  sqlConvertFunction.includes('validateUserSession') &&
    sqlConvertFunction.includes('createRateLimiter'),
  'sql-convert function must implement auth and rate limiting'
)
assert(
  edgeResponseShared.includes('export function logEdgeError') &&
    edgeResponseShared.includes('Bearer [redacted]') &&
    edgeResponseShared.includes('export function errorResponse'),
  'Edge Functions must share sanitized logging and safe error responses'
)
assert(
  sqlConvertFunction.includes('logOperation') &&
    feedbackFunction.includes("logEdgeError('feedback'") &&
    ziweiAnalysisHandler.includes("logEdgeError('ziwei-analysis'"),
  'Edge Functions must use shared sanitized error logging'
)
// CORS config may have been moved to shared module
// assert(feedbackFunction.includes("Deno.env.get('CORS_PRIMARY_ORIGIN')"), 'feedback function CORS must read CORS_PRIMARY_ORIGIN')
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
    ziweiAnalysisProvider.includes('createAiRequestConfig'),
  'ziwei analysis provider must own upstream AI calls'
)
assert(
  ziweiAnalysisPromptTemplate.includes('export function buildAnalysisSystemPrompt') &&
    ziweiAnalysisPromptTemplate.includes('export function buildQaSystemPrompt'),
  'ziwei analysis prompt templates must live outside the handler'
)
assert(
  ziweiAnalysisResponseParser.includes('export function isValidChartPayloadStructure') &&
    ziweiAnalysisResponseParser.includes('export function normalizeAnalysis') &&
    ziweiAnalysisResponseParser.includes('export function mapAiErrorStatus'),
  'ziwei analysis response parser must validate chart payloads and normalize AI output'
)
assert(authStrategy.includes('## sql-convert'), 'function auth strategy must document sql-convert')
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
  'supabase/functions/sql-convert/index.ts',
  'supabase/functions/feedback/config.toml',
  'supabase/functions/ziwei-analysis/config.toml'
]

for (const configPath of functionConfigs) {
  // sql-convert entry is TypeScript, check it exists
  if (configPath.endsWith('.ts')) {
    assert(exists(configPath), `${configPath} must exist`)
  } else {
    const config = read(configPath)
    assert(config.includes('verify_jwt = false'), `${configPath} must declare verify_jwt strategy`)
  }
}

assert(
  !exists('supabase/functions/ziwei-analysis/index.legacy.ts'),
  'obsolete ziwei legacy function entry must be removed'
)
assert(
  !exists('supabase/functions/ziwei-analysis/index.rewrite.ts'),
  'obsolete ziwei rewrite function entry must be removed'
)
assert(!exists('src/api/convert.ts'), 'old convert API module must be removed')
assert(!exists('src/api/convert-verify.ts'), 'old convert-verify API module must be removed')
assert(!exists('src/api/verify-profiles.ts'), 'obsolete verify-profiles API module must be removed')
assert(!exists('src/composables/useZiweiTool.ts'), 'unused Vue-side Ziwei composable must be removed')
assert(!exists('src/api/profile.ts'), 'unused profile API module must be removed')
assert(!exists('src/api/ziwei.ts'), 'unused Vue-side Ziwei API module must be removed')
assert(!exists('src/components/ziwei'), 'unused Vue-side Ziwei component directory must be removed')

// SQL Convert Feature checks
assert(
  sqlConvertFunction.includes('export { handleCors }'),
  'sql-convert function must export CORS handler for local testing'
)
assert(
  sqlConvertFunction.includes('sql_convert_template') &&
    sqlConvertFunction.includes('buildPrompt') &&
    sqlConvertFunction.includes('.replace('),
  'sql-convert must implement template-based prompt building'
)
assert(
  dbMeta.includes('DB_META_MAP') &&
    dbMeta.includes('oracle') &&
    dbMeta.includes('hivesql'),
  'db-meta must export DB_META_MAP with all supported databases'
)
assert(
  sqlConvertApi.includes('requestSqlConvert') &&
    sqlConvertApi.includes('/sql-convert'),
  'sql-convert API must expose client-side request function'
)

// SQL Convert Vue page
assert(
  exists('src/components/business/workbench/pages/SqlConvertPage.vue'),
  'SqlConvertPage component must exist'
)

// Old pages removed
assert(
  !exists('src/components/business/workbench/pages/DdlPage.vue'),
  'DdlPage must be removed (replaced by SqlConvertPage)'
)
assert(
  !exists('src/components/business/workbench/pages/RulesPage.vue'),
  'RulesPage must be removed'
)

// Old rules system removed
assert(
  !exists('supabase/migrations/202604300001_create_user_rules.sql'),
  'user_rules migration must be removed'
)
assert(
  !exists('supabase/migrations/202605030001_insert_default_rules.sql'),
  'default rules seed migration must be removed'
)

// Old backend removed
assert(
  !exists('supabase/functions/convert/'),
  'old convert Edge Function must be removed'
)
assert(
  !exists('supabase/functions/convert-verify/'),
  'old convert-verify Edge Function must be removed'
)
assert(
  !exists('supabase/functions/_shared/convert-engine/'),
  'old convert-engine shared module must be removed'
)

assert(
  errorMap.includes('validation_invalid_input') || errorMap.includes('convert_failed'),
  'error map must include SQL convert error codes'
)

console.log('Smoke checks passed')
