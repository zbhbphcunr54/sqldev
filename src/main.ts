import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from '@/App.vue'
import router from '@/router'
import { setupRouterGuards } from '@/router/guards'
import '@/styles/main.css'

function showGlobalErrorNotice(): void {
  const id = 'sqldev-global-error-notice'
  const existing = document.getElementById(id)
  if (existing) return

  const notice = document.createElement('div')
  notice.id = id
  notice.setAttribute('role', 'alert')
  notice.textContent = '页面出现异常，请刷新后重试。'
  Object.assign(notice.style, {
    position: 'fixed',
    right: '20px',
    bottom: '20px',
    zIndex: '99999',
    maxWidth: '320px',
    padding: '12px 16px',
    borderRadius: '14px',
    color: 'var(--color-text)',
    background: 'var(--color-modal-bg)',
    boxShadow: 'var(--shadow-modal)',
    fontSize: '14px',
    lineHeight: '1.5'
  })
  document.body.appendChild(notice)
  window.setTimeout(() => notice.remove(), 6000)
}

const app = createApp(App)
const pinia = createPinia()

app.config.errorHandler = (error, instance, info) => {
  console.error('[SQLDev] Vue runtime error', {
    error,
    component: instance?.type,
    info
  })
  showGlobalErrorNotice()
}

app.use(pinia)
setupRouterGuards(router)
app.use(router)
app.mount('#app')
