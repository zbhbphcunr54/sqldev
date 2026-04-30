export interface LegacyRouteInfo {
  view: 'workbench'
  page?: string
}

export interface LegacyRouteConfig {
  pageRouteSegments: Record<string, string>
  routeWorkbenchPrefix?: string
}

export function normalizeLegacyRoutePath(pathValue: unknown): string {
  let value = String(pathValue || '').trim()
  if (!value) return '/'
  if (value.charAt(0) !== '/') value = `/${value}`
  value = value.replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return value || '/'
}

export function parseLegacyRouteInfoFromPath(
  pathValue: unknown,
  config: LegacyRouteConfig
): LegacyRouteInfo | null {
  const normalized = normalizeLegacyRoutePath(pathValue)
  const match = normalized.match(/(?:^|\/)workbench(?:\/([^/?#]+))?/i)
  if (!match) return null

  const routeSegmentToPage = Object.entries(config.pageRouteSegments || {}).reduce<
    Record<string, string>
  >((result, [page, segment]) => {
    result[String(segment || '').toLowerCase()] = page
    return result
  }, {})

  const segment = String(match[1] || 'ddl').toLowerCase()
  return {
    view: 'workbench',
    page: routeSegmentToPage[segment] || 'ddl'
  }
}

export function parseLegacyRouteInfoFromLocation(
  locationLike: { hash?: unknown; pathname?: unknown } | null | undefined,
  config: LegacyRouteConfig
): LegacyRouteInfo | null {
  if (!locationLike) return null
  const hashPath = normalizeLegacyRoutePath(String(locationLike.hash || '').replace(/^#/, ''))
  const infoFromHash = parseLegacyRouteInfoFromPath(hashPath, config)
  if (infoFromHash) return infoFromHash
  return parseLegacyRouteInfoFromPath(locationLike.pathname || '/', config)
}

export function buildLegacyWorkbenchHash(pageValue: unknown, config: LegacyRouteConfig): string {
  const page = String(pageValue || '').trim()
  const pageKeys = Object.keys(config.pageRouteSegments || {})
  const normalizedPage = pageKeys.includes(page) ? page : 'ddl'
  const segment =
    config.pageRouteSegments[normalizedPage] ||
    config.pageRouteSegments.ddl ||
    normalizedPage ||
    'ddl'
  const prefix = normalizeLegacyRoutePath(config.routeWorkbenchPrefix || '/workbench')
  return `#${prefix}/${segment}`
}
