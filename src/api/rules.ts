// src/api/rules.ts
import { edgeFn } from '@/api/http'

export interface UserRulesResponse {
  ok: boolean
  kind: 'ddl' | 'body'
  rules_json: Record<string, unknown>
  updated_at: string | null
}

export async function fetchUserRules(kind: 'ddl' | 'body'): Promise<UserRulesResponse> {
  return edgeFn.post<UserRulesResponse>('/rules', { kind })
}

export async function saveUserRules(
  kind: 'ddl' | 'body',
  rulesJson: Record<string, unknown>
): Promise<UserRulesResponse> {
  return edgeFn.put<UserRulesResponse>('/rules', { kind, rules_json: rulesJson })
}

export async function resetUserRules(kind: 'ddl' | 'body'): Promise<{ ok: boolean; kind: string }> {
  return edgeFn.del(`/rules?kind=${kind}`)
}