import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useAsyncState } from '@/composables/useAsyncState'
import { useAuth } from '@/composables/useAuth'

function installDomMocks(options: {
  storedTheme?: string | null
  storageKey?: string
  systemDark?: boolean
} = {}) {
  const attributes = new Map<string, string>()
  const classState = new Set<string>()
  const storage = new Map<string, string>()
  const key = options.storageKey ?? 'sqldev:app:theme'
  if (options.storedTheme) storage.set(key, JSON.stringify(options.storedTheme))

  vi.stubGlobal('document', {
    documentElement: {
      setAttribute: (k: string, value: string) => attributes.set(k, value),
      classList: {
        toggle: (k: string, enabled: boolean) => {
          if (enabled) classState.add(k)
          else classState.delete(k)
        }
      }
    }
  })

  const localStorageStub = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, value: string) => storage.set(k, value),
    removeItem: (k: string) => storage.delete(k)
  }
  vi.stubGlobal('localStorage', localStorageStub)
  vi.stubGlobal('window', { localStorage: localStorageStub })

  return { attributes, classState, storage }
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
    vi.resetModules()
  })

  it('hydrates stored theme and applies it to the document', async () => {
    const { attributes, classState, storage } = installDomMocks({ storedTheme: 'dark' })
    storage.set('sqldev:app:theme-touched', JSON.stringify(true))
    const appStore = useAppStore()

    const { useThemeRuntime } = await import('@/composables/useThemeRuntime')
    useThemeRuntime()
    await nextTick()

    expect(appStore.themeMode).toBe('dark')
    expect(attributes.get('data-theme')).toBe('dark')
    expect(classState.has('dark')).toBe(true)

    appStore.setTheme('light')
    await nextTick()
    expect(storage.get('sqldev:app:theme')).toBe(JSON.stringify('light'))
    expect(attributes.get('data-theme')).toBe('light')
    expect(classState.has('dark')).toBe(false)
  })

  it('defaults to light when no stored theme exists', async () => {
    const { attributes, classState } = installDomMocks()
    const appStore = useAppStore()

    const { useThemeRuntime } = await import('@/composables/useThemeRuntime')
    useThemeRuntime()
    await nextTick()

    expect(appStore.themeMode).toBe('light')
    expect(attributes.get('data-theme')).toBe('light')
    expect(classState.has('dark')).toBe(false)
  })

  it('normalizes legacy "system" stored value to light', async () => {
    const { attributes } = installDomMocks({
      storedTheme: 'system',
      storageKey: 'sqldev:theme'
    })
    const appStore = useAppStore()

    const { useThemeRuntime } = await import('@/composables/useThemeRuntime')
    useThemeRuntime()
    await nextTick()

    expect(appStore.themeMode).toBe('light')
    expect(attributes.get('data-theme')).toBe('light')
  })
})
