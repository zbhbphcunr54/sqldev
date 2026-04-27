export interface LegacyWorkbenchVisibilityConfig {
  isSplashActive?: boolean
  hasEnterWorkbenchApi?: boolean
}

export interface LegacyWorkbenchVisibilityDecision {
  shouldSkip: boolean
  shouldUseEnterWorkbenchApi: boolean
}

export interface LegacySplashHomeTransitionConfig {
  windowWidth?: number
  mobileBreakpoint?: number
  hasSplashApiShowHome?: boolean
}

export interface LegacySplashHomeTransitionDecision {
  shouldCloseSidebar: boolean
  shouldUseSplashApiShowHome: boolean
}

export interface LegacySplashHashSyncDecision {
  shouldSyncRoute: boolean
  shouldUseHistoryReplaceState: boolean
}

function resolveLegacyMobileBreakpoint(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 1024
}

export function resolveLegacyWorkbenchVisibilityDecision(
  config: LegacyWorkbenchVisibilityConfig
): LegacyWorkbenchVisibilityDecision {
  const isSplashActive = Boolean(config.isSplashActive)
  return {
    shouldSkip: !isSplashActive,
    shouldUseEnterWorkbenchApi: isSplashActive && Boolean(config.hasEnterWorkbenchApi)
  }
}

export function resolveLegacySplashHomeTransition(
  config: LegacySplashHomeTransitionConfig = {}
): LegacySplashHomeTransitionDecision {
  const mobileBreakpoint = resolveLegacyMobileBreakpoint(config.mobileBreakpoint)
  const windowWidth = Number.isFinite(config.windowWidth)
    ? Number(config.windowWidth)
    : Number.MAX_SAFE_INTEGER
  return {
    shouldCloseSidebar: windowWidth <= mobileBreakpoint,
    shouldUseSplashApiShowHome: Boolean(config.hasSplashApiShowHome)
  }
}

export function resolveLegacySplashHashSyncDecision(
  currentHashValue: unknown,
  splashHashValue: unknown,
  hasHistoryReplaceState: unknown
): LegacySplashHashSyncDecision {
  const currentHash = String(currentHashValue || '')
  const splashHash = String(splashHashValue || '')
  return {
    shouldSyncRoute: currentHash !== splashHash,
    shouldUseHistoryReplaceState: Boolean(hasHistoryReplaceState)
  }
}
