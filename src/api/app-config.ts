import { edgeFn } from '@/api/http'

export interface AppConfigItem {
  id: string
  key: string
  value: string | null
  value_type: string
  category: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AppConfigListResponse {
  ok: boolean
  configs: AppConfigItem[]
  is_admin?: boolean
}

export const appConfigApi = {
  list: (category?: string) => {
    const url = category ? `/app-config?category=${category}` : '/app-config'
    return edgeFn.get<AppConfigListResponse>(url)
  },
  getAdminStatus: () => edgeFn.get<{ ok: boolean; is_admin: boolean }>('/app-config/admin-status')
}
