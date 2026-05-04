import { invokeEdgeFunction } from '@/lib/edge'

export interface VerifyProfile {
  id: string
  profile_name: string
  ai_identity: string
  target_db_version: string
  source_db_version?: string
  business_context?: string
  special_requirements?: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface SaveVerifyProfileRequest {
  profileName: string
  aiIdentity: string
  targetDbVersion: string
  sourceDbVersion?: string
  businessContext?: string
  specialRequirements?: string
  isDefault?: boolean
}

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
  message?: string
}

export async function fetchVerifyProfiles(): Promise<VerifyProfile[]> {
  const result = await invokeEdgeFunction<{ action: string }, ApiResponse<VerifyProfile[]>>(
    'verify-profiles',
    { action: 'list' }
  )
  return result.data || []
}

export async function saveVerifyProfile(
  payload: SaveVerifyProfileRequest
): Promise<VerifyProfile> {
  const result = await invokeEdgeFunction<SaveVerifyProfileRequest, ApiResponse<VerifyProfile>>(
    'verify-profiles',
    { action: 'save', ...payload }
  )
  if (!result.ok || !result.data) {
    throw new Error(result.message || result.error || '保存配置失败')
  }
  return result.data
}

export async function deleteVerifyProfile(id: string): Promise<void> {
  const result = await invokeEdgeFunction<{ action: string; id: string }, ApiResponse<void>>(
    'verify-profiles',
    { action: 'delete', id }
  )
  if (!result.ok) {
    throw new Error(result.message || result.error || '删除配置失败')
  }
}

export async function setDefaultVerifyProfile(id: string): Promise<VerifyProfile> {
  const result = await invokeEdgeFunction<{ action: string; id: string }, ApiResponse<VerifyProfile>>(
    'verify-profiles',
    { action: 'set_default', id }
  )
  if (!result.ok || !result.data) {
    throw new Error(result.message || result.error || '设置默认配置失败')
  }
  return result.data
}
