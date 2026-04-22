import { invokeEdgeFunction } from '@/api/http'

export type ZiweiMode = 'config' | 'analysis' | 'qa'

export interface ZiweiAnalysisRequest {
  mode: 'analysis'
  style: 'pro' | 'simple'
  chart: Record<string, unknown> | string
  signature?: string
}

export interface ZiweiQaRequest {
  mode: 'qa'
  chart: Record<string, unknown> | string
  question: string
  signature?: string
}

export interface ZiweiConfigRequest {
  mode: 'config'
  signature?: string
}

export interface ZiweiAnalysisResponse {
  ok: boolean
  model?: string
  analysis?: Record<string, unknown>
  answer?: string
  config?: {
    suggestions?: string[]
  }
  error?: string
}

export async function requestZiweiAnalysis(payload: ZiweiAnalysisRequest): Promise<ZiweiAnalysisResponse> {
  return await invokeEdgeFunction<ZiweiAnalysisRequest, ZiweiAnalysisResponse>('ziwei-analysis', payload)
}

export async function requestZiweiQa(payload: ZiweiQaRequest): Promise<ZiweiAnalysisResponse> {
  return await invokeEdgeFunction<ZiweiQaRequest, ZiweiAnalysisResponse>('ziwei-analysis', payload)
}

export async function requestZiweiConfig(payload: ZiweiConfigRequest): Promise<ZiweiAnalysisResponse> {
  return await invokeEdgeFunction<ZiweiConfigRequest, ZiweiAnalysisResponse>('ziwei-analysis', payload)
}
