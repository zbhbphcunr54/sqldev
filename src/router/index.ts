import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'splash',
      component: () => import('@/pages/splash/index.vue'),
      meta: { fullPage: true }
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/pages/auth/login.vue'),
      meta: { layout: 'auth' }
    },
    {
      path: '/workbench',
      redirect: '/workbench/home'
    },
    {
      path: '/workbench/:section',
      name: 'workbench',
      component: () => import('@/pages/workbench/index.vue'),
      meta: { requiresAuth: true, layout: 'workbench' }
    },
    {
      path: '/ai-config',
      redirect: '/workbench/ai-config'
    },
    {
      path: '/operation-logs',
      name: 'operation-logs',
      component: () => import('@/pages/operation-logs/index.vue'),
      meta: { requiresAuth: true, layout: 'default' }
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/pages/not-found.vue'),
      meta: { layout: 'default' }
    }
  ]
})

export default router
