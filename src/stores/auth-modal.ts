import { ref } from 'vue'
import { defineStore } from 'pinia'

type AuthModalView = 'login' | 'reset'
type AuthLoginMode = 'password' | 'code'

interface OpenAuthModalOptions {
  message?: string
  redirectTo?: string
  view?: AuthModalView
}

export const useAuthModalStore = defineStore('auth-modal', () => {
  const open = ref(false)
  const view = ref<AuthModalView>('login')
  const loginMode = ref<AuthLoginMode>('password')
  const message = ref('')
  const redirectTo = ref('/workbench/ddl')

  function openModal(options: OpenAuthModalOptions = {}): void {
    open.value = true
    view.value = options.view ?? 'login'
    message.value = options.message ?? ''
    redirectTo.value = options.redirectTo ?? '/workbench/ddl'
  }

  function closeModal(): void {
    open.value = false
    message.value = ''
    view.value = 'login'
    loginMode.value = 'password'
  }

  function enterReset(messageText = '请先输入新密码，然后发送验证码。'): void {
    view.value = 'reset'
    message.value = messageText
  }

  function exitReset(messageText = ''): void {
    view.value = 'login'
    loginMode.value = 'password'
    message.value = messageText
  }

  function setLoginMode(mode: AuthLoginMode): void {
    loginMode.value = mode
    view.value = 'login'
    message.value = ''
  }

  return {
    open,
    view,
    loginMode,
    message,
    redirectTo,
    openModal,
    closeModal,
    enterReset,
    exitReset,
    setLoginMode
  }
})
