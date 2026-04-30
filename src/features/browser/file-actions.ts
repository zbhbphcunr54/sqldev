import { downloadTextFileByDom, fallbackCopyTextByDom } from '../../utils/browser-dom'

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

export async function copyTextToClipboard(text: unknown): Promise<boolean> {
  const content = String(text || '')
  if (!content.trim()) return false

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(content)
      return true
    } catch {
      return fallbackCopyTextByDom(content)
    }
  }

  return fallbackCopyTextByDom(content)
}

export function downloadSqlTextFile(text: unknown, prefix: unknown, dbKey: unknown): string {
  const content = String(text || '')
  if (!content.trim()) return ''

  const fileName = buildSqlDownloadFileName(prefix, dbKey)
  downloadTextFileByDom(content, fileName, 'text/sql;charset=utf-8')

  return fileName
}
