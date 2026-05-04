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
      redirect: '/workbench/ddl'
    },
    {
      path: '/workbench/:section',
      name: 'workbench',
      component: () => import('@/pages/workbench/index.vue'),
      meta: { layout: 'workbench' }
    },
    {
      path: '/operation-logs',
      name: 'operation-logs',
      component: () => import('@/pages/operation-logs/index.vue'),
      meta: { requiresAuth: true, layout: 'default' }
    },
    {
      path: '/ai-config',
      name: 'ai-config',
      component: () => import('@/components/business/ai/AiConfigPage.vue'),
      meta: { requiresAuth: true, layout: 'default' }
    },
    {
      path: '/app-config',
      name: 'app-config',
      component: () => import('@/components/business/app-config/AppConfigPage.vue'),
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
