// src/features/rules/sync.ts
// 规则数据 Supabase 同步层：写入 localStorage 后异步同步到 Supabase
// 读取时从 Supabase 拉取最新数据更新 localStorage，保证 legacy 代码正常工作

import { saveUserRules, fetchUserRules } from '@/api/rules'

const DDL_KEY = 'ojw_ddlRules'
const BODY_KEY = 'ojw_bodyRules'

let syncInProgress = false

/**
 * 从 Supabase 拉取最新规则并更新 localStorage。
 * 登录后调用，确保本地数据与远端一致。
 */
export async function syncRulesFromServer(): Promise<void> {
  if (syncInProgress) return
  syncInProgress = true

  try {
    const ddlResult = await fetchUserRules('ddl')
    if (ddlResult.rules_json && Object.keys(ddlResult.rules_json).length > 0) {
      try {
        localStorage.setItem(DDL_KEY, JSON.stringify(ddlResult.rules_json))
      } catch { /* quota error ignored */ }
    }

    const bodyResult = await fetchUserRules('body')
    if (bodyResult.rules_json && Object.keys(bodyResult.rules_json).length > 0) {
      try {
        localStorage.setItem(BODY_KEY, JSON.stringify(bodyResult.rules_json))
      } catch { /* quota error ignored */ }
    }
  } catch {
    // 网络错误不阻塞，下次再试
  } finally {
    syncInProgress = false
  }
}

/**
 * 将规则数据异步同步到 Supabase。
 * 写入 localStorage 后调用，不阻塞 UI。
 */
export async function syncRulesToServer(
  kind: 'ddl' | 'body',
  rulesJson: Record<string, unknown>
): Promise<void> {
  try {
    await saveUserRules(kind, rulesJson)
  } catch {
    // 网络错误不阻塞，下次 syncRulesFromServer 时会覆盖
  }
}

/**
 * 懒迁移：将 localStorage 中的规则数据迁移到 Supabase。
 * 登录后首次调用，迁移成功后删除 localStorage key。
 */
export async function migrateRulesToServer(): Promise<void> {
  for (const [kind, storageKey] of [['ddl', DDL_KEY], ['body', BODY_KEY]] as const) {
    const localData = localStorage.getItem(storageKey)
    if (!localData) continue

    try {
      const rulesJson = JSON.parse(localData)
      if (rulesJson && typeof rulesJson === 'object' && Object.keys(rulesJson).length > 0) {
        await saveUserRules(kind, rulesJson)
        localStorage.removeItem(storageKey)
      }
    } catch {
      // 迁移失败不阻塞，下次再试
    }
  }
}