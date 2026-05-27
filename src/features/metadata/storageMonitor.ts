const QUOTA_BYTES = 5 * 1024 * 1024

export interface StorageUsage {
  usedBytes: number
  quotaBytes: number
  percent: number
  level: 'ok' | 'warning' | 'danger'
  metadataBytes: number
  metadataPercent: number
}

export function measureLocalStorageUsage(metadataKey = 'sqldev:workbench:metadata'): StorageUsage {
  let usedBytes = 0
  let metadataBytes = 0

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue
    const val = localStorage.getItem(key) ?? ''
    const bytes = (key.length + val.length) * 2
    usedBytes += bytes
    if (key === metadataKey) metadataBytes = bytes
  }

  const percent = Math.round((usedBytes / QUOTA_BYTES) * 100)
  const metadataPercent = Math.round((metadataBytes / QUOTA_BYTES) * 100)
  const level = percent >= 80 ? 'danger' : percent >= 60 ? 'warning' : 'ok'

  return { usedBytes, quotaBytes: QUOTA_BYTES, percent, level, metadataBytes, metadataPercent }
}
