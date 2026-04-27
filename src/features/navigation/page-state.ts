export interface LegacyPageAccessConfig {
  routePageKeys: string[]
  ziweiPageKey?: string
  fallbackPageKey?: string
  deniedZiweiFallbackPageKey?: string
  isZiweiShareMode?: boolean
  canAccessZiweiTool?: boolean
}

export interface LegacyPageTransitionConfig extends LegacyPageAccessConfig {
  testToolPages?: string[]
  ensureRegionPageKey?: string
  keepSidebarOnMobile?: boolean
  mobileBreakpoint?: number
  windowWidth?: number
}

export interface LegacyPageTransitionResult {
  normalizedPage: string
  shouldExpandTestTools: boolean
  shouldEnsureRegionData: boolean
  shouldCloseSidebarOnMobile: boolean
}

export function normalizeLegacyPageKey(
  pageValue: unknown,
  routePageKeys: string[],
  fallbackPageKey = 'ddl'
): string {
  const key = String(pageValue || '').trim()
  return routePageKeys.includes(key) ? key : fallbackPageKey
}

export function normalizeAccessibleLegacyPage(
  pageValue: unknown,
  config: LegacyPageAccessConfig
): string {
  const ziweiPageKey = config.ziweiPageKey || 'ziweiTool'
  const fallbackPageKey = config.fallbackPageKey || 'ddl'
  const deniedFallbackPageKey = config.deniedZiweiFallbackPageKey || 'idTool'
  const normalized = normalizeLegacyPageKey(pageValue, config.routePageKeys || [], fallbackPageKey)

  if (config.isZiweiShareMode) return ziweiPageKey
  if (normalized === ziweiPageKey && config.canAccessZiweiTool === false) {
    return deniedFallbackPageKey
  }
  return normalized
}

export function resolveLegacyPageTransition(
  pageValue: unknown,
  config: LegacyPageTransitionConfig
): LegacyPageTransitionResult {
  const normalizedPage = normalizeAccessibleLegacyPage(pageValue, config)
  const testToolPages = config.testToolPages || []
  const ensureRegionPageKey = config.ensureRegionPageKey || 'idTool'
  const mobileBreakpoint = Number.isFinite(config.mobileBreakpoint)
    ? Number(config.mobileBreakpoint)
    : 1024
  const windowWidth = Number.isFinite(config.windowWidth)
    ? Number(config.windowWidth)
    : Number.MAX_SAFE_INTEGER

  return {
    normalizedPage,
    shouldExpandTestTools: testToolPages.includes(normalizedPage),
    shouldEnsureRegionData: normalizedPage === ensureRegionPageKey,
    shouldCloseSidebarOnMobile: !config.keepSidebarOnMobile && windowWidth <= mobileBreakpoint
  }
}
