export interface LegacySidebarHoverConfig {
  windowWidth?: number
  mobileBreakpoint?: number
}

export interface LegacySidebarHoverResult {
  shouldIgnore: boolean
  nextSidebarOpen: boolean
  shouldCloseSettings: boolean
}

export interface LegacyTestToolsToggleConfig {
  activePage: unknown
  testToolPages: string[]
  fallbackPage?: string
}

export interface LegacyTestToolsToggleResult {
  nextExpanded: boolean
  nextPage: string | null
}

function resolveLegacyMobileBreakpoint(value: unknown): number {
  return Number.isFinite(value) ? Number(value) : 1024
}

export function resolveLegacySidebarHoverState(
  openValue: unknown,
  config: LegacySidebarHoverConfig = {}
): LegacySidebarHoverResult {
  const mobileBreakpoint = resolveLegacyMobileBreakpoint(config.mobileBreakpoint)
  const windowWidth = Number.isFinite(config.windowWidth)
    ? Number(config.windowWidth)
    : Number.MAX_SAFE_INTEGER
  const shouldIgnore = windowWidth <= mobileBreakpoint
  return {
    shouldIgnore,
    nextSidebarOpen: !shouldIgnore && Boolean(openValue),
    shouldCloseSettings: !openValue
  }
}

export function resolveLegacyTestToolsMenuToggleState(
  currentExpandedValue: unknown,
  config: LegacyTestToolsToggleConfig
): LegacyTestToolsToggleResult {
  const nextExpanded = !currentExpandedValue
  const activePage = String(config.activePage || '').trim()
  const fallbackPage = config.fallbackPage || 'ddl'
  const shouldFallbackPage = !nextExpanded && (config.testToolPages || []).includes(activePage)
  return {
    nextExpanded,
    nextPage: shouldFallbackPage ? fallbackPage : null
  }
}

export function shouldLegacyCloseSidebarForSplash(
  windowWidthValue: unknown,
  mobileBreakpointValue?: unknown
): boolean {
  const mobileBreakpoint = resolveLegacyMobileBreakpoint(mobileBreakpointValue)
  const windowWidth = Number.isFinite(windowWidthValue)
    ? Number(windowWidthValue)
    : Number.MAX_SAFE_INTEGER
  return windowWidth <= mobileBreakpoint
}
