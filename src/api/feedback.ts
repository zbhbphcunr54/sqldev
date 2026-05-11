import { edgeFn } from '@/api/http'

export interface FeedbackRequest {
  category: 'bug' | 'feature' | 'ux' | 'performance' | 'other'
  content: string
  source: 'splash' | 'workbench' | 'ziwei'
}

export interface FeedbackResponse {
  ok: boolean
  id?: string
  error?: string
}

export async function submitFeedback(payload: FeedbackRequest): Promise<FeedbackResponse> {
  return edgeFn.post<FeedbackResponse>('/feedback', payload, { skipRetry: true })
}
