import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parsePositiveInt } from '../_shared/utils.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const DAILY_LIMIT = parsePositiveInt(Deno.env.get('CONVERT_VERIFY_DAILY_LIMIT'), 10)

export interface QuotaInfo {
  allowed: boolean
  remaining: number
  used: number
  limit: number
}

export interface QuotaByKind {
  ddl: { used: number; limit: number; remaining: number }
  func: { used: number; limit: number; remaining: number }
  proc: { used: number; limit: number; remaining: number }
}

function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

function getTodayUTC8(): string {
  const now = new Date()
  const utc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  return utc8.toISOString().split('T')[0]
}

export async function checkQuota(
  userId: string,
  kind: string
): Promise<QuotaInfo> {
  const adminClient = getAdminClient()
  if (!adminClient) {
    return { allowed: true, remaining: DAILY_LIMIT, used: 0, limit: DAILY_LIMIT }
  }

  const today = getTodayUTC8()

  try {
    const { data } = await adminClient
      .from('verify_quota')
      .select('used_count')
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('usage_date', today)
      .single()

    const used = data?.used_count ?? 0
    return {
      allowed: used < DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - used),
      used,
      limit: DAILY_LIMIT
    }
  } catch {
    return { allowed: true, remaining: DAILY_LIMIT, used: 0, limit: DAILY_LIMIT }
  }
}

export async function incrementQuota(
  userId: string,
  kind: string
): Promise<void> {
  const adminClient = getAdminClient()
  if (!adminClient) return

  const today = getTodayUTC8()

  try {
    await adminClient.rpc('increment_verify_quota', {
      p_user_id: userId,
      p_kind: kind,
      p_date: today
    })
  } catch (err) {
    console.error('Failed to increment quota:', err)
  }
}

export async function getQuotaInfo(userId: string): Promise<QuotaByKind> {
  const adminClient = getAdminClient()
  const defaultQuota = { used: 0, limit: DAILY_LIMIT, remaining: DAILY_LIMIT }

  if (!adminClient) {
    return {
      ddl: { ...defaultQuota },
      func: { ...defaultQuota },
      proc: { ...defaultQuota }
    }
  }

  const today = getTodayUTC8()

  try {
    const { data } = await adminClient
      .from('verify_quota')
      .select('kind, used_count')
      .eq('user_id', userId)
      .eq('usage_date', today)

    const result: QuotaByKind = {
      ddl: { ...defaultQuota },
      func: { ...defaultQuota },
      proc: { ...defaultQuota }
    }

    for (const row of data || []) {
      const kind = row.kind as keyof QuotaByKind
      if (kind in result) {
        const used = row.used_count ?? 0
        result[kind] = {
          used,
          limit: DAILY_LIMIT,
          remaining: Math.max(0, DAILY_LIMIT - used)
        }
      }
    }

    return result
  } catch {
    return {
      ddl: { ...defaultQuota },
      func: { ...defaultQuota },
      proc: { ...defaultQuota }
    }
  }
}
