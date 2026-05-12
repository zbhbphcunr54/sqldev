import { onBeforeUnmount, watch } from 'vue'
import { useAppStore, type ResolvedTheme, type ThemeMode } from '@/stores/app'
import { getJson, setJson, removeJson } from '@/utils/storage'

const STORAGE_KEY = 'sqldev:app:theme'
const STORAGE_KEY_LEGACY = 'sqldev:theme'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function applyThemeToDocument(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'dark')
}

function readStoredTheme(): ThemeMode {
  let stored = getJson<string | null>(STORAGE_KEY, null)
  if (!stored) {
    stored = getJson<string | null>(STORAGE_KEY_LEGACY, null)
    if (stored) {
      setJson(STORAGE_KEY, stored === 'system' ? 'light' : stored)
      removeJson(STORAGE_KEY_LEGACY)
    }
  }
  // 迁移旧的 'system' 值
  if (stored === 'system') stored = 'light'
  return isThemeMode(stored) ? stored : 'light'
}

function writeStoredTheme(mode: ThemeMode): void {
  setJson(STORAGE_KEY, mode)
}

let initialized = false

export function useThemeRuntime(): void {
  if (initialized) return
  initialized = true
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const appStore = useAppStore()

  appStore.setTheme(readStoredTheme())

  function syncTheme(): void {
    appStore.setResolvedTheme(appStore.themeMode)
    applyThemeToDocument(appStore.themeMode)
  }

  const stopWatch = watch(
    () => appStore.themeMode,
    (mode) => {
      writeStoredTheme(mode)
      syncTheme()
    },
    { immediate: true }
  )

  onBeforeUnmount(() => {
    stopWatch()
  })
}
