// [2026-04-30] 新增：AI 配置 API 层（通过 ai-config Edge Function）
import { edgeFn } from '@/lib/edge'
import type { AiProviderConfig, AiConfigPayload, TestResult } from '@/features/ai'

export const aiConfigApi = {
  list: (): Promise<AiProviderConfig[]> => edgeFn.get<AiProviderConfig[]>('/ai-config'),

  create: (payload: AiConfigPayload): Promise<AiProviderConfig> =>
    edgeFn.post<AiProviderConfig>('/ai-config', payload),

  update: (id: string, payload: Partial<AiConfigPayload>): Promise<AiProviderConfig> =>
    edgeFn.patch<AiProviderConfig>(`/ai-config/${id}`, payload),

  remove: (id: string): Promise<void> => edgeFn.del(`/ai-config/${id}`),

  activate: (id: string): Promise<void> => edgeFn.post<void>(`/ai-config/${id}/activate`),

  test: (id: string): Promise<TestResult> => edgeFn.post<TestResult>(`/ai-config/${id}/test`)
}
