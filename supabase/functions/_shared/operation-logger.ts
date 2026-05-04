// supabase/functions/_shared/operation-logger.ts
// 操作日志记录工具，所有 Edge Function 统一调用

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SENSITIVE_KEYS = new Set([
  'token', 'access_token', 'password', 'authorization', 'api_key', 'secret', 'apikey'
])

const MAX_RESPONSE_CHARS = 2000

export interface OperationLogEntry {
  userId?: string
  userEmail?: string
  clientIp: string
  operation: string
  apiName: string
  requestBody?: unknown
  responseBody?: unknown
  responseStatus: number
  durationMs: number
  errorMessage?: string
  extra?: Record<string, unknown>
}

function removeSensitiveFields(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  if (Array.isArray(body)) return body.map(removeSensitiveFields)
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue
    cleaned[key] = removeSensitiveFields(value)
  }
  return cleaned
}

function truncateResponse(body: unknown): unknown {
  if (body === null || body === undefined) return null
  const str = JSON.stringify(body)
  if (str.length <= MAX_RESPONSE_CHARS) return body
  try {
    return JSON.parse(str.slice(0, MAX_RESPONSE_CHARS))
  } catch {
    return str.slice(0, MAX_RESPONSE_CHARS)
  }
}

function sanitizeLogEntry(entry: OperationLogEntry) {
  return {
    user_id: entry.userId || null,
    user_email: entry.userEmail || null,
    client_ip: entry.clientIp,
    operation: entry.operation,
    api_name: entry.apiName,
    request_body: removeSensitiveFields(entry.requestBody),
    response_body: truncateResponse(entry.responseBody),
    response_status: entry.responseStatus,
    duration_ms: entry.durationMs,
    error_message: entry.errorMessage || null,
    extra: entry.extra || null
  }
}

/**
 * 异步写入操作日志，不阻塞响应。
 * 仅在 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 可用时写入。
 */
export async function logOperation(entry: OperationLogEntry): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  if (!supabaseUrl || !serviceRoleKey) return

  try {
    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const sanitized = sanitizeLogEntry(entry)
    await adminClient.from('operation_logs').insert(sanitized)
  } catch (err) {
    // 日志写入失败不阻塞业务，仅打印
    console.error('[operation-logger] write failed:', err instanceof Error ? err.message : String(err))
  }
}
