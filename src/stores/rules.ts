// src/stores/rules.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchUserRules,
  saveUserRules,
  resetUserRules,
  type DbType,
  type RuleKind
} from '@/api/rules'

export const useRulesStore = defineStore('rules', () => {
  const currentRules = ref<unknown[]>([])
  const sourceDb = ref<DbType>('oracle')
  const targetDb = ref<DbType>('pg')
  const kind = ref<RuleKind>('ddl')
  const loading = ref(false)
  const error = ref('')
  const updatedAt = ref<string | null>(null)

  async function loadRules(sDb: DbType, tDb: DbType, k: RuleKind): Promise<void> {
    loading.value = true
    error.value = ''
    sourceDb.value = sDb
    targetDb.value = tDb
    kind.value = k
    try {
      const result = await fetchUserRules(sDb, tDb, k)
      if (result.ok) {
        currentRules.value = result.rules_json
        updatedAt.value = result.updated_at
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '加载规则失败'
    } finally {
      loading.value = false
    }
  }

  async function saveRules(rules: unknown[]): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const result = await saveUserRules(sourceDb.value, targetDb.value, kind.value, rules as never)
      if (result.ok) {
        currentRules.value = rules
        updatedAt.value = result.updated_at
      }
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '保存规则失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resetRules(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await resetUserRules(sourceDb.value, targetDb.value, kind.value)
      await loadRules(sourceDb.value, targetDb.value, kind.value)
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '重置规则失败'
    } finally {
      loading.value = false
    }
  }

  function $reset(): void {
    currentRules.value = []
    loading.value = false
    error.value = ''
    updatedAt.value = null
  }

  return {
    currentRules,
    sourceDb,
    targetDb,
    kind,
    loading,
    error,
    updatedAt,
    loadRules,
    saveRules,
    resetRules,
    $reset
  }
})
