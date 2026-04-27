import { supabase } from '@/lib/supabase'
import { mapErrorCodeToMessage } from '@/utils/error-map'

export class ApiError extends Error {
  code: string
  status: number

  constructor(message: string, code = 'api_error', status = 500) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

export async function invokeEdgeFunction<TReq extends Record<string, unknown>, TRes>(
  functionName: string,
  body: TReq
): Promise<TRes> {
  const {
    data: { session }
  } = await supabase.auth.getSession()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`
  }

  const projectUrl = import.meta.env.VITE_SUPABASE_URL
  if (!projectUrl) {
    throw new ApiError('Missing env: VITE_SUPABASE_URL', 'missing_supabase_url', 500)
  }

  const url = `${projectUrl}/functions/v1/${functionName}`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  const text = await res.text()
  let parsed: Record<string, unknown> = {}
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = {}
    }
  }

  if (!res.ok) {
    const errorCode = String(parsed.error || parsed.code || 'request_failed')
    throw new ApiError(mapErrorCodeToMessage(errorCode), errorCode, res.status)
  }

  return parsed as TRes
}
