import { loadTsModule } from './helpers/load-ts-module.mjs'

const preferences = loadTsModule('src/features/preferences/storage.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const store = new Map()
const storage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null
  },
  setItem(key, value) {
    store.set(key, value)
  }
}

assertEqual(preferences.getThemePreference(storage), 'system', 'theme fallback must be system')
preferences.saveThemePreference(storage, 'dark')
assertEqual(preferences.getThemePreference(storage), 'dark', 'theme must roundtrip')

assertEqual(preferences.getFileEncodingPreference(storage), 'UTF-8', 'file encoding fallback must be UTF-8')
preferences.saveFileEncodingPreference(storage, 'GBK')
assertEqual(preferences.getFileEncodingPreference(storage), 'GBK', 'file encoding must roundtrip')

assertEqual(preferences.getSidebarCollapsedPreference(storage), false, 'sidebar collapsed fallback must be false')
preferences.saveSidebarCollapsedPreference(storage, true)
assertEqual(preferences.getSidebarCollapsedPreference(storage), true, 'sidebar collapsed must roundtrip')

assertEqual(preferences.getLastViewPreference(storage), 'splash', 'last view fallback must be splash')
preferences.saveLastViewPreference(storage, 'workbench')
assertEqual(preferences.getLastViewPreference(storage), 'workbench', 'last view must roundtrip')

console.log('Preferences storage tests passed')
