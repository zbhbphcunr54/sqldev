import { loadTsModule } from './helpers/load-ts-module.mjs'

const routes = loadTsModule('src/features/navigation/legacy-route.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const config = {
  pageRouteSegments: {
    ddl: 'ddl',
    func: 'functions',
    idTool: 'id-tools',
    ziweiTool: 'ziwei'
  },
  routeWorkbenchPrefix: '/workbench'
}

assertEqual(routes.normalizeLegacyRoutePath('workbench//ziwei/'), '/workbench/ziwei', 'route path must normalize')
assertEqual(
  routes.parseLegacyRouteInfoFromPath('/workbench/ziwei', config),
  { view: 'workbench', page: 'ziweiTool' },
  'workbench path must parse to mapped page'
)
assertEqual(
  routes.parseLegacyRouteInfoFromLocation({ hash: '#/workbench/functions', pathname: '/splash' }, config),
  { view: 'workbench', page: 'func' },
  'hash route must override pathname route'
)
assertEqual(routes.buildLegacyWorkbenchHash('unknown', config), '#/workbench/ddl', 'unknown page must fallback to ddl')

console.log('Navigation route tests passed')
