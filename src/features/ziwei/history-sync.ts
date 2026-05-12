// src/features/ziwei/history-sync.ts
// 紫微排盘历史 Supabase 同步层

import { createZiweiHistory, fetchZiweiHistory } from '@/api/ziwei-history'

const ZW_HISTORY_KEY = 'sqldev_ziwei_history_v1'

/**
 * 从 Supabase 拉取最新历史并更新 localStorage。
 * 登录后调用。
 */
export async function syncHistoryFromServer(): Promise<void> {
  try {
    const result = await fetchZiweiHistory()
    if (result.items && result.items.length > 0) {
      try {
        localStorage.setItem(ZW_HISTORY_KEY, JSON.stringify(result.items))
      } catch (e) {
        console.warn('[ziwei:history-sync] localStorage.setItem quota exceeded:', e)
      }
    }
  } catch (e) {
    console.error('[ziwei:history-sync] syncHistoryFromServer failed:', e)
  }
}

/**
 * 懒迁移：将 localStorage 中的历史数据迁移到 Supabase。
 */
export async function migrateHistoryToServer(): Promise<void> {
  const localData = localStorage.getItem(ZW_HISTORY_KEY)
  if (!localData) return

  try {
    const history = JSON.parse(localData)
    if (!Array.isArray(history)) return

    for (const item of history) {
      try {
        await createZiweiHistory(item, item.result || null)
      } catch (e) {
        console.warn('[ziwei:history-sync] single item create failed:', e)
      }
    }
    localStorage.removeItem(ZW_HISTORY_KEY)
  } catch (e) {
    console.error('[ziwei:history-sync] migrateHistoryToServer failed:', e)
  }
}
