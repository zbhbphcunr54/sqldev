import { invokeEdgeFunction } from '@/api/http'

export interface ConvertRequest {
  sourceDialect: 'oracle' | 'mysql' | 'postgresql'
  targetDialect: 'oracle' | 'mysql' | 'postgresql'
  sql: string
  rules?: string[]
}

export interface ConvertResponse {
  ok: boolean
  outputSql?: string
  warnings?: string[]
  error?: string
}

export async function requestConvert(payload: ConvertRequest): Promise<ConvertResponse> {
  return await invokeEdgeFunction<ConvertRequest, ConvertResponse>('convert', payload)
}
