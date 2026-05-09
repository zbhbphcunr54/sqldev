// src/api/rules.ts
import { edgeFn } from '@/api/http'

export type DbType = 'oracle' | 'mysql' | 'pg'
export type RuleKind = 'ddl' | 'body'

export interface RuleItem {
  source: string
  target: string
}

export interface BodyRuleItem {
  s: string
  t: string
}

export interface UserRulesResponse {
  ok: boolean
  id: number
  source_db: DbType
  target_db: DbType
  kind: RuleKind
  rules_json: RuleItem[] | BodyRuleItem[]
  updated_at: string | null
}

export async function fetchUserRules(
  sourceDb: DbType,
  targetDb: DbType,
  kind: RuleKind
): Promise<UserRulesResponse> {
  return edgeFn.post<UserRulesResponse>('/rules', {
    source_db: sourceDb,
    target_db: targetDb,
    kind
  })
}

export async function saveUserRules(
  sourceDb: DbType,
  targetDb: DbType,
  kind: RuleKind,
  rulesJson: RuleItem[] | BodyRuleItem[]
): Promise<UserRulesResponse> {
  return edgeFn.put<UserRulesResponse>('/rules', {
    source_db: sourceDb,
    target_db: targetDb,
    kind,
    rules_json: rulesJson
  })
}

export async function resetUserRules(
  sourceDb: DbType,
  targetDb: DbType,
  kind: RuleKind
): Promise<{ ok: boolean; source_db: string; target_db: string; kind: string }> {
  return edgeFn.post<{ ok: boolean; source_db: string; target_db: string; kind: string }>(
    '/rules/reset',
    {
      source_db: sourceDb,
      target_db: targetDb,
      kind
    }
  )
}
