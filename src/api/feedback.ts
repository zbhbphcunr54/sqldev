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

export function warmupFeedback(): void {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url || typeof url !== 'string' || url === 'undefined') return
  fetch(`${url}/functions/v1/feedback`, { method: 'OPTIONS' }).catch(() => {
    // Warmup failure is non-critical; user may still submit successfully
  })
}
