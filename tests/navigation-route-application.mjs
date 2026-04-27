import { loadTsModule } from './helpers/load-ts-module.mjs'

const routeApplication = loadTsModule('src/features/navigation/route-application.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  routeApplication.resolveLegacyRouteApplicationDecision({
    routeInfo: { view: 'splash' },
    isZiweiShareMode: true,
    activePage: 'ddl',
    isSplashActive: true
  }),
  {
    shouldEnsureWorkbenchVisible: true,
    shouldGoSplashHome: false,
    nextPage: 'ziweiTool',
    nextPageOptions: {
      syncRoute: true,
      replaceRoute: true,
      keepSidebarOnMobile: true
    }
  },
  'splash route in share mode should force ziwei workbench page'
)

assertEqual(
  routeApplication.resolveLegacyRouteApplicationDecision({
    routeInfo: { view: 'splash' },
    isZiweiShareMode: false,
    activePage: 'ddl',
    isSplashActive: false
  }),
  {
    shouldEnsureWorkbenchVisible: false,
    shouldGoSplashHome: true,
    nextPage: null,
    nextPageOptions: null
  },
  'splash route should return to splash home when splash UI is not active'
)

assertEqual(
  routeApplication.resolveLegacyRouteApplicationDecision({
    routeInfo: { view: 'workbench', page: 'ziweiTool' },
    isZiweiShareMode: false,
    canAccessZiweiTool: false,
    activePage: 'ddl',
    isSplashActive: false
  }),
  {
    shouldEnsureWorkbenchVisible: true,
    shouldGoSplashHome: false,
    nextPage: 'idTool',
    nextPageOptions: {
      syncRoute: true,
      replaceRoute: true,
      keepSidebarOnMobile: true
    }
  },
  'workbench ziwei route should fallback to idTool when access is denied'
)

assertEqual(
  routeApplication.resolveLegacyRouteApplicationDecision({
    routeInfo: { view: 'workbench', page: 'func' },
    isZiweiShareMode: false,
    canAccessZiweiTool: true,
    activePage: 'ddl',
    isSplashActive: false
  }),
  {
    shouldEnsureWorkbenchVisible: true,
    shouldGoSplashHome: false,
    nextPage: 'func',
    nextPageOptions: {
      syncRoute: false,
      keepSidebarOnMobile: true
    }
  },
  'workbench route should apply target page with non-sync transition when page differs'
)

console.log('Navigation route-application tests passed')
