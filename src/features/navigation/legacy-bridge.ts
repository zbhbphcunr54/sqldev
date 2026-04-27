import {
  buildLegacyWorkbenchHash,
  normalizeLegacyRoutePath,
  parseLegacyRouteInfoFromLocation,
  parseLegacyRouteInfoFromPath
} from './legacy-route'

declare global {
  interface Window {
    SQLDEV_ROUTE_UTILS?: {
      buildLegacyWorkbenchHash: typeof buildLegacyWorkbenchHash
      normalizeLegacyRoutePath: typeof normalizeLegacyRoutePath
      parseLegacyRouteInfoFromLocation: typeof parseLegacyRouteInfoFromLocation
      parseLegacyRouteInfoFromPath: typeof parseLegacyRouteInfoFromPath
    }
  }
}

window.SQLDEV_ROUTE_UTILS = Object.freeze({
  buildLegacyWorkbenchHash,
  normalizeLegacyRoutePath,
  parseLegacyRouteInfoFromLocation,
  parseLegacyRouteInfoFromPath
})
