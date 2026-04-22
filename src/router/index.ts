import { createRouter, createWebHashHistory } from 'vue-router'
import SplashPage from '@/pages/SplashPage.vue'
import WorkbenchPage from '@/pages/WorkbenchPage.vue'
import ZiweiPage from '@/pages/ZiweiPage.vue'
import LoginPage from '@/pages/LoginPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'splash',
      component: SplashPage
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage
    },
    {
      path: '/workbench',
      name: 'workbench',
      component: WorkbenchPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/workbench/ziwei',
      name: 'ziwei',
      component: ZiweiPage,
      meta: { requiresAuth: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage
    }
  ]
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initAuth()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return {
      path: '/login',
      query: { redirect: to.fullPath }
    }
  }
  if (to.path === '/login' && authStore.isAuthenticated) {
    return '/workbench'
  }
  return true
})

export default router
