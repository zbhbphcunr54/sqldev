const INTERNAL_REDIRECT_FALLBACK = '/workbench'
const URL_SCHEME_RE = /^[a-z][a-z\d+.-]*:/i

export function sanitizeInternalRedirectPath(raw: unknown): string {
  const value = String(raw || '').trim()
  if (!value) return INTERNAL_REDIRECT_FALLBACK
  if (!value.startsWith('/')) return INTERNAL_REDIRECT_FALLBACK
  if (value.startsWith('//')) return INTERNAL_REDIRECT_FALLBACK
  if (value.includes('\\')) return INTERNAL_REDIRECT_FALLBACK
  if (URL_SCHEME_RE.test(value)) return INTERNAL_REDIRECT_FALLBACK

  try {
    const decoded = decodeURIComponent(value)
    if (URL_SCHEME_RE.test(decoded)) return INTERNAL_REDIRECT_FALLBACK
    if (decoded.startsWith('//')) return INTERNAL_REDIRECT_FALLBACK
    if (decoded.includes('\\')) return INTERNAL_REDIRECT_FALLBACK
  } catch {
    return INTERNAL_REDIRECT_FALLBACK
  }

  return value
}
