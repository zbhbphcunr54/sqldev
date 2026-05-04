import { onBeforeUnmount, watch } from 'vue'
import { useAppStore, type ResolvedTheme, type ThemeMode } from '@/stores/app'

const STORAGE_KEY = 'sqldev:app:theme'
const STORAGE_KEY_LEGACY = 'sqldev:theme'
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getSystemTheme(mediaQuery: MediaQueryList | null): ResolvedTheme {
  return mediaQuery?.matches ? 'dark' : 'light'
}

function resolveTheme(mode: ThemeMode, mediaQuery: MediaQueryList | null): ResolvedTheme {
  if (mode !== 'system') return mode
  return getSystemTheme(mediaQuery)
}

function applyThemeToDocument(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'dark')
}

function readStoredTheme(): ThemeMode {
  try {
    let stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      // Migrate from legacy key
      stored = window.localStorage.getItem(STORAGE_KEY_LEGACY)
      if (isThemeMode(stored)) {
        window.localStorage.setItem(STORAGE_KEY, stored)
        window.localStorage.removeItem(STORAGE_KEY_LEGACY)
      }
    }
    return isThemeMode(stored) ? stored : 'system'
  } catch (error) {
    console.error('[SQLDev] Failed to read theme preference', error)
    return 'system'
  }
}

function writeStoredTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch (error) {
    console.error('[SQLDev] Failed to write theme preference', error)
  }
}

export function useThemeRuntime(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const appStore = useAppStore()
  const mediaQuery = window.matchMedia(SYSTEM_DARK_QUERY)

  appStore.hydrateTheme(readStoredTheme())

  function syncTheme(): void {
    const resolved = resolveTheme(appStore.themeMode, mediaQuery)
    appStore.setResolvedTheme(resolved)
    applyThemeToDocument(resolved)
  }

  const stopWatch = watch(
    () => appStore.themeMode,
    (mode) => {
      writeStoredTheme(mode)
      syncTheme()
    },
    { immediate: true }
  )

  const handleSystemThemeChange = (): void => {
    if (appStore.themeMode === 'system') syncTheme()
  }

  mediaQuery.addEventListener('change', handleSystemThemeChange)

  onBeforeUnmount(() => {
    stopWatch()
    mediaQuery.removeEventListener('change', handleSystemThemeChange)
  })
}
