import { loadTsModule } from './helpers/load-ts-module.mjs'

const workbenchState = loadTsModule('src/features/navigation/workbench-state.ts')
const workbenchActions = loadTsModule('src/features/navigation/workbench-actions.ts')
const eventDecisions = loadTsModule('src/features/navigation/event-decisions.ts')
const workbenchEffects = loadTsModule('src/features/navigation/workbench-effects.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  workbenchState.resolveLegacySidebarHoverState(true, { windowWidth: 800, mobileBreakpoint: 1024 }),
  {
    shouldIgnore: true,
    nextSidebarOpen: false,
    shouldCloseSettings: false
  },
  'sidebar hover should be ignored on mobile width'
)

assertEqual(
  workbenchState.resolveLegacyTestToolsMenuToggleState(true, {
    activePage: 'ziweiTool',
    testToolPages: ['idTool', 'ziweiTool'],
    fallbackPage: 'ddl'
  }),
  {
    nextExpanded: false,
    nextPage: 'ddl'
  },
  'closing test tools menu on a test page should fallback to ddl'
)

assertEqual(
  workbenchActions.resolveLegacyPrimaryWorkbenchPage('func'),
  'func',
  'primary action should allow function page'
)

assertEqual(
  workbenchActions.resolveLegacyWorkbenchActionDecision('proc', 'copy'),
  {
    type: 'invoke',
    handlerName: 'copyProcOutput'
  },
  'proc copy action should map to copyProcOutput handler'
)

assertEqual(
  eventDecisions.resolveLegacyPrimaryHotkeyTarget({
    key: 'Enter',
    ctrlKey: true,
    metaKey: false,
    hasBlockingModal: false,
    activePage: 'ddl'
  }),
  'ddl',
  'Ctrl+Enter should trigger ddl primary action when no modal is open'
)

assertEqual(
  eventDecisions.resolveLegacyOutsideClickDecision({
    showRulesMenu: true,
    ziweiAiSuggestionOpen: true,
    clickedInSettingsDropdown: true,
    clickedInZiweiInputWrap: false
  }),
  {
    shouldCloseRulesMenu: false,
    shouldCloseZiweiAiSuggestion: true
  },
  'outside click decision should close only panels clicked outside'
)

assertEqual(
  workbenchEffects.resolveLegacyWorkbenchVisibilityDecision({
    isSplashActive: true,
    hasEnterWorkbenchApi: false
  }),
  {
    shouldSkip: false,
    shouldUseEnterWorkbenchApi: false
  },
  'workbench visibility decision should keep DOM fallback when splash api is unavailable'
)

assertEqual(
  workbenchEffects.resolveLegacySplashHomeTransition({
    windowWidth: 900,
    mobileBreakpoint: 1024,
    hasSplashApiShowHome: true
  }),
  {
    shouldCloseSidebar: true,
    shouldUseSplashApiShowHome: true
  },
  'splash home transition should close sidebar on mobile and use splash API when available'
)

assertEqual(
  workbenchEffects.resolveLegacySplashHashSyncDecision('#workbench/ddl', '#splash/home', true),
  {
    shouldSyncRoute: true,
    shouldUseHistoryReplaceState: true
  },
  'splash hash sync decision should request route sync and replaceState when hash differs'
)

console.log('Navigation workbench helper tests passed')
