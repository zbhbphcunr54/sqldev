import { edgeFn } from './http'
import type { AiProviderDef } from '@/features/ai'

export async function fetchProviders(adminView = false): Promise<AiProviderDef[]> {
  const path = adminView ? '/ai-config/providers?admin=true' : '/ai-config/providers'
  const res = await edgeFn.get<{ ok: boolean; providers: AiProviderDef[] }>(path)
  return res.providers
}
