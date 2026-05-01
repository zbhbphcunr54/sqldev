// [2026-04-30] 新增：AI 供应商 API 层
import { supabase } from '@/lib/supabase'
import type { AiProviderDef } from '@/features/ai'

export async function fetchProviders(adminView = false): Promise<AiProviderDef[]> {
  let query = supabase.from('ai_providers').select('*').order('sort_order')

  // [2026-04-30] RLS 已对非管理员过滤 is_enabled；管理员视角需看到全部（含禁用）
  if (!adminView) {
    query = query.eq('is_enabled', true)
  }

  const { data, error } = await query
  if (error) throw error
  return data as AiProviderDef[]
}
