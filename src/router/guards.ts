import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { sanitizeInternalRedirectPath } from '@/features/navigation/redirect'

function isZiweiShareMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('ziwei_share') === '1'
}

export function setupRouterGuards(router: Router) {
  router.beforeEach(async (to) => {
    const authStore = useAuthStore()
    if (!authStore.initialized) {
      await authStore.initAuth()
    }

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
      if (to.path.startsWith('/workbench/ziwei') && isZiweiShareMode()) {
        return true
      }

      return {
        path: '/login',
        query: { redirect: sanitizeInternalRedirectPath(to.fullPath) }
      }
    }

    if (to.path.startsWith('/workbench/ziwei') && !isZiweiShareMode()) {
      await authStore.ensureAdminStatus()
      if (!authStore.isAdmin) {
        return { path: '/workbench/home', replace: true }
      }
    }

    return true
  })
}
