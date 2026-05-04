// [2026-05-03] 重构：统一 localStorage key 命名规范为 sqldev:<module>:<key>
// [2026-05-03] 补充：添加 100KB 单项上限检查和列表条目数上限

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const THEME_OPTIONS = ['system', 'dark', 'light'] as const
const LAST_VIEW_OPTIONS = ['splash', 'workbench'] as const
const MAX_ITEM_SIZE = 100 * 1024 // 100KB
const MAX_LIST_ITEMS = 100 // 列表最大条目数

type ThemePreference = (typeof THEME_OPTIONS)[number]
type LastViewPreference = (typeof LAST_VIEW_OPTIONS)[number]

// 命名空间常量
const PREFIX = 'sqldev:preferences:'

function readStoredString(storage: StorageLike, key: string, fallback = ''): string {
  try {
    const value = storage.getItem(key)
    return value == null ? fallback : String(value)
  } catch (err) {
    console.error('[preferences:storage] read failed:', key, err)
    return fallback
  }
}

function writeStoredString(storage: StorageLike, key: string, value: unknown): boolean {
  try {
    const str = String(value ?? '')
    // [2026-05-03] 新增：100KB 体积检查
    if (str.length > MAX_ITEM_SIZE) {
      console.warn('[preferences:storage] item too large:', key, str.length)
      return false
    }
    storage.setItem(key, str)
    return true
  } catch (err) {
    console.error('[preferences:storage] write failed:', key, err)
    return false
  }
}

function readStoredList<T>(
  storage: StorageLike,
  key: string,
  parser: (v: string) => T,
  fallback: T[] = []
): T[] {
  try {
    const value = storage.getItem(key)
    if (!value) return fallback
    // [2026-05-03] 新增：列表条目数上限检查
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return fallback
    return parsed.slice(0, MAX_LIST_ITEMS)
  } catch (err) {
    console.error('[preferences:storage] read list failed:', key, err)
    return fallback
  }
}

function writeStoredList<T>(
  storage: StorageLike,
  key: string,
  items: T[],
  serializer: (v: T) => string = JSON.stringify
): boolean {
  try {
    const list = items.slice(0, MAX_LIST_ITEMS)
    const str = JSON.stringify(list)
    if (str.length > MAX_ITEM_SIZE) {
      console.warn('[preferences:storage] list too large:', key, str.length)
      return false
    }
    storage.setItem(key, str)
    return true
  } catch (err) {
    console.error('[preferences:storage] write list failed:', key, err)
    return false
  }
}

// Theme
export function getThemePreference(storage: StorageLike, key = `${PREFIX}theme`): ThemePreference {
  const value = readStoredString(storage, key, 'system')
  return THEME_OPTIONS.includes(value as ThemePreference) ? (value as ThemePreference) : 'system'
}

export function saveThemePreference(storage: StorageLike, value: unknown, key = `${PREFIX}theme`): boolean {
  const normalized = THEME_OPTIONS.includes(String(value) as ThemePreference)
    ? String(value)
    : 'system'
  return writeStoredString(storage, key, normalized)
}

// File encoding
export function getFileEncodingPreference(storage: StorageLike, key = `${PREFIX}file_encoding`): string {
  return readStoredString(storage, key, 'UTF-8') || 'UTF-8'
}

export function saveFileEncodingPreference(
  storage: StorageLike,
  value: unknown,
  key = `${PREFIX}file_encoding`
): boolean {
  const normalized = String(value || 'UTF-8').trim() || 'UTF-8'
  return writeStoredString(storage, key, normalized)
}

// Sidebar
export function getSidebarCollapsedPreference(
  storage: StorageLike,
  key = `${PREFIX}sidebar_collapsed`
): boolean {
  return readStoredString(storage, key, '0') === '1'
}

export function saveSidebarCollapsedPreference(
  storage: StorageLike,
  collapsed: unknown,
  key = `${PREFIX}sidebar_collapsed`
): boolean {
  return writeStoredString(storage, key, collapsed ? '1' : '0')
}

// Last view
export function getLastViewPreference(
  storage: StorageLike,
  key = `${PREFIX}last_view`
): LastViewPreference {
  const value = readStoredString(storage, key, 'splash')
  return LAST_VIEW_OPTIONS.includes(value as LastViewPreference)
    ? (value as LastViewPreference)
    : 'splash'
}

export function saveLastViewPreference(
  storage: StorageLike,
  view: unknown,
  key = `${PREFIX}last_view`
): boolean {
  const normalized = LAST_VIEW_OPTIONS.includes(String(view) as LastViewPreference)
    ? String(view)
    : 'splash'
  return writeStoredString(storage, key, normalized)
}
