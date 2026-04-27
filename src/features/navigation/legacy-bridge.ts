import {
  buildLegacyWorkbenchHash,
  normalizeLegacyRoutePath,
  parseLegacyRouteInfoFromLocation,
  parseLegacyRouteInfoFromPath
} from './legacy-route'
import {
  normalizeAccessibleLegacyPage,
  normalizeLegacyPageKey,
  resolveLegacyPageTransition
} from './page-state'
import {
  resolveLegacySidebarHoverState,
  resolveLegacyTestToolsMenuToggleState,
  shouldLegacyCloseSidebarForSplash
} from './workbench-state'
import {
  resolveLegacyPrimaryActionHandlerName,
  resolveLegacyPrimaryWorkbenchPage,
  resolveLegacyWorkbenchActionDecision
} from './workbench-actions'
import {
  resolveLegacyMenuKeyDecision,
  resolveLegacyOutsideClickDecision,
  resolveLegacyPrimaryHotkeyTarget,
  shouldLegacyCloseRulesMenuOnEscape
} from './event-decisions'
import {
  resolveLegacySplashHashSyncDecision,
  resolveLegacySplashHomeTransition,
  resolveLegacyWorkbenchVisibilityDecision
} from './workbench-effects'
import { resolveLegacyRouteApplicationDecision } from './route-application'
import { resolveLegacyRouteSyncDecision } from './route-sync'

declare global {
  interface Window {
    SQLDEV_ROUTE_UTILS?: {
      buildLegacyWorkbenchHash: typeof buildLegacyWorkbenchHash
      normalizeAccessibleLegacyPage: typeof normalizeAccessibleLegacyPage
      normalizeLegacyPageKey: typeof normalizeLegacyPageKey
      normalizeLegacyRoutePath: typeof normalizeLegacyRoutePath
      parseLegacyRouteInfoFromLocation: typeof parseLegacyRouteInfoFromLocation
      parseLegacyRouteInfoFromPath: typeof parseLegacyRouteInfoFromPath
      resolveLegacyMenuKeyDecision: typeof resolveLegacyMenuKeyDecision
      resolveLegacyOutsideClickDecision: typeof resolveLegacyOutsideClickDecision
      resolveLegacyPageTransition: typeof resolveLegacyPageTransition
      resolveLegacyPrimaryHotkeyTarget: typeof resolveLegacyPrimaryHotkeyTarget
      resolveLegacyPrimaryActionHandlerName: typeof resolveLegacyPrimaryActionHandlerName
      resolveLegacyPrimaryWorkbenchPage: typeof resolveLegacyPrimaryWorkbenchPage
      resolveLegacySidebarHoverState: typeof resolveLegacySidebarHoverState
      resolveLegacyTestToolsMenuToggleState: typeof resolveLegacyTestToolsMenuToggleState
      resolveLegacyWorkbenchActionDecision: typeof resolveLegacyWorkbenchActionDecision
      shouldLegacyCloseRulesMenuOnEscape: typeof shouldLegacyCloseRulesMenuOnEscape
      shouldLegacyCloseSidebarForSplash: typeof shouldLegacyCloseSidebarForSplash
      resolveLegacyWorkbenchVisibilityDecision: typeof resolveLegacyWorkbenchVisibilityDecision
      resolveLegacySplashHomeTransition: typeof resolveLegacySplashHomeTransition
      resolveLegacySplashHashSyncDecision: typeof resolveLegacySplashHashSyncDecision
      resolveLegacyRouteApplicationDecision: typeof resolveLegacyRouteApplicationDecision
      resolveLegacyRouteSyncDecision: typeof resolveLegacyRouteSyncDecision
    }
  }
}

window.SQLDEV_ROUTE_UTILS = Object.freeze({
  buildLegacyWorkbenchHash,
  normalizeAccessibleLegacyPage,
  normalizeLegacyPageKey,
  normalizeLegacyRoutePath,
  parseLegacyRouteInfoFromLocation,
  parseLegacyRouteInfoFromPath,
  resolveLegacyMenuKeyDecision,
  resolveLegacyOutsideClickDecision,
  resolveLegacyPageTransition,
  resolveLegacyPrimaryHotkeyTarget,
  resolveLegacyPrimaryActionHandlerName,
  resolveLegacyPrimaryWorkbenchPage,
  resolveLegacySidebarHoverState,
  resolveLegacyTestToolsMenuToggleState,
  resolveLegacyWorkbenchActionDecision,
  resolveLegacyWorkbenchVisibilityDecision,
  resolveLegacySplashHomeTransition,
  resolveLegacySplashHashSyncDecision,
  resolveLegacyRouteApplicationDecision,
  resolveLegacyRouteSyncDecision,
  shouldLegacyCloseRulesMenuOnEscape,
  shouldLegacyCloseSidebarForSplash
})
