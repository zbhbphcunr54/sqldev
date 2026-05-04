// [2026-05-03] 新增：应用配置 API

import { edgeFn } from '@/api/http'
import type { AppConfig, CreateConfigPayload, UpdateConfigPayload } from '@/features/app-config'

export const appConfigApi = {
  list: (category?: string) => {
    const url = category ? `/app-config?category=${category}` : '/app-config'
    return edgeFn.get<{ ok: boolean; configs: AppConfig[] }>(url)
  },

  create: (config: CreateConfigPayload) =>
    edgeFn.post<{ ok: boolean; config: AppConfig }>('/app-config', config),

  update: (id: string, config: UpdateConfigPayload) =>
    edgeFn.patch<{ ok: boolean; config: AppConfig }>(`/app-config/${id}`, config),

  delete: (id: string) => edgeFn.del(`/app-config/${id}`),

  clearCache: () => edgeFn.post<{ ok: boolean }>('/app-config/clear-cache')
}
