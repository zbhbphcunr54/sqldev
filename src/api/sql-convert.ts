import { edgeFn } from '@/api/http'
import { ApiError } from '@/lib/edge'

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
