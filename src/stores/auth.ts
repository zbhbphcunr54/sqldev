import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const initialized = ref(false)
  const lastEvent = ref<AuthChangeEvent | null>(null)

  const isAuthenticated = computed(() => !!user.value)

  async function initAuth(): Promise<void> {
    if (initialized.value) return
    loading.value = true
    const {
      data: { session: currentSession }
    } = await supabase.auth.getSession()
    session.value = currentSession
    user.value = currentSession?.user ?? null

    supabase.auth.onAuthStateChange((event, nextSession) => {
      lastEvent.value = event
      session.value = nextSession
      user.value = nextSession?.user ?? null
      loading.value = false
    })

    initialized.value = true
    loading.value = false
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  async function signInWithPassword(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
  }

  async function signInWithOtp(email: string): Promise<void> {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true
      }
    })
    if (error) throw error
  }

  async function resetPasswordByEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) throw error
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
    signInWithOtp,
    resetPasswordByEmail
  }
})
