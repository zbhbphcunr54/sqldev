export {
  buildLegacyWorkbenchHash,
  normalizeLegacyRoutePath,
  parseLegacyRouteInfoFromLocation,
  parseLegacyRouteInfoFromPath
} from './legacy-route'
export {
  normalizeAccessibleLegacyPage,
  normalizeLegacyPageKey,
  resolveLegacyPageTransition
} from './page-state'
export {
  resolveLegacySidebarHoverState,
  resolveLegacyTestToolsMenuToggleState,
  shouldLegacyCloseSidebarForSplash
} from './workbench-state'
export {
  resolveLegacyPrimaryWorkbenchPage,
  resolveLegacyWorkbenchActionDecision
} from './workbench-actions'
export {
  resolveLegacyOutsideClickDecision,
  resolveLegacyPrimaryHotkeyTarget,
  shouldLegacyCloseRulesMenuOnEscape
} from './event-decisions'
export {
  resolveLegacySplashHashSyncDecision,
  resolveLegacySplashHomeTransition,
  resolveLegacyWorkbenchVisibilityDecision
} from './workbench-effects'
