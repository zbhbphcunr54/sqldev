import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { sanitizeInternalRedirectPath } from '@/features/navigation/redirect'

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore()
    if (!authStore.initialized) {
      await authStore.initAuth()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      return {
        path: '/login',
        query: { redirect: sanitizeInternalRedirectPath(to.fullPath) }
      }
    }

    return true
  })
}
