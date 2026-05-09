// [2026-05-07] 通用确认弹窗 composable
import { ref } from 'vue'

interface ConfirmOptions {
  title?: string
  confirmText?: string
  cancelText?: string
  confirmClass?: 'primary' | 'danger'
}

const visible = ref(false)
const title = ref('确认操作')
const message = ref('')
const confirmText = ref('确定')
const cancelText = ref('取消')
const confirmClass = ref<'primary' | 'danger'>('primary')
let resolvePromise: ((value: boolean) => void) | null = null

export function useConfirm() {
  function confirm(msg: string, options: ConfirmOptions = {}): Promise<boolean> {
    message.value = msg
    title.value = options.title ?? '确认操作'
    confirmText.value = options.confirmText ?? '确定'
    cancelText.value = options.cancelText ?? '取消'
    confirmClass.value = options.confirmClass ?? 'primary'
    visible.value = true

    return new Promise((resolve) => {
      resolvePromise = resolve
    })
  }

  function handleConfirm(): void {
    visible.value = false
    resolvePromise?.(true)
    resolvePromise = null
  }

  function handleCancel(): void {
    visible.value = false
    resolvePromise?.(false)
    resolvePromise = null
  }

  return {
    visible,
    title,
    message,
    confirmText,
    cancelText,
    confirmClass,
    confirm,
    handleConfirm,
    handleCancel
  }
}
