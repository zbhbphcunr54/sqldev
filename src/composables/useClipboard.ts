import { fallbackCopyTextByDom } from '@/utils/browser-dom'

export function useClipboard() {
  async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        console.warn('[useClipboard] modern API failed, falling back to DOM method')
      }
    }

    return fallbackCopyTextByDom(text)
  }

  return { copyToClipboard }
}
