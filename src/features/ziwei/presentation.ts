export function formatZiweiHistoryTime(timestampValue: unknown): string {
  const ms = Number(timestampValue)
  if (!Number.isFinite(ms) || ms <= 0) return '--'

  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return '--'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}

export function formatZiweiDurationText(msValue: unknown): string {
  const value = Number(msValue || 0)
  if (!Number.isFinite(value) || value <= 0) return ''

  const totalSeconds = Math.max(1, Math.round(value / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}分${String(seconds).padStart(2, '0')}秒`
}

export function isLikelyMojibakeZh(textValue: unknown): boolean {
  const text = String(textValue || '')
  if (!text) return false
  const hit = (text.match(/[锛銆鍙闂璇鎴浠鐨鎬]/g) || []).length
  return hit >= 2
}

export function normalizeZiweiQaSuggestionText(textValue: unknown): string {
  let text = String(textValue || '').trim()
  if (!text) return ''
  text = text.replace(/身体([^与和及、，,\s/-]{1,2})健康/g, '身体与健康')
  return text
}
