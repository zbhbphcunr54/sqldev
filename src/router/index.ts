import { createRouter, createWebHashHistory } from 'vue-router'
import LoginPage from '@/pages/auth/login.vue'
import NotFoundPage from '@/pages/not-found.vue'
import SplashPage from '@/pages/splash/index.vue'
import WorkbenchPage from '@/pages/workbench/index.vue'
import ZiweiPage from '@/pages/workbench/ziwei.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'splash',
      component: SplashPage,
      meta: { legacyFrame: true }
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { layout: 'auth' }
    },
    {
      path: '/workbench',
      name: 'workbench',
      component: WorkbenchPage,
      meta: { legacyFrame: true }
    },
    {
      path: '/workbench/ziwei',
      name: 'ziwei',
      component: ZiweiPage,
      meta: { legacyFrame: true }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: NotFoundPage
    }
  ]
})

export default router
