export function resolveSqlFileExtension(dbKey: unknown): 'mysql' | 'pgsql' | 'oracle' {
  if (dbKey === 'mysql') return 'mysql'
  if (dbKey === 'postgresql') return 'pgsql'
  return 'oracle'
}

export function buildSqlDownloadFileName(
  prefix: unknown,
  dbKey: unknown,
  date = new Date()
): string {
  const safePrefix = String(prefix || 'sql').trim() || 'sql'
  const ext = resolveSqlFileExtension(dbKey)
  const day = date.toISOString().slice(0, 10)
  return `${safePrefix}_${ext}_${day}.sql`
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(textarea)
  }
}

export async function copyTextToClipboard(text: unknown): Promise<boolean> {
  const content = String(text || '')
  if (!content.trim()) return false

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch {
      return fallbackCopyText(content)
    }
  }

  return fallbackCopyText(content)
}

export function downloadSqlTextFile(text: unknown, prefix: unknown, dbKey: unknown): string {
  const content = String(text || '')
  if (!content.trim()) return ''

  const fileName = buildSqlDownloadFileName(prefix, dbKey)
  const blob = new Blob([content], { type: 'text/sql;charset=utf-8' })
  const link = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)

  link.href = objectUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

  return fileName
}
