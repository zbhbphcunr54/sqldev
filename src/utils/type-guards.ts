export type RecordLike = Record<string, unknown>

export function asRecord(value: unknown): RecordLike {
  return value && typeof value === 'object' ? (value as RecordLike) : {}
}

export function asString(value: unknown): string {
  return String(value || '')
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asNumber(value: unknown): number {
  return Number(value || 0)
}
