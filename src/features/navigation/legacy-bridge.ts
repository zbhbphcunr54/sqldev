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
  resolveLegacyPrimaryWorkbenchPage,
  resolveLegacyWorkbenchActionDecision
} from './workbench-actions'
import {
  resolveLegacyOutsideClickDecision,
  resolveLegacyPrimaryHotkeyTarget,
  shouldLegacyCloseRulesMenuOnEscape
} from './event-decisions'

declare global {
  interface Window {
    SQLDEV_ROUTE_UTILS?: {
      buildLegacyWorkbenchHash: typeof buildLegacyWorkbenchHash
      normalizeAccessibleLegacyPage: typeof normalizeAccessibleLegacyPage
      normalizeLegacyPageKey: typeof normalizeLegacyPageKey
      normalizeLegacyRoutePath: typeof normalizeLegacyRoutePath
      parseLegacyRouteInfoFromLocation: typeof parseLegacyRouteInfoFromLocation
      parseLegacyRouteInfoFromPath: typeof parseLegacyRouteInfoFromPath
      resolveLegacyOutsideClickDecision: typeof resolveLegacyOutsideClickDecision
      resolveLegacyPageTransition: typeof resolveLegacyPageTransition
      resolveLegacyPrimaryHotkeyTarget: typeof resolveLegacyPrimaryHotkeyTarget
      resolveLegacyPrimaryWorkbenchPage: typeof resolveLegacyPrimaryWorkbenchPage
      resolveLegacySidebarHoverState: typeof resolveLegacySidebarHoverState
      resolveLegacyTestToolsMenuToggleState: typeof resolveLegacyTestToolsMenuToggleState
      resolveLegacyWorkbenchActionDecision: typeof resolveLegacyWorkbenchActionDecision
      shouldLegacyCloseRulesMenuOnEscape: typeof shouldLegacyCloseRulesMenuOnEscape
      shouldLegacyCloseSidebarForSplash: typeof shouldLegacyCloseSidebarForSplash
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
  resolveLegacyOutsideClickDecision,
  resolveLegacyPageTransition,
  resolveLegacyPrimaryHotkeyTarget,
  resolveLegacyPrimaryWorkbenchPage,
  resolveLegacySidebarHoverState,
  resolveLegacyTestToolsMenuToggleState,
  resolveLegacyWorkbenchActionDecision,
  shouldLegacyCloseRulesMenuOnEscape,
  shouldLegacyCloseSidebarForSplash
})
