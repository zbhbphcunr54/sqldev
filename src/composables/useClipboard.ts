// [2026-05-03] 新增：剪贴板操作 composable
export function useClipboard() {
  async function copyToClipboard(text: string): Promise<boolean> {
    if (!text) return false

    // Try modern API first
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Fall through to textarea method
      }
    }

    // Fallback to textarea method
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      return success
    } catch {
      console.error('[useClipboard] copy failed')
      return false
    }
  }

  return { copyToClipboard }
}
