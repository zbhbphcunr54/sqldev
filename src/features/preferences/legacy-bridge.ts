import {
  getFileEncodingPreference,
  getLastViewPreference,
  getSidebarCollapsedPreference,
  getThemePreference,
  saveFileEncodingPreference,
  saveLastViewPreference,
  saveSidebarCollapsedPreference,
  saveThemePreference
} from './storage'

declare global {
  interface Window {
    SQLDEV_PREFERENCE_UTILS?: {
      getFileEncodingPreference: typeof getFileEncodingPreference
      getLastViewPreference: typeof getLastViewPreference
      getSidebarCollapsedPreference: typeof getSidebarCollapsedPreference
      getThemePreference: typeof getThemePreference
      saveFileEncodingPreference: typeof saveFileEncodingPreference
      saveLastViewPreference: typeof saveLastViewPreference
      saveSidebarCollapsedPreference: typeof saveSidebarCollapsedPreference
      saveThemePreference: typeof saveThemePreference
    }
  }
}

window.SQLDEV_PREFERENCE_UTILS = Object.freeze({
  getFileEncodingPreference,
  getLastViewPreference,
  getSidebarCollapsedPreference,
  getThemePreference,
  saveFileEncodingPreference,
  saveLastViewPreference,
  saveSidebarCollapsedPreference,
  saveThemePreference
})
