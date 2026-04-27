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
const router = read('src/router/index.ts')
const appEntry = read('src/main.ts')
const appRoot = read('src/App.vue')
const routerGuards = read('src/router/guards.ts')
const viteConfig = read('vite.config.mjs')
const apiHttp = read('src/api/http.ts')
const supabaseClient = read('src/lib/supabase.ts')
const typeIndex = read('src/types/index.ts')
const legacySupabaseTypes = read('src/types/supabase.ts')
const authComposable = read('src/composables/useAuth.ts')
const loginPage = read('src/pages/auth/login.vue')
const legacyFrameView = read('src/components/business/legacy/LegacyFrameView.vue')
const legacyApp = read('src/legacy/app.js')
const legacySupabaseConfig = read('src/legacy/supabase-config.js')
const legacyRuntimeConfig = read('src/legacy/runtime-config.js')
const legacyBootstrap = read('src/legacy/bootstrap.js')
const legacyPreferencesRuntime = read('src/legacy/preferences-runtime.js')
const migration = read('supabase/migrations/202604230001_create_feedback_entries.sql')
const authStrategy = read('supabase/FUNCTION-AUTH-STRATEGY.md')
const sqlFormat = read('src/features/sql/sql-format.ts')
const sqlLegacyBridge = read('src/features/sql/legacy-bridge.ts')
const ddlParserUtils = read('src/features/ddl/parser-utils.ts')
const ddlColumnParsers = read('src/features/ddl/column-parsers.ts')
const ddlTableConstraintParsers = read('src/features/ddl/table-constraint-parsers.ts')
const ddlPostprocess = read('src/features/ddl/postprocess.ts')
const ddlTypeMapping = read('src/features/ddl/type-mapping.ts')
const ddlOutputBuilders = read('src/features/ddl/output-builders.ts')
const ddlExtraDdl = read('src/features/ddl/extra-ddl.ts')
const ddlConversionOrchestrator = read('src/features/ddl/conversion-orchestrator.ts')
const ddlViewGenerators = read('src/features/ddl/view-generators.ts')
const ddlViewParsing = read('src/features/ddl/view-parsing.ts')
const ddlLegacyBridge = read('src/features/ddl/legacy-bridge.ts')
const convertErrorMap = read('src/features/convert/error-map.ts')
const convertLegacyBridge = read('src/features/convert/legacy-bridge.ts')
const browserFileActions = read('src/features/browser/file-actions.ts')
const browserLegacyBridge = read('src/features/browser/legacy-bridge.ts')
const preferencesStorage = read('src/features/preferences/storage.ts')
const bodyTransformRules = read('src/features/rules/body-transform.ts')
const preferencesLegacyBridge = read('src/features/preferences/legacy-bridge.ts')
const rulesPersistence = read('src/features/rules/persistence.ts')
const rulesLegacyBridge = read('src/features/rules/legacy-bridge.ts')
const routineParserPrimitives = read('src/features/routines/parser-primitives.ts')
const routineFunctionParsers = read('src/features/routines/function-parsers.ts')
const routineProcedureParsers = read('src/features/routines/procedure-parsers.ts')
const routineConversionOrchestrator = read('src/features/routines/conversion-orchestrator.ts')
const routinesLegacyBridge = read('src/features/routines/legacy-bridge.ts')
const navigationRoute = read('src/features/navigation/legacy-route.ts')
const navigationPageState = read('src/features/navigation/page-state.ts')
const navigationWorkbenchState = read('src/features/navigation/workbench-state.ts')
const navigationWorkbenchActions = read('src/features/navigation/workbench-actions.ts')
const navigationEventDecisions = read('src/features/navigation/event-decisions.ts')
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
const routineGenerators = read('src/features/routines/generators.ts')
const routineGeneratorsTest = read('tests/routine-generators.mjs')
const sqlFormatTest = read('tests/sql-format.mjs')
const ddlParserUtilsTest = read('tests/ddl-parser-utils.mjs')
const ddlColumnParsersTest = read('tests/ddl-column-parsers.mjs')
const ddlTableConstraintParsersTest = read('tests/ddl-table-constraint-parsers.mjs')
const ddlPostprocessTest = read('tests/ddl-postprocess.mjs')
const ddlTypeMappingTest = read('tests/ddl-type-mapping.mjs')
const ddlOutputBuildersTest = read('tests/ddl-output-builders.mjs')
const ddlExtraDdlTest = read('tests/ddl-extra-ddl.mjs')
const ddlConversionOrchestratorTest = read('tests/ddl-conversion-orchestrator.mjs')
const ddlViewGeneratorsTest = read('tests/ddl-view-generators.mjs')
const ddlViewParsingTest = read('tests/ddl-view-parsing.mjs')
const convertErrorMapTest = read('tests/convert-error-map.mjs')
const browserFileActionsTest = read('tests/browser-file-actions.mjs')
const bodyTransformRulesTest = read('tests/body-transform.mjs')
const routineParserPrimitivesTest = read('tests/routine-parser-primitives.mjs')
const routineFunctionParsersTest = read('tests/routine-function-parsers.mjs')
const routineProcedureParsersTest = read('tests/routine-procedure-parsers.mjs')
const routineConversionOrchestratorTest = read('tests/routine-conversion-orchestrator.mjs')
const preferencesStorageTest = read('tests/preferences-storage.mjs')
const rulesPersistenceTest = read('tests/rules-persistence.mjs')
const idToolsTest = read('tests/id-tools.mjs')
const navigationRouteTest = read('tests/navigation-route.mjs')
const navigationPageStateTest = read('tests/navigation-page-state.mjs')
const navigationWorkbenchHelpersTest = read('tests/navigation-workbench-helpers.mjs')
const ziweiHistoryTest = read('tests/ziwei-history.mjs')
const ziweiPresentationTest = read('tests/ziwei-presentation.mjs')
const ziweiShareTest = read('tests/ziwei-share.mjs')
const ziweiAiUtilsTest = read('tests/ziwei-ai-utils.mjs')
const testHelper = read('tests/helpers/load-ts-module.mjs')

assert(indexHtml.includes('/src/main.ts'), 'index.html must load the Vue app entry')
assert(!exists('index.vite.html'), 'obsolete index.vite.html redirect shell must be removed')
if (exists('test.html')) {
  assert(testHtml.includes('Deprecated Preview'), 'test.html must be an explicit deprecated preview notice')
}
assert(prettierIgnore.includes('legacy.html'), 'Prettier must ignore legacy.html to avoid noisy formatting churn')
assert(prettierIgnore.includes('src/legacy/**'), 'Prettier must ignore legacy runtime files during migration')
assert(
  legacyHtml.includes('src/legacy/bootstrap.js'),
  'legacy.html must retain the legacy bootstrap script'
)
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
  legacyHtml.includes('src/features/ddl/legacy-bridge.ts'),
  'legacy.html must load the typed DDL utility bridge before legacy app boot'
)
assert(
  legacyHtml.includes('src/features/convert/legacy-bridge.ts'),
  'legacy.html must load the typed convert utility bridge before legacy app boot'
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
  legacyHtml.includes('src/features/routines/legacy-bridge.ts'),
  'legacy.html must load the typed routine parser bridge before legacy app boot'
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
  !legacyHtml.includes('loadRuntimeSupabaseConfig'),
  'legacy.html must not rely on CSP-blocked inline runtime config'
)
assert(router.includes("path: '/workbench/ziwei'"), 'router must expose the Ziwei workbench route')
assert(router.includes('legacyFrame: true'), 'legacy-backed routes must be marked with legacyFrame')
assert(
  appEntry.includes('setupRouterGuards(router)'),
  'router guards must be installed after Pinia is active'
)
assert(
  appRoot.includes('@/layouts/DefaultLayout.vue'),
  'App.vue must delegate shell layout to DefaultLayout'
)
assert(
  appRoot.includes('@/layouts/AuthLayout.vue'),
  'App.vue must delegate auth pages to AuthLayout'
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
assert(
  legacySupabaseTypes.trim() === "export type { Database, Json } from './database.types'",
  'obsolete supabase.ts type file must be a compatibility re-export only'
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
assert(
  apiHttp.includes('@/utils/error-map'),
  'API client must use the centralized error message mapper'
)
assert(
  apiHttp.includes('parsed.code'),
  'API client must accept normalized error codes from Edge Functions'
)
assert(
  viteConfig.includes("base: './'"),
  'vite base must stay relative for sub-path static hosting'
)
assert(
  legacyFrameView.includes('import.meta.env.BASE_URL'),
  'legacy iframe must resolve from Vite base URL'
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
  ddlParserUtils.includes('export function splitColumnDefinitions'),
  'DDL parser helpers must live in typed feature module'
)
assert(
  ddlParserUtils.includes('export function extractCreateTableSections'),
  'DDL create-table section extractor must live in typed feature module'
)
assert(
  ddlColumnParsers.includes('export function parseOracleColumnDefinition'),
  'DDL column parsers must live in typed feature module'
)
assert(
  ddlTableConstraintParsers.includes('export function parseOracleTableConstraintDefinition'),
  'DDL table constraint parsers must live in typed feature module'
)
assert(
  ddlTypeMapping.includes('export function mapDdlTypeByRules'),
  'DDL type mapping helpers must live in typed feature module'
)
assert(
  ddlOutputBuilders.includes('export function buildOracleCommentLines'),
  'DDL output builder helpers must live in typed feature module'
)
assert(
  ddlExtraDdl.includes('export function parseExtraDdlStatements'),
  'DDL extra parser/generator helpers must live in typed feature module'
)
assert(
  ddlConversionOrchestrator.includes('export function convertDdlOrchestrated'),
  'DDL conversion orchestrator must live in typed feature module'
)
assert(
  ddlViewGenerators.includes('export function generateOracleViewStatements'),
  'DDL view generator helpers must live in typed feature module'
)
assert(
  ddlViewParsing.includes('export function parseViewStatements'),
  'DDL view parsing helpers must live in typed feature module'
)
assert(
  ddlPostprocess.includes('export function applyOracleCommentStatements'),
  'DDL postprocess helpers must live in typed feature module'
)
assert(
  ddlLegacyBridge.includes('window.SQLDEV_DDL_UTILS'),
  'DDL helper feature module must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_SQL_UTILS.splitStatements'),
  'legacy app must prefer the typed SQL splitter bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.splitColumnDefinitions'),
  'legacy app must prefer the typed DDL helper bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.extractCreateTableSections'),
  'legacy app must prefer the typed DDL create-table section bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.parseOracleColumnDefinition'),
  'legacy app must prefer the typed DDL column parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.parseOracleTableConstraintDefinition'),
  'legacy app must prefer the typed DDL table constraint parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.mapDdlTypeByRules'),
  'legacy app must prefer the typed DDL type mapping bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.buildOracleCommentLines'),
  'legacy app must prefer the typed DDL output builder bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.parseExtraDdlStatements'),
  'legacy app must prefer the typed DDL extra parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.convertDdlOrchestrated'),
  'legacy app must prefer the typed DDL conversion orchestrator bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.generateOracleViewStatements'),
  'legacy app must prefer the typed DDL view generator bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.parseViewStatements'),
  'legacy app must prefer the typed DDL view parsing bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_DDL_UTILS.applyOracleCommentStatements'),
  'legacy app must prefer the typed DDL postprocess bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_SQL_UTILS.formatSqlText'),
  'legacy app must prefer the typed SQL formatter bridge'
)
assert(
  convertErrorMap.includes('export function mapConvertErrorMessage'),
  'convert error mapping must live in the typed feature module'
)
assert(
  convertLegacyBridge.includes('window.SQLDEV_CONVERT_UTILS'),
  'convert feature module must expose a legacy bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_CONVERT_UTILS.mapConvertErrorMessage'),
  'legacy app must prefer the typed convert error mapper bridge'
)
assert(
  browserFileActions.includes('export async function copyTextToClipboard'),
  'browser file actions must expose typed clipboard helper'
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
  bodyTransformRules.includes('export function transformBodyByRules'),
  'body rule transform helpers must live in typed feature module'
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
  routineParserPrimitives.includes('export function splitRoutineParamList'),
  'routine parsing primitives must live in typed feature module'
)
assert(
  routineParserPrimitives.includes('export function extractMySqlRoutineDeclarations'),
  'routine declaration extraction must live in typed feature module'
)
assert(
  routineFunctionParsers.includes('export function parseOracleFunctionDefinition'),
  'routine function parsing must live in typed feature module'
)
assert(
  routineProcedureParsers.includes('export function parseOracleProcedureDefinition'),
  'routine procedure parsing must live in typed feature module'
)
assert(
  routineConversionOrchestrator.includes('export function convertFunctionOrchestrated'),
  'routine function conversion orchestration must live in typed feature module'
)
assert(
  routineConversionOrchestrator.includes('export function convertProcedureOrchestrated'),
  'routine procedure conversion orchestration must live in typed feature module'
)
assert(
  routinesLegacyBridge.includes('window.SQLDEV_ROUTINE_UTILS'),
  'routine parsing feature must expose a legacy bridge'
)
assert(
  navigationRoute.includes('export function parseLegacyRouteInfoFromPath'),
  'route parsing must live in typed feature module'
)
assert(
  navigationPageState.includes('export function resolveLegacyPageTransition'),
  'page state transition logic must live in typed navigation feature module'
)
assert(
  navigationWorkbenchState.includes('export function resolveLegacySidebarHoverState'),
  'sidebar hover state logic must live in typed navigation feature module'
)
assert(
  navigationWorkbenchState.includes('export function resolveLegacyTestToolsMenuToggleState'),
  'test tools menu toggle logic must live in typed navigation feature module'
)
assert(
  navigationWorkbenchActions.includes('export function resolveLegacyWorkbenchActionDecision'),
  'workbench action decision logic must live in typed navigation feature module'
)
assert(
  navigationEventDecisions.includes('export function resolveLegacyOutsideClickDecision'),
  'outside click decision logic must live in typed navigation feature module'
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
  legacyApp.includes('window.SQLDEV_RULE_STORAGE_UTILS.transformBodyByRules'),
  'legacy app must prefer the typed body transform bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parseOracleRoutineParam'),
  'legacy app must prefer the typed routine parameter parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.splitRoutineParamList'),
  'legacy app must prefer the typed routine parameter list bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.extractMySqlRoutineDeclarations'),
  'legacy app must prefer the typed MySQL routine declaration bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.extractPostgresRoutineDeclarations'),
  'legacy app must prefer the typed PostgreSQL routine declaration bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parseOracleFunctionDefinition'),
  'legacy app must prefer the typed Oracle routine function parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parseMySqlFunctionDefinition'),
  'legacy app must prefer the typed MySQL routine function parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parsePostgresFunctionDefinition'),
  'legacy app must prefer the typed PostgreSQL routine function parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parseOracleProcedureDefinition'),
  'legacy app must prefer the typed Oracle routine procedure parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parseMySqlProcedureDefinition'),
  'legacy app must prefer the typed MySQL routine procedure parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.parsePostgresProcedureDefinition'),
  'legacy app must prefer the typed PostgreSQL routine procedure parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.convertFunctionOrchestrated'),
  'legacy app must prefer the typed routine function orchestration bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTINE_UTILS.convertProcedureOrchestrated'),
  'legacy app must prefer the typed routine procedure orchestration bridge'
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
  legacyApp.includes('window.SQLDEV_ID_TOOL_UTILS.validateUsccOrLegacyToken'),
  'legacy app must prefer the typed USCC validation bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.parseLegacyRouteInfoFromLocation'),
  'legacy app must prefer the typed route parser bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.normalizeAccessibleLegacyPage'),
  'legacy app must prefer the typed page accessibility bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacyPageTransition'),
  'legacy app must prefer the typed page transition bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacySidebarHoverState'),
  'legacy app must prefer the typed sidebar hover state bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacyTestToolsMenuToggleState'),
  'legacy app must prefer the typed test tools menu toggle bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacyWorkbenchActionDecision'),
  'legacy app must prefer the typed workbench action decision bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacyPrimaryHotkeyTarget'),
  'legacy app must prefer the typed primary hotkey decision bridge'
)
assert(
  legacyApp.includes('window.SQLDEV_ROUTE_UTILS.resolveLegacyOutsideClickDecision'),
  'legacy app must prefer the typed outside click decision bridge'
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
  !legacySupabaseConfig.includes('DEFAULT_PUBLIC_SUPABASE_URL'),
  'legacy auth must not hardcode Supabase fallback config'
)
assert(
  legacySupabaseConfig.includes('sb_secret_'),
  'legacy Supabase config must reject secret browser keys'
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
  migration.includes('create table if not exists public.feedback_entries'),
  'feedback migration must create feedback_entries'
)
assert(migration.includes('enable row level security'), 'feedback migration must enable RLS')
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
assert(testHelper.includes('export function loadTsModule'), 'TS module test loader must be shared')
for (const testFile of [sqlFormatTest, ddlParserUtilsTest, ddlColumnParsersTest, ddlTableConstraintParsersTest, ddlPostprocessTest, ddlTypeMappingTest, ddlOutputBuildersTest, ddlExtraDdlTest, ddlConversionOrchestratorTest, ddlViewGeneratorsTest, ddlViewParsingTest, convertErrorMapTest, browserFileActionsTest, bodyTransformRulesTest, routineParserPrimitivesTest, routineFunctionParsersTest, routineProcedureParsersTest, routineConversionOrchestratorTest, preferencesStorageTest, rulesPersistenceTest, idToolsTest]) {
  assert(testFile.includes('./helpers/load-ts-module.mjs'), 'feature tests must reuse the shared TS module loader')
}
for (const testFile of [navigationRouteTest, navigationPageStateTest, navigationWorkbenchHelpersTest, ziweiHistoryTest, ziweiPresentationTest, ziweiShareTest, ziweiAiUtilsTest]) {
  assert(testFile.includes('./helpers/load-ts-module.mjs'), 'new feature tests must reuse the shared TS module loader')
}

const functionConfigs = [
  'supabase/functions/convert/config.toml',
  'supabase/functions/feedback/config.toml',
  'supabase/functions/ziwei-analysis/config.toml'
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

console.log('Smoke checks passed')
