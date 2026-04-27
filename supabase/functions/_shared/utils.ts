export function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.floor(n)
}

export function parseBoolean(raw: string | undefined): boolean {
  return /^(1|true|yes)$/i.test(String(raw || '').trim())
}
