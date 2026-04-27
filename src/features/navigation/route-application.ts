import type { LegacyRouteInfo } from './legacy-route'

export interface LegacyRoutePageApplyOptions {
  syncRoute: boolean
  replaceRoute?: boolean
  keepSidebarOnMobile: boolean
}

export interface LegacyRouteApplicationConfig {
  routeInfo: LegacyRouteInfo | null | undefined
  isZiweiShareMode?: boolean
  canAccessZiweiTool?: boolean
  activePage?: unknown
  isSplashActive?: boolean
}

export interface LegacyRouteApplicationDecision {
  shouldEnsureWorkbenchVisible: boolean
  shouldGoSplashHome: boolean
  nextPage: string | null
  nextPageOptions: LegacyRoutePageApplyOptions | null
}

export function resolveLegacyRouteApplicationDecision(
  config: LegacyRouteApplicationConfig
): LegacyRouteApplicationDecision {
  const routeInfo = config.routeInfo
  if (!routeInfo) {
    return {
      shouldEnsureWorkbenchVisible: false,
      shouldGoSplashHome: false,
      nextPage: null,
      nextPageOptions: null
    }
  }

  const isZiweiShareMode = Boolean(config.isZiweiShareMode)
  const activePage = String(config.activePage || '').trim()

  if (routeInfo.view === 'splash') {
    if (isZiweiShareMode) {
      return {
        shouldEnsureWorkbenchVisible: true,
        shouldGoSplashHome: false,
        nextPage: 'ziweiTool',
        nextPageOptions: {
          syncRoute: true,
          replaceRoute: true,
          keepSidebarOnMobile: true
        }
      }
    }

    return {
      shouldEnsureWorkbenchVisible: false,
      shouldGoSplashHome: !config.isSplashActive,
      nextPage: null,
      nextPageOptions: null
    }
  }

  if (isZiweiShareMode) {
    return {
      shouldEnsureWorkbenchVisible: true,
      shouldGoSplashHome: false,
      nextPage: activePage !== 'ziweiTool' ? 'ziweiTool' : null,
      nextPageOptions:
        activePage !== 'ziweiTool'
          ? {
              syncRoute: true,
              replaceRoute: true,
              keepSidebarOnMobile: true
            }
          : null
    }
  }

  if (String(routeInfo.page || '') === 'ziweiTool' && config.canAccessZiweiTool === false) {
    return {
      shouldEnsureWorkbenchVisible: true,
      shouldGoSplashHome: false,
      nextPage: 'idTool',
      nextPageOptions: {
        syncRoute: true,
        replaceRoute: true,
        keepSidebarOnMobile: true
      }
    }
  }

  const routePage = String(routeInfo.page || '').trim()
  return {
    shouldEnsureWorkbenchVisible: true,
    shouldGoSplashHome: false,
    nextPage: routePage && routePage !== activePage ? routePage : null,
    nextPageOptions:
      routePage && routePage !== activePage
        ? {
            syncRoute: false,
            keepSidebarOnMobile: true
          }
        : null
  }
}
