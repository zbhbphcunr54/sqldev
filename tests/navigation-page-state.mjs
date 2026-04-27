import { loadTsModule } from './helpers/load-ts-module.mjs'

const pageState = loadTsModule('src/features/navigation/page-state.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const routePageKeys = ['ddl', 'func', 'proc', 'idTool', 'ziweiTool', 'rules', 'bodyRules']

assertEqual(
  pageState.normalizeLegacyPageKey('unknown', routePageKeys, 'ddl'),
  'ddl',
  'unknown page should fallback to ddl'
)

assertEqual(
  pageState.normalizeAccessibleLegacyPage('ziweiTool', {
    routePageKeys,
    ziweiPageKey: 'ziweiTool',
    fallbackPageKey: 'ddl',
    deniedZiweiFallbackPageKey: 'idTool',
    isZiweiShareMode: false,
    canAccessZiweiTool: false
  }),
  'idTool',
  'ziwei should fallback to idTool when not accessible'
)

assertEqual(
  pageState.normalizeAccessibleLegacyPage('func', {
    routePageKeys,
    ziweiPageKey: 'ziweiTool',
    fallbackPageKey: 'ddl',
    deniedZiweiFallbackPageKey: 'idTool',
    isZiweiShareMode: true,
    canAccessZiweiTool: false
  }),
  'ziweiTool',
  'share mode should force ziwei page'
)

assertEqual(
  pageState.resolveLegacyPageTransition('idTool', {
    routePageKeys,
    ziweiPageKey: 'ziweiTool',
    fallbackPageKey: 'ddl',
    deniedZiweiFallbackPageKey: 'idTool',
    isZiweiShareMode: false,
    canAccessZiweiTool: true,
    testToolPages: ['idTool', 'ziweiTool'],
    ensureRegionPageKey: 'idTool',
    keepSidebarOnMobile: false,
    mobileBreakpoint: 1024,
    windowWidth: 768
  }),
  {
    normalizedPage: 'idTool',
    shouldExpandTestTools: true,
    shouldEnsureRegionData: true,
    shouldCloseSidebarOnMobile: true
  },
  'idTool transition should expand test tools, preload region, and close sidebar on mobile'
)

console.log('Navigation page-state tests passed')
