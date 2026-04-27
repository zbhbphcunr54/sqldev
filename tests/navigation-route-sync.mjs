import { loadTsModule } from './helpers/load-ts-module.mjs'

const routeSync = loadTsModule('src/features/navigation/route-sync.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

assertEqual(
  routeSync.resolveLegacyRouteSyncDecision({
    currentHash: '#/workbench/ddl',
    targetHash: '#/workbench/ddl',
    replaceUrl: false,
    hasHistoryApi: true,
    hasPushStateApi: true
  }),
  {
    shouldSync: false,
    strategy: 'none'
  },
  'same hash should skip route sync'
)

assertEqual(
  routeSync.resolveLegacyRouteSyncDecision({
    currentHash: '#/workbench/ddl',
    targetHash: '#/workbench/func',
    replaceUrl: true,
    hasHistoryApi: true,
    hasReplaceStateApi: true
  }),
  {
    shouldSync: true,
    strategy: 'replaceState'
  },
  'replace routing should prefer history.replaceState'
)

assertEqual(
  routeSync.resolveLegacyRouteSyncDecision({
    currentHash: '#/workbench/ddl',
    targetHash: '#/workbench/proc',
    replaceUrl: false,
    hasHistoryApi: true,
    hasPushStateApi: true
  }),
  {
    shouldSync: true,
    strategy: 'pushState'
  },
  'normal routing should prefer history.pushState'
)

assertEqual(
  routeSync.resolveLegacyRouteSyncDecision({
    currentHash: '#/workbench/ddl',
    targetHash: '#/workbench/id-tool',
    replaceUrl: false,
    hasHistoryApi: false
  }),
  {
    shouldSync: true,
    strategy: 'hashOnly'
  },
  'routing should fallback to hash sync when history API is unavailable'
)

console.log('Navigation route-sync tests passed')
