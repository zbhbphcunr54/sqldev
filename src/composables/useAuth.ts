import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

export function useAuth() {
  const authStore = useAuthStore()
  const { user, loading, isAuthenticated, isAdmin, adminStatusLoading, canAccessZiweiTool } =
    storeToRefs(authStore)

  const userEmail = computed(() => user.value?.email ?? '')

  return {
    user,
    userEmail,
    loading,
    isAuthenticated,
    isAdmin,
    adminStatusLoading,
    canAccessZiweiTool,
    initAuth: authStore.initAuth,
    ensureAdminStatus: authStore.ensureAdminStatus,
    signOut: authStore.signOut,
    signInWithPassword: authStore.signInWithPassword,
    signUpWithPassword: authStore.signUpWithPassword,
    sendEmailCode: authStore.sendEmailCode,
    verifyEmailCode: authStore.verifyEmailCode,
    resetPasswordByEmail: authStore.resetPasswordByEmail,
    resetPasswordWithCode: authStore.resetPasswordWithCode
  }
}
