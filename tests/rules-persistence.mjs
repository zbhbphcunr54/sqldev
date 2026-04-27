import { loadTsModule } from './helpers/load-ts-module.mjs'

const rules = loadTsModule('src/features/rules/persistence.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const storageMap = new Map()
const storage = {
  getItem(key) {
    return storageMap.has(key) ? storageMap.get(key) : null
  },
  setItem(key, value) {
    storageMap.set(key, value)
  }
}

const ddlRules = { oracle_to_mysql: [{ pattern: 'NUMBER', replace: 'DECIMAL' }] }
const bodyDefaults = {
  oracle_mysql: [
    { s: 'sysdate', t: 'now()', fwd: true, rev: false, typeFwd: 'expr', typeRev: 'expr' }
  ]
}
const bodyRules = {
  oracle_mysql: [{ s: 'sysdate', t: 'now()', fwd: true, rev: false }]
}

const persist = rules.persistRulesToStorage(storage, 'ddl-key', 'body-key', ddlRules, bodyRules)
assert(persist.ok, 'rules persistence must succeed')

const loadedDdl = rules.loadDdlRulesFromStorage(storage, 'ddl-key')
assertEqual(loadedDdl, ddlRules, 'DDL rules must roundtrip through storage')

const loadedBody = rules.loadBodyRulesFromStorage(storage, 'body-key', bodyDefaults)
assertEqual(
  loadedBody.oracle_mysql[0],
  { s: 'sysdate', t: 'now()', fwd: true, rev: false, typeFwd: 'expr', typeRev: 'expr' },
  'body rules must restore default execution metadata'
)

const target = { a: 1, b: 2 }
rules.hydrateRulesData(target, { a: 3, c: 4 })
assertEqual(target, { a: 3, b: 2 }, 'hydrate must only update known keys')

console.log('Rules persistence tests passed')
