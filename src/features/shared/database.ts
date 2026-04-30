export type SupportedDatabase = 'oracle' | 'mysql' | 'postgresql'

export function isSupportedDatabase(value: unknown): value is SupportedDatabase {
  return value === 'oracle' || value === 'mysql' || value === 'postgresql'
}

export function normalizeSupportedDatabase(value: unknown): SupportedDatabase | null {
  const normalized = String(value || '').toLowerCase()
  return isSupportedDatabase(normalized) ? normalized : null
}
