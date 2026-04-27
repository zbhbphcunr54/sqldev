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

declare global {
  interface Window {
    SQLDEV_ROUTE_UTILS?: {
      buildLegacyWorkbenchHash: typeof buildLegacyWorkbenchHash
      normalizeAccessibleLegacyPage: typeof normalizeAccessibleLegacyPage
      normalizeLegacyPageKey: typeof normalizeLegacyPageKey
      normalizeLegacyRoutePath: typeof normalizeLegacyRoutePath
      parseLegacyRouteInfoFromLocation: typeof parseLegacyRouteInfoFromLocation
      parseLegacyRouteInfoFromPath: typeof parseLegacyRouteInfoFromPath
      resolveLegacyPageTransition: typeof resolveLegacyPageTransition
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
  resolveLegacyPageTransition
})
