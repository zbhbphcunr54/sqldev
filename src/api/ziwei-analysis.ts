// src/api/ziwei-analysis.ts
import { edgeFn } from '@/api/http'

export interface ZiweiChartData {
  boardCells: Array<Record<string, unknown>>
  center: Record<string, unknown>
  daXianTimeline: Array<Record<string, unknown>>
  liuNianTimeline: Array<Record<string, unknown>>
  text: string
}

export interface ZiweiAnalysisRequest {
  chart: ZiweiChartData
  profileName?: string
  gender?: string
  school?: string
}

export interface ZiweiAnalysisResult {
  overview: string
  sections: Array<{
    title: string
    summary: string
    evidence?: string[]
    advice?: string[]
  }>
  yearFocus?: {
    summary: string
    opportunities?: string[]
    risks?: string[]
  }
}

export interface ZiweiAnalysisResponse {
  ok: boolean
  data?: ZiweiAnalysisResult
  error?: string
}

export interface ZiweiQaRequest extends ZiweiAnalysisRequest {
  question: string
  analysis?: ZiweiAnalysisResult | null
}

export interface ZiweiQaResponse {
  ok: boolean
  answer?: string
  data?: {
    answer?: string
    analysis?: {
      overview?: string
    }
  }
  error?: string
}

export async function requestZiweiAnalysis(
  request: ZiweiAnalysisRequest
): Promise<ZiweiAnalysisResponse> {
  return edgeFn.post<ZiweiAnalysisResponse>('/ziwei-analysis', request)
}

export async function requestZiweiQa(
  request: ZiweiQaRequest
): Promise<ZiweiQaResponse> {
  return edgeFn.post<ZiweiQaResponse>('/ziwei-qa', request)
}
