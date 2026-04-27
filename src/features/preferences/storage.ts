export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const THEME_OPTIONS = ['system', 'dark', 'light'] as const
const LAST_VIEW_OPTIONS = ['splash', 'workbench'] as const

type ThemePreference = (typeof THEME_OPTIONS)[number]
type LastViewPreference = (typeof LAST_VIEW_OPTIONS)[number]

function readStoredString(storage: StorageLike, key: string, fallback = ''): string {
  try {
    const value = storage.getItem(key)
    return value == null ? fallback : String(value)
  } catch {
    return fallback
  }
}

function writeStoredString(storage: StorageLike, key: string, value: unknown): boolean {
  try {
    storage.setItem(key, String(value ?? ''))
    return true
  } catch {
    return false
  }
}

export function getThemePreference(storage: StorageLike, key = 'theme'): ThemePreference {
  const value = readStoredString(storage, key, 'system')
  return THEME_OPTIONS.includes(value as ThemePreference) ? (value as ThemePreference) : 'system'
}

export function saveThemePreference(storage: StorageLike, value: unknown, key = 'theme'): boolean {
  const normalized = THEME_OPTIONS.includes(String(value) as ThemePreference)
    ? String(value)
    : 'system'
  return writeStoredString(storage, key, normalized)
}

export function getFileEncodingPreference(storage: StorageLike, key = 'fileEncoding'): string {
  return readStoredString(storage, key, 'UTF-8') || 'UTF-8'
}

export function saveFileEncodingPreference(
  storage: StorageLike,
  value: unknown,
  key = 'fileEncoding'
): boolean {
  const normalized = String(value || 'UTF-8').trim() || 'UTF-8'
  return writeStoredString(storage, key, normalized)
}

export function getSidebarCollapsedPreference(
  storage: StorageLike,
  key = 'sidebarCollapsed'
): boolean {
  return readStoredString(storage, key, '0') === '1'
}

export function saveSidebarCollapsedPreference(
  storage: StorageLike,
  collapsed: unknown,
  key = 'sidebarCollapsed'
): boolean {
  return writeStoredString(storage, key, collapsed ? '1' : '0')
}

export function getLastViewPreference(
  storage: StorageLike,
  key = 'sqldev_last_view'
): LastViewPreference {
  const value = readStoredString(storage, key, 'splash')
  return LAST_VIEW_OPTIONS.includes(value as LastViewPreference)
    ? (value as LastViewPreference)
    : 'splash'
}

export function saveLastViewPreference(
  storage: StorageLike,
  view: unknown,
  key = 'sqldev_last_view'
): boolean {
  const normalized = LAST_VIEW_OPTIONS.includes(String(view) as LastViewPreference)
    ? String(view)
    : 'splash'
  return writeStoredString(storage, key, normalized)
}
