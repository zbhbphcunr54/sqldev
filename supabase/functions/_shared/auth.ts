export type SessionValidationResult =
  | { state: 'valid'; userId: string; email: string }
  | { state: 'invalid' | 'error' }

function buildAuthUserEndpoint(supabaseUrl: string): string {
  return supabaseUrl ? `${supabaseUrl}/auth/v1/user` : ''
}

export function extractBearerToken(authorization: string | null): string {
  const auth = authorization || ''
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : ''
}

export async function validateUserSession(
  token: string,
  options: { supabaseUrl: string; supabaseAnonKey: string }
): Promise<SessionValidationResult> {
  const authUserEndpoint = buildAuthUserEndpoint(options.supabaseUrl)
  if (!authUserEndpoint || !options.supabaseAnonKey) return { state: 'error' }

  try {
    const res = await fetch(authUserEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: options.supabaseAnonKey
      }
    })
    if (res.ok) {
      const payload = await res.json().catch(() => null)
      const userId = typeof payload?.id === 'string' ? payload.id : ''
      const email = typeof payload?.email === 'string' ? payload.email.trim().toLowerCase() : ''
      if (!userId) return { state: 'error' }
      return { state: 'valid', userId, email }
    }
    if (res.status === 401 || res.status === 403) return { state: 'invalid' }
    return { state: 'error' }
  } catch (_err) {
    return { state: 'error' }
  }
}

export async function validateBearerToken(
  authorization: string | null,
  options: { supabaseUrl: string; supabaseAnonKey: string }
): Promise<{ userId: string; email: string } | null> {
  const token = extractBearerToken(authorization)
  if (!token) return null
  const state = await validateUserSession(token, options)
  if (state.state !== 'valid') return null
  return { userId: state.userId, email: state.email }
}
