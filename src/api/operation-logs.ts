// src/api/operation-logs.ts
import { edgeFn } from '@/api/http'

export interface OperationLogFilters {
  page?: number
  pageSize?: number
  startDate?: string
  endDate?: string
  operation?: string
  apiName?: string
  userId?: string
}

export interface OperationLog {
  id: string
  created_at: string
  user_id: string | null
  user_email: string | null
  client_ip: string | null
  operation: string
  api_name: string | null
  request_body: Record<string, unknown> | null
  response_body: Record<string, unknown> | null
  response_status: number | null
  duration_ms: number | null
  error_message: string | null
  extra: Record<string, unknown> | null
}

export interface OperationLogResponse {
  ok: boolean
  items: OperationLog[]
  total: number
  page: number
  page_size: number
  is_admin: boolean
}

export async function fetchOperationLogs(filters: OperationLogFilters): Promise<OperationLogResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.pageSize) params.set('page_size', String(filters.pageSize))
  if (filters.startDate) params.set('start_date', filters.startDate)
  if (filters.endDate) params.set('end_date', filters.endDate)
  if (filters.operation) params.set('operation', filters.operation)
  if (filters.apiName) params.set('api_name', filters.apiName)
  if (filters.userId) params.set('user_id', filters.userId)
  const qs = params.toString()
  return edgeFn.get<OperationLogResponse>(`/operation-logs${qs ? `?${qs}` : ''}`)
}