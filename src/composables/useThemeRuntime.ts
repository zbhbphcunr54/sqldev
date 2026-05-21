import { onBeforeUnmount, watch } from 'vue'
import { useAppStore, type ResolvedTheme, type SkinId, type ThemeMode } from '@/stores/app'
import { getJson, setJson, removeJson } from '@/utils/storage'

const STORAGE_KEY = 'sqldev:app:theme'
const STORAGE_KEY_LEGACY = 'sqldev:theme'
const SKIN_KEY = 'sqldev:app:skin'
const THEME_TOUCHED_KEY = 'sqldev:app:theme-touched'

const VALID_SKINS: SkinId[] = [
  'violet-midnight',
  'cyber-ocean',
  'coral-sunset',
  'indigo-aurora',
  'teal-neutral'
]

const SKIN_DEFAULT_THEME: Record<SkinId, ThemeMode> = {
  'violet-midnight': 'dark',
  'cyber-ocean': 'dark',
  'coral-sunset': 'light',
  'indigo-aurora': 'light',
  'teal-neutral': 'light'
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark'
}

function applyThemeToDocument(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.classList.toggle('dark', theme === 'dark')
}

function applySkinToDocument(skin: SkinId): void {
  document.documentElement.setAttribute('data-skin', skin)
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
  if (stored === 'system') stored = 'light'
  return isThemeMode(stored) ? stored : 'light'
}

function writeStoredTheme(mode: ThemeMode): void {
  setJson(STORAGE_KEY, mode)
}

function readStoredSkin(): SkinId {
  const stored = getJson<string | null>(SKIN_KEY, null)
  return VALID_SKINS.includes(stored as SkinId) ? (stored as SkinId) : 'teal-neutral'
}

function writeStoredSkin(skin: SkinId): void {
  setJson(SKIN_KEY, skin)
}

let initialized = false

export function useThemeRuntime(): void {
  if (initialized) return
  initialized = true
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const appStore = useAppStore()

  appStore.setThemeTouched(getJson<boolean>(THEME_TOUCHED_KEY, false))
  appStore.setSkin(readStoredSkin())
  appStore.setTheme(readStoredTheme(), { touched: false })

  function syncTheme(): void {
    appStore.setResolvedTheme(appStore.themeMode)
    applyThemeToDocument(appStore.themeMode)
  }

  const stopThemeWatch = watch(
    () => appStore.themeMode,
    (mode) => {
      writeStoredTheme(mode)
      syncTheme()
    },
    { immediate: true }
  )

  const stopSkinWatch = watch(
    () => appStore.skinId,
    (skin) => {
      writeStoredSkin(skin)
      applySkinToDocument(skin)
      if (!appStore.themeTouched) {
        appStore.setTheme(SKIN_DEFAULT_THEME[skin], { touched: false })
      }
    },
    { immediate: true }
  )

  const stopTouchedWatch = watch(
    () => appStore.themeTouched,
    (touched) => {
      setJson(THEME_TOUCHED_KEY, touched)
    }
  )

  onBeforeUnmount(() => {
    stopThemeWatch()
    stopSkinWatch()
    stopTouchedWatch()
  })
}
