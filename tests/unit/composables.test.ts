import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAsyncState } from '@/composables/useAsyncState'
import { useAuth } from '@/composables/useAuth'
import { useThemeRuntime } from '@/composables/useThemeRuntime'

function installDomMocks(options: { storedTheme?: string | null; systemDark?: boolean } = {}) {
  const attributes = new Map<string, string>()
  const classState = new Set<string>()
  const storage = new Map<string, string>()
  if (options.storedTheme) storage.set('sqldev:theme', options.storedTheme)

  const mediaQuery = {
    matches: options.systemDark ?? false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }

  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      classList: {
        toggle: (key: string, enabled: boolean) => {
          if (enabled) classState.add(key)
          else classState.delete(key)
        }
      }
    }
  })
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value)
    },
    matchMedia: vi.fn(() => mediaQuery)
  })

  return { attributes, classState, storage, mediaQuery }
}

describe('useAsyncState', () => {
  it('tracks loading, data and reset state', async () => {
    const state = useAsyncState<string>()

    await expect(state.run(async () => 'ok')).resolves.toBe('ok')
    expect(state.data.value).toBe('ok')
    expect(state.loading.value).toBe(false)

    state.reset()
    expect(state.data.value).toBeNull()
    expect(state.error.value).toBe('')
  })

  it('uses the centralized fallback message for unknown errors', async () => {
    const state = useAsyncState<string>()

    await expect(
      state.run(async () => {
        throw 'boom'
      })
    ).resolves.toBeNull()

    expect(state.error.value).toBe('请求失败，请稍后重试。')
  })
})

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes store refs and auth actions through a composable boundary', () => {
    const store = useAuthStore()
    const auth = useAuth()
    store.user = { email: 'user@example.com' } as typeof store.user

    expect(auth.userEmail.value).toBe('user@example.com')
    expect(auth.signOut).toBe(store.signOut)
    expect(auth.signInWithPassword).toBe(store.signInWithPassword)
  })
})

describe('useThemeRuntime', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.unstubAllGlobals()
  })

  it('hydrates stored theme and applies it to the document', async () => {
    const { attributes, classState, storage } = installDomMocks({ storedTheme: 'dark' })
    const appStore = useAppStore()

    useThemeRuntime()
    await nextTick()

    expect(appStore.themeMode).toBe('dark')
    expect(attributes.get('data-theme')).toBe('dark')
    expect(classState.has('dark')).toBe(true)

    appStore.setTheme('light')
    await nextTick()
    expect(storage.get('sqldev:theme')).toBe('light')
    expect(attributes.get('data-theme')).toBe('light')
    expect(classState.has('dark')).toBe(false)
  })

  it('follows system theme changes when theme mode is system', async () => {
    const { attributes, mediaQuery } = installDomMocks({ systemDark: true })
    const appStore = useAppStore()

    useThemeRuntime()
    await nextTick()

    expect(attributes.get('data-theme')).toBe('dark')
    const handler = mediaQuery.addEventListener.mock.calls[0]?.[1] as () => void
    mediaQuery.matches = false
    handler()
    await nextTick()

    expect(appStore.themeMode).toBe('system')
    expect(attributes.get('data-theme')).toBe('light')
  })
})
