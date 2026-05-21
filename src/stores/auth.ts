import { computed, ref } from 'vue'
import { defineStore, getActivePinia } from 'pinia'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { appConfigApi } from '@/api/app-config'
import { fetchOperationLogs } from '@/api/operation-logs'

async function onUserSignedIn(): Promise<void> {
  try {
    const { useAiStore } = await import('@/stores/ai')
    useAiStore().preload()
  } catch {
    // Preload failure doesn't block login
  }
}

async function resolveAdminStatus(): Promise<boolean> {
  try {
    const result = await appConfigApi.getAdminStatus()
    if (typeof result?.is_admin === 'boolean') {
      return result.is_admin
    }
  } catch {
    // Fall through to the existing operation-logs capability check.
  }

  const fallback = await fetchOperationLogs({
    page: 1,
    pageSize: 1,
    withSummary: false,
    withOptions: false,
    withTotal: false
  })
  return fallback.is_admin === true
}

async function resetSensitiveClientState(previousUserId?: string | null): Promise<void> {
  const pinia = getActivePinia()
  if (!pinia) return

  try {
    const { useWorkbenchStore } = await import('@/stores/workbench')
    useWorkbenchStore(pinia).resetSqlConvertWorkspace()
  } catch {
    // Reset failure should not block auth state changes.
  }

  try {
    const { useAiStore } = await import('@/stores/ai')
    useAiStore(pinia).$reset(previousUserId)
  } catch {
    // Reset failure should not block auth state changes.
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const isAdmin = ref(false)
  const adminStatusLoading = ref(false)
  const adminStatusLoaded = ref(false)
  const loading = ref(true)
  const initialized = ref(false)
  const lastEvent = ref<AuthChangeEvent | null>(null)
  let initPromise: Promise<void> | null = null
  let adminStatusPromise: Promise<void> | null = null
  let authListenerRegistered = false
  let authSubscription: { unsubscribe: () => void } | null = null

  const isAuthenticated = computed(() => !!user.value)
  const canAccessZiweiTool = computed(() => isAuthenticated.value && isAdmin.value)

  function applySession(nextSession: Session | null): void {
    const previousUserId = user.value?.id ?? null
    const nextUserId = nextSession?.user?.id ?? null

    session.value = nextSession
    user.value = nextSession?.user ?? null
    if (!nextSession?.user) {
      isAdmin.value = false
      adminStatusLoading.value = false
      adminStatusLoaded.value = false
      adminStatusPromise = null
    }

    if (previousUserId && previousUserId !== nextUserId) {
      void resetSensitiveClientState(previousUserId)
    }
  }

  async function ensureAdminStatus(force = false): Promise<void> {
    if (!user.value) {
      isAdmin.value = false
      adminStatusLoading.value = false
      adminStatusLoaded.value = false
      return
    }
    if (adminStatusLoaded.value && !force) return
    if (adminStatusPromise && !force) return adminStatusPromise

    const currentUserId = user.value.id
    adminStatusLoading.value = true
    const request = (async () => {
      try {
        const nextIsAdmin = await resolveAdminStatus()
        if (user.value?.id !== currentUserId) return
        isAdmin.value = nextIsAdmin
        adminStatusLoaded.value = true
      } catch {
        if (user.value?.id !== currentUserId) return
        isAdmin.value = false
        adminStatusLoaded.value = true
      } finally {
        if (user.value?.id === currentUserId) {
          adminStatusLoading.value = false
        }
        if (adminStatusPromise === request) {
          adminStatusPromise = null
        }
      }
    })()

    adminStatusPromise = request
    return request
  }

  async function initAuth(): Promise<void> {
    if (initialized.value) return
    if (initPromise) return initPromise

    loading.value = true
    initPromise = (async () => {
      try {
        const {
          data: { session: currentSession }
        } = await supabase.auth.getSession()
        applySession(currentSession)
        await ensureAdminStatus(true)

        if (!authListenerRegistered) {
          authListenerRegistered = true
          const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
            lastEvent.value = event
            applySession(nextSession)
            void ensureAdminStatus(true)
            if (event === 'SIGNED_IN') {
              onUserSignedIn()
            }
          })
          authSubscription = data.subscription
        }

        initialized.value = true
      } finally {
        loading.value = false
        initPromise = null
      }
    })()

    return initPromise
  }

  async function signOut(): Promise<void> {
    const previousUserId = user.value?.id ?? null
    await supabase.auth.signOut()
    applySession(null)
    void resetSensitiveClientState(previousUserId)
  }

  async function signInWithPassword(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    applySession(data.session)
  }

  async function signUpWithPassword(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    })
    if (error) throw error
    applySession(data.session)
  }

  async function sendEmailCode(email: string): Promise<void> {
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    const firstTry = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo
      }
    })
    if (!firstTry.error) return

    const message = String(firstTry.error.message || '').toLowerCase()
    const shouldCreateUser =
      message.includes('user not found') ||
      message.includes('no user') ||
      message.includes('not registered')
    if (!shouldCreateUser) throw firstTry.error

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo
      }
    })
    if (error) throw error
  }

  async function verifyEmailCode(email: string, token: string): Promise<void> {
    const otpTypes = ['email', 'magiclink', 'signup'] as const
    let lastError: unknown = null

    for (const type of otpTypes) {
      const { data, error } = await supabase.auth.verifyOtp({ email, token, type })
      if (!error) {
        applySession(data.session)
        return
      }
      lastError = error
    }

    throw lastError instanceof Error ? lastError : new Error('验证码无效或已过期')
  }

  async function resetPasswordByEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
  }

  async function resetPasswordWithCode(
    email: string,
    token: string,
    nextPassword: string
  ): Promise<void> {
    await verifyEmailCode(email, token)
    const { error } = await supabase.auth.updateUser({ password: nextPassword })
    if (error) throw error
    await signOut()
  }

  function disposeAuthListener(): void {
    authSubscription?.unsubscribe()
    authSubscription = null
    authListenerRegistered = false
  }

  return {
    session,
    user,
    loading,
    initialized,
    lastEvent,
    isAuthenticated,
    isAdmin,
    adminStatusLoading,
    adminStatusLoaded,
    canAccessZiweiTool,
    initAuth,
    ensureAdminStatus,
    signOut,
    signInWithPassword,
    signUpWithPassword,
    sendEmailCode,
    verifyEmailCode,
    resetPasswordByEmail,
    resetPasswordWithCode,
    disposeAuthListener
  }
})
