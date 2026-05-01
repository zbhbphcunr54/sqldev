import { storeToRefs } from 'pinia'
import { useAuthModalStore } from '@/stores/auth-modal'

export function useAuthModal() {
  const modalStore = useAuthModalStore()
  const { open, view, loginMode, message, redirectTo } = storeToRefs(modalStore)

  return {
    open,
    view,
    loginMode,
    message,
    redirectTo,
    openModal: modalStore.openModal,
    closeModal: modalStore.closeModal,
    enterReset: modalStore.enterReset,
    exitReset: modalStore.exitReset,
    setLoginMode: modalStore.setLoginMode
  }
}
