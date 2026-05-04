// src/api/ziwei-history.ts
import { edgeFn } from '@/api/http'

export interface ZiweiHistoryItem {
  id: string
  input_json: Record<string, unknown>
  result_json: Record<string, unknown> | null
  created_at: string
}

export interface ZiweiHistoryListResponse {
  ok: boolean
  items: ZiweiHistoryItem[]
}

export interface ZiweiHistoryCreateResponse {
  ok: boolean
  id: string
  created_at: string
}

export async function fetchZiweiHistory(): Promise<ZiweiHistoryListResponse> {
  return edgeFn.get<ZiweiHistoryListResponse>('/ziwei-history')
}

export async function createZiweiHistory(
  inputJson: Record<string, unknown>,
  resultJson?: Record<string, unknown>
): Promise<ZiweiHistoryCreateResponse> {
  return edgeFn.post<ZiweiHistoryCreateResponse>('/ziwei-history', { input_json: inputJson, result_json: resultJson ?? null })
}

export async function deleteZiweiHistory(id: string): Promise<{ ok: boolean; id: string }> {
  return edgeFn.del(`/ziwei-history?id=${id}`)
}