import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

async function onUserSignedIn(): Promise<void> {
  try {
    const { syncRulesFromServer, migrateRulesToServer } = await import('@/features/rules/sync')
    const { syncHistoryFromServer, migrateHistoryToServer } = await import('@/features/ziwei/history-sync')
    // Migrate localStorage → Supabase (one-time, then sync back)
    await Promise.all([migrateRulesToServer(), migrateHistoryToServer()])
    // Pull latest from server
    await Promise.all([syncRulesFromServer(), syncHistoryFromServer()])
  } catch {
    // Sync failure doesn't block login
  }
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const initialized = ref(false)
  const lastEvent = ref<AuthChangeEvent | null>(null)
  let initPromise: Promise<void> | null = null
  let authListenerRegistered = false
  let authSubscription: { unsubscribe: () => void } | null = null

  const isAuthenticated = computed(() => !!user.value)

  function applySession(nextSession: Session | null): void {
    session.value = nextSession
    user.value = nextSession?.user ?? null
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

        if (!authListenerRegistered) {
          authListenerRegistered = true
          const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
            lastEvent.value = event
            applySession(nextSession)
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
    await supabase.auth.signOut()
    session.value = null
    user.value = null
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
    initAuth,
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
