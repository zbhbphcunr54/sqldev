export function getClientIp(req: Request): string {
  const cf = (req.headers.get('cf-connecting-ip') || '').trim()
  if (cf) return cf
  const fwd = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || ''
  if (fwd) return fwd
  const real = (req.headers.get('x-real-ip') || '').trim()
  if (real) return real
  return 'unknown'
}

export function getRequestContentLength(req: Request): number {
  const raw = String(req.headers.get('content-length') || '').trim()
  if (!raw) return -1
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return -1
  return Math.floor(n)
}
