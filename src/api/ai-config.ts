import { edgeFn } from '@/api/http'
import type { AiProviderConfig, AiProviderDef, AiConfigPayload, TestResult } from '@/features/ai'

type AiConfigListResponse = { ok: boolean; configs: AiProviderConfig[] }
type AiConfigAllResponse = {
  ok: boolean
  providers: AiProviderDef[]
  personal_configs: AiProviderConfig[]
  global_configs: AiProviderConfig[]
  has_global_active?: boolean
}
type AiConfigSingleResponse = { ok: boolean; config: AiProviderConfig }
type AiProviderResponse = { ok: boolean; provider: AiProviderDef }
type AiConfigMutationResponse = { ok: boolean }

export type AiConfigScope = 'personal' | 'global' | 'all'

export const aiConfigApi = {
  fetchAll: async (
    scope: AiConfigScope = 'personal'
  ): Promise<{
    providers: AiProviderDef[]
    personalConfigs: AiProviderConfig[]
    globalConfigs: AiProviderConfig[]
    hasGlobalActive: boolean
  }> => {
    const res = await edgeFn.get<AiConfigAllResponse>(`/ai-config?scope=${scope}`)
    return {
      providers: res.providers,
      personalConfigs: res.personal_configs ?? [],
      globalConfigs: res.global_configs ?? [],
      hasGlobalActive: res.has_global_active === true
    }
  },

  list: async (scope: Exclude<AiConfigScope, 'all'> = 'personal'): Promise<AiProviderConfig[]> => {
    const res = await edgeFn.get<AiConfigListResponse>(`/ai-config?scope=${scope}`)
    return res.configs
  },

  create: async (
    payload: AiConfigPayload,
    scope: Exclude<AiConfigScope, 'all'> = 'personal'
  ): Promise<AiProviderConfig> => {
    const res = await edgeFn.post<AiConfigSingleResponse>('/ai-config', { ...payload, scope })
    return res.config
  },

  update: async (id: string, payload: Partial<AiConfigPayload>): Promise<AiProviderConfig> => {
    const res = await edgeFn.patch<AiConfigSingleResponse>(`/ai-config/${id}`, payload)
    return res.config
  },

  remove: (id: string): Promise<AiConfigMutationResponse> => edgeFn.del(`/ai-config/${id}`),

  activate: (id: string): Promise<AiConfigMutationResponse> =>
    edgeFn.post(`/ai-config/${id}/activate`),

  deactivate: (id: string): Promise<AiConfigMutationResponse> =>
    edgeFn.post(`/ai-config/${id}/deactivate`),

  test: (id: string): Promise<TestResult> =>
    edgeFn.post<TestResult>(`/ai-config/${id}/test`, undefined, { skipRetry: true }),

  reorderProviders: (orders: { provider_id: string; sort_order: number }[]): Promise<void> =>
    edgeFn.post('/ai-config/providers/reorder', { orders }),

  createProvider: async (payload: {
    label: string
    slug: string
    base_url: string
    region?: string
    api_format?: string
    models: string[]
  }): Promise<AiProviderDef> => {
    const res = await edgeFn.post<AiProviderResponse>('/ai-config/providers', payload)
    return res.provider
  },

  deleteProvider: (providerId: string): Promise<void> =>
    edgeFn.del(`/ai-config/providers/${providerId}`),

  updateProvider: async (
    providerId: string,
    payload: {
      label?: string
      base_url?: string
      region?: string
      api_format?: string
      models?: string[]
    }
  ): Promise<AiProviderDef> => {
    const res = await edgeFn.patch<AiProviderResponse>(
      `/ai-config/providers/${providerId}`,
      payload
    )
    return res.provider
  }
}
