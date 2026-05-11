import { onMounted, onUnmounted } from 'vue'

export function useEscapeKey(callback: () => void): void {
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') callback()
  }
  onMounted(() => document.addEventListener('keydown', onKeydown))
  onUnmounted(() => document.removeEventListener('keydown', onKeydown))
}
