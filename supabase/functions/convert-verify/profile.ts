import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { DEFAULT_ENVIRONMENTS, type VerifyEnvironment } from './prompt-template.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

interface VerifyProfileRow {
  ai_identity: string
  target_db_version: string
  source_db_version: string | null
  business_context: string | null
  special_requirements: string | null
}

function getAdminClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

export async function loadVerifyProfile(
  userId: string,
  fromDb: string,
  toDb: string,
  profileId?: string
): Promise<VerifyEnvironment> {
  const adminClient = getAdminClient()

  // Try to load from database if profileId provided
  if (profileId && adminClient) {
    try {
      const { data } = await adminClient
        .from('verify_profiles')
        .select('ai_identity, target_db_version, source_db_version, business_context, special_requirements')
        .eq('id', profileId)
        .eq('user_id', userId)
        .single()

      if (data) {
        return mapProfileRow(data)
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  // Try to load default profile
  if (adminClient) {
    try {
      const { data } = await adminClient
        .from('verify_profiles')
        .select('ai_identity, target_db_version, source_db_version, business_context, special_requirements')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single()

      if (data) {
        return mapProfileRow(data)
      }
    } catch (err) {
      console.error('Failed to load default profile:', err)
    }
  }

  // Fall back to default environment based on from/to db
  const key = `${fromDb}:${toDb}`
  return DEFAULT_ENVIRONMENTS[key] || {
    aiIdentity: `senior database migration expert (${fromDb} → ${toDb})`,
    targetDbVersion: toDb === 'mysql' ? 'MySQL 8.0' : toDb === 'postgresql' ? 'PostgreSQL 16' : 'Oracle 21c'
  }
}

function mapProfileRow(row: VerifyProfileRow): VerifyEnvironment {
  return {
    aiIdentity: row.ai_identity,
    targetDbVersion: row.target_db_version,
    sourceDbVersion: row.source_db_version || undefined,
    businessContext: row.business_context || undefined,
    specialRequirements: row.special_requirements || undefined
  }
}
