import { edgeFn } from '@/api/http'
import { ApiError } from '@/lib/edge'
import { supabase } from '@/lib/supabase'

export interface SqlConvertRequest {
  sourceDb: string
  targetDb: string
  sqlType: string
  inputSql: string
}

export interface SqlConvertResponse {
  ok: boolean
  outputSql?: string
  aiRatio?: number
  manualNeeded?: boolean
  manualParts?: string[]
  notes?: string[]
  accuracy?: string
  error?: string
  model?: string
  durationMs?: number
}

export interface SqlConvertStreamHandlers {
  onMeta?: (payload: { model?: string }) => void
  onDelta?: (payload: { text: string; replace?: boolean }) => void
}

type EdgeResponse = {
  output_sql?: string
  ai_ratio?: number
  manual_needed?: boolean
  manual_parts?: string[]
  notes?: string[]
  accuracy?: string
  model?: string
  duration_ms?: number
}

export async function requestSqlConvert(payload: SqlConvertRequest): Promise<SqlConvertResponse> {
  try {
    const result = await edgeFn.post<EdgeResponse>('/sql-convert', {
      source_db: payload.sourceDb,
      target_db: payload.targetDb,
      sql_type: payload.sqlType,
      input_sql: payload.inputSql
    }, { skipRetry: true })

    if (typeof result.output_sql !== 'string') {
      return { ok: false, error: 'invalid_response' }
    }

    return {
      ok: true,
      outputSql: result.output_sql,
      aiRatio: result.ai_ratio,
      manualNeeded: result.manual_needed,
      manualParts: result.manual_parts,
      notes: result.notes,
      accuracy: result.accuracy,
      model: result.model,
      durationMs: result.duration_ms
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof ApiError ? err.code : 'network_error'
    }
  }
}

function parseSseChunk(buffer: string): { rest: string; events: Array<{ event: string; data: string }> } {
  let working = buffer
  const events: Array<{ event: string; data: string }> = []

  while (true) {
    const boundaryIndex = working.indexOf('\n\n')
    if (boundaryIndex < 0) break

    const rawEvent = working.slice(0, boundaryIndex)
    working = working.slice(boundaryIndex + 2)

    const lines = rawEvent.split(/\r?\n/).filter(Boolean)
    let event = 'message'
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
    }

    events.push({ event, data: dataLines.join('\n') })
  }

  return { rest: working, events }
}

export async function requestSqlConvertStream(
  payload: SqlConvertRequest,
  handlers?: SqlConvertStreamHandlers
): Promise<SqlConvertResponse> {
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
    return { ok: false, error: 'missing_supabase_url' }
  }

  const res = await fetch(`${projectUrl}/functions/v1/sql-convert`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_db: payload.sourceDb,
      target_db: payload.targetDb,
      sql_type: payload.sqlType,
      input_sql: payload.inputSql,
      stream: true
    })
  }).catch(() => null)

  if (!res) {
    return { ok: false, error: 'network_error' }
  }

  if (!res.ok || !res.body) {
    let errorCode = 'request_failed'
    try {
      const parsed = await res.json() as { error?: string }
      errorCode = parsed.error || errorCode
    } catch {
      errorCode = res.status === 408 ? 'network_timeout' : 'request_failed'
    }
    return { ok: false, error: errorCode }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: SqlConvertResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parsed = parseSseChunk(buffer)
    buffer = parsed.rest

    for (const item of parsed.events) {
      if (!item.data) continue

      let data: Record<string, unknown>
      try {
        data = JSON.parse(item.data) as Record<string, unknown>
      } catch {
        continue
      }

      if (item.event === 'meta') {
        handlers?.onMeta?.({ model: typeof data.model === 'string' ? data.model : undefined })
      } else if (item.event === 'delta') {
        const text = typeof data.text === 'string' ? data.text : ''
        if (text) {
          handlers?.onDelta?.({
            text,
            replace: data.replace === true
          })
        }
      } else if (item.event === 'done') {
        finalResult = {
          ok: true,
          outputSql: typeof data.output_sql === 'string' ? data.output_sql : '',
          aiRatio: typeof data.ai_ratio === 'number' ? data.ai_ratio : undefined,
          manualNeeded: typeof data.manual_needed === 'boolean' ? data.manual_needed : undefined,
          manualParts: Array.isArray(data.manual_parts) ? data.manual_parts.map(String) : [],
          notes: Array.isArray(data.notes) ? data.notes.map(String) : [],
          accuracy: typeof data.accuracy === 'string' ? data.accuracy : undefined,
          model: typeof data.model === 'string' ? data.model : undefined,
          durationMs: typeof data.duration_ms === 'number' ? data.duration_ms : undefined
        }
      } else if (item.event === 'error') {
        return {
          ok: false,
          error: typeof data.error === 'string' ? data.error : 'request_failed'
        }
      }
    }
  }

  if (finalResult) return finalResult
  return { ok: false, error: 'invalid_response' }
}
