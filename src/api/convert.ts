import { invokeEdgeFunction } from '@/api/http'

export interface ConvertRequest {
  sourceDialect: 'oracle' | 'mysql' | 'postgresql'
  targetDialect: 'oracle' | 'mysql' | 'postgresql'
  sql: string
  kind?: 'ddl' | 'func' | 'proc'
  rules?: Record<string, unknown>
}

export interface ConvertResponse {
  ok: boolean
  outputSql?: string
  warnings?: string[]
  error?: string
  rulesSource?: string
  rulesVersion?: string
}

export async function requestConvert(payload: ConvertRequest): Promise<ConvertResponse> {
  type ConvertEdgeResponse = {
    output?: string
    rulesSource?: string
    rulesVersion?: string
  }

  const result = await invokeEdgeFunction<
    {
      kind: 'ddl' | 'func' | 'proc'
      fromDb: 'oracle' | 'mysql' | 'postgresql'
      toDb: 'oracle' | 'mysql' | 'postgresql'
      input: string
      rules?: Record<string, unknown>
    },
    ConvertEdgeResponse
  >('convert', {
    kind: payload.kind || 'ddl',
    fromDb: payload.sourceDialect,
    toDb: payload.targetDialect,
    input: payload.sql,
    ...(payload.rules ? { rules: payload.rules } : {})
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
    rulesSource: result.rulesSource,
    rulesVersion: result.rulesVersion
  }
}
