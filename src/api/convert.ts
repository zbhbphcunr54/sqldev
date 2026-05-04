import { edgeFn } from '@/api/http'

export interface ConvertRequest {
  sourceDialect: 'oracle' | 'mysql' | 'postgresql'
  targetDialect: 'oracle' | 'mysql' | 'postgresql'
  sql: string
  kind?: 'ddl' | 'func' | 'proc'
}

export interface ConvertResponse {
  ok: boolean
  outputSql?: string
  warnings?: string[]
  error?: string
  cached?: boolean
  rulesSource?: string
  rulesVersion?: string
}

type ConvertEdgeResponse = {
  output?: string
  cached?: boolean
  rulesSource?: string
  rulesVersion?: string
}

export async function requestConvert(payload: ConvertRequest): Promise<ConvertResponse> {
  try {
    const result = await edgeFn.post<ConvertEdgeResponse>('/convert', {
      kind: payload.kind || 'ddl',
      fromDb: payload.sourceDialect,
      toDb: payload.targetDialect,
      input: payload.sql
    })

    if (typeof result.output !== 'string') {
      return {
        ok: false,
        outputSql: '',
        warnings: [],
        error: 'invalid_response'
      }
    }

    return {
      ok: true,
      outputSql: result.output,
      warnings: [],
      cached: result.cached ?? false,
      rulesSource: result.rulesSource,
      rulesVersion: result.rulesVersion
    }
  } catch (err) {
    return {
      ok: false,
      outputSql: '',
      warnings: [],
      error: String(err)
    }
  }
}
