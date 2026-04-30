const PAGE_ROUTE_SEGMENTS = Object.freeze({
  ddl: 'ddl',
  func: 'function',
  proc: 'procedure',
  idTool: 'id-tool',
  ziweiTool: 'ziwei',
  rules: 'rules',
  bodyRules: 'body-rules'
})

const ROUTE_SEGMENT_TO_PAGE = Object.freeze((function() {
  var map = {}
  var keys = Object.keys(PAGE_ROUTE_SEGMENTS)
  for (var i = 0; i < keys.length; i += 1) {
    map[PAGE_ROUTE_SEGMENTS[keys[i]]] = keys[i]
  }
  return map
})())

const ROUTE_WORKBENCH_PREFIX = '/workbench'
const ROUTE_PAGE_KEYS = Object.freeze(Object.keys(PAGE_ROUTE_SEGMENTS))

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase()
}

function parseEmailAllowList(raw) {
  if (Array.isArray(raw)) {
    return raw.map(normalizeEmail).filter(Boolean)
  }
  if (typeof raw === 'string') {
    return raw.split(',').map(normalizeEmail).filter(Boolean)
  }
  return []
}

function readConfiguredZiweiAllowedEmails(root) {
  if (!root) return []
  var configured = root.SQDEV_ZIWEI_ALLOWED_EMAILS
  if (configured == null || configured === '') configured = root.__SQDEV_ZIWEI_ALLOWED_EMAILS
  return parseEmailAllowList(configured)
}

function readCurrentAuthEmail(root) {
  try {
    if (!root || !root.authApi || typeof root.authApi.getUserSync !== 'function') return ''
    var authUser = root.authApi.getUserSync()
    return normalizeEmail(authUser && authUser.email)
  } catch (_err) {
    return ''
  }
}

function readZiweiShareModeFromLocation(locationLike) {
  try {
    if (!locationLike) return false
    var search = new URLSearchParams(String(locationLike.search || ''))
    var raw = search.get('ziwei_share') || search.get('zwshare') || ''
    if (!raw && String(locationLike.hash || '').indexOf('?') >= 0) {
      var hashQuery = String(locationLike.hash || '').split('?')[1] || ''
      var hashParams = new URLSearchParams(hashQuery)
      raw = hashParams.get('ziwei_share') || hashParams.get('zwshare') || ''
    }
    var flag = String(raw || '').trim().toLowerCase()
    return flag === '1' || flag === 'true' || flag === 'yes'
  } catch (_err) {
    return false
  }
}

function normalizePageKey(page) {
  var key = String(page || '').trim()
  return ROUTE_PAGE_KEYS.indexOf(key) >= 0 ? key : 'ddl'
}

function normalizeRoutePath(path, routeUtils) {
  if (routeUtils && typeof routeUtils.normalizeLegacyRoutePath === 'function') {
    return routeUtils.normalizeLegacyRoutePath(path)
  }
  var value = String(path || '').trim()
  if (!value) return '/'
  if (value.charAt(0) !== '/') value = '/' + value
  value = value.replace(/\/{2,}/g, '/').replace(/\/+$/, '')
  return value || '/'
}

function parseRouteInfoFromPath(path, routeUtils) {
  if (routeUtils && typeof routeUtils.parseLegacyRouteInfoFromPath === 'function') {
    return routeUtils.parseLegacyRouteInfoFromPath(path, {
      pageRouteSegments: PAGE_ROUTE_SEGMENTS,
      routeWorkbenchPrefix: ROUTE_WORKBENCH_PREFIX
    })
  }
  var normalized = normalizeRoutePath(path, routeUtils)
  var match = normalized.match(/(?:^|\/)workbench(?:\/([^/?#]+))?/i)
  if (!match) return null
  var segment = String(match[1] || 'ddl').toLowerCase()
  return { view: 'workbench', page: ROUTE_SEGMENT_TO_PAGE[segment] || 'ddl' }
}

function parseRouteInfoFromLocation(locationLike, routeUtils) {
  if (routeUtils && typeof routeUtils.parseLegacyRouteInfoFromLocation === 'function') {
    return routeUtils.parseLegacyRouteInfoFromLocation(locationLike, {
      pageRouteSegments: PAGE_ROUTE_SEGMENTS,
      routeWorkbenchPrefix: ROUTE_WORKBENCH_PREFIX
    })
  }
  if (!locationLike) return null
  var hashPath = normalizeRoutePath(String(locationLike.hash || '').replace(/^#/, ''), routeUtils)
  var infoFromHash = parseRouteInfoFromPath(hashPath, routeUtils)
  if (infoFromHash) return infoFromHash
  return parseRouteInfoFromPath(locationLike.pathname || '/', routeUtils)
}

function buildWorkbenchHash(page, routeUtils) {
  if (routeUtils && typeof routeUtils.buildLegacyWorkbenchHash === 'function') {
    return routeUtils.buildLegacyWorkbenchHash(page, {
      pageRouteSegments: PAGE_ROUTE_SEGMENTS,
      routeWorkbenchPrefix: ROUTE_WORKBENCH_PREFIX
    })
  }
  var normalizedPage = normalizePageKey(page)
  var segment = PAGE_ROUTE_SEGMENTS[normalizedPage] || PAGE_ROUTE_SEGMENTS.ddl
  return '#' + ROUTE_WORKBENCH_PREFIX + '/' + segment
}

export function createLegacyNavigationState(root) {
  var runtime = root || (typeof window === 'undefined' ? null : window)
  return {
    PAGE_ROUTE_SEGMENTS,
    ROUTE_WORKBENCH_PREFIX,
    ROUTE_PAGE_KEYS,
    normalizeEmail,
    parseEmailAllowList,
    readConfiguredZiweiAllowedEmails: function() {
      return readConfiguredZiweiAllowedEmails(runtime)
    },
    readCurrentAuthEmail: function() {
      return readCurrentAuthEmail(runtime)
    },
    readZiweiShareModeFromLocation: function() {
      return readZiweiShareModeFromLocation(runtime && runtime.location)
    },
    normalizePageKey,
    normalizeRoutePath: function(path) {
      return normalizeRoutePath(path, runtime && runtime.SQLDEV_ROUTE_UTILS)
    },
    parseRouteInfoFromPath: function(path) {
      return parseRouteInfoFromPath(path, runtime && runtime.SQLDEV_ROUTE_UTILS)
    },
    parseRouteInfoFromLocation: function() {
      return parseRouteInfoFromLocation(runtime && runtime.location, runtime && runtime.SQLDEV_ROUTE_UTILS)
    },
    buildWorkbenchHash: function(page) {
      return buildWorkbenchHash(page, runtime && runtime.SQLDEV_ROUTE_UTILS)
    }
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_NAV_STATE = {
    createLegacyNavigationState,
    PAGE_ROUTE_SEGMENTS,
    ROUTE_WORKBENCH_PREFIX,
    ROUTE_PAGE_KEYS
  }
}
