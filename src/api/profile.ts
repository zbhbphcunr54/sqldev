import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/supabase'

type ProfileRow = Database['public']['Tables']['profiles']['Row']

export async function fetchMyProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) return null
  return data
}
