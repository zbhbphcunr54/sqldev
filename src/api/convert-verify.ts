import { invokeEdgeFunction } from '@/lib/edge'

export interface ConvertVerifyRequest {
  kind: 'ddl' | 'func' | 'proc'
  fromDb: 'oracle' | 'mysql' | 'postgresql'
  toDb: 'oracle' | 'mysql' | 'postgresql'
  inputSql: string
  outputSql: string
  profileId?: string
}

export interface SyntaxIssue {
  line: number
  severity: 'error' | 'warning' | 'info'
  message: string
  fix: string
}

export interface SemanticIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  original: string
  converted: string
}

export interface LogicRisk {
  category: 'performance' | 'data_precision' | 'charset' | 'identifier' | 'reserved_word' | 'transaction' | 'partition' | 'other'
  severity: 'high' | 'medium' | 'low'
  message: string
  impact: string
}

export interface Suggestion {
  priority: 'high' | 'medium' | 'low'
  targetSql: string
  explanation: string
}

export interface QuotaInfo {
  kind: string
  used: number
  limit: number
  remaining: number
}

export interface ConvertVerifyResponse {
  ok: boolean
  overallScore?: number
  syntaxIssues?: SyntaxIssue[]
  semanticIssues?: SemanticIssue[]
  logicRisks?: LogicRisk[]
  suggestions?: Suggestion[]
  summary?: string
  cached?: boolean
  durationMs?: number
  model?: string
  quota?: QuotaInfo
  error?: string
  message?: string
}

export interface QuotaByKind {
  ddl: { used: number; limit: number; remaining: number }
  func: { used: number; limit: number; remaining: number }
  proc: { used: number; limit: number; remaining: number }
}

export interface QuotaResponse {
  ok: boolean
  quota: QuotaByKind
}

export async function requestConvertVerify(
  payload: ConvertVerifyRequest
): Promise<ConvertVerifyResponse> {
  return invokeEdgeFunction<ConvertVerifyRequest, ConvertVerifyResponse>(
    'convert-verify',
    payload
  )
}

export async function fetchVerifyQuota(): Promise<QuotaByKind> {
  const result = await invokeEdgeFunction<never, QuotaResponse>(
    'convert-verify?action=quota',
    undefined as never,
    { method: 'GET' }
  )
  return result.quota
}
