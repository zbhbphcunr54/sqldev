// src/stores/rules.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchUserRules, saveUserRules, resetUserRules } from '@/api/rules'

export const useRulesStore = defineStore('rules', () => {
  const ddlRules = ref<Record<string, unknown>>({})
  const bodyRules = ref<Record<string, unknown>>({})
  const loading = ref(false)
  const error = ref('')

  async function loadRules(kind: 'ddl' | 'body'): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const result = await fetchUserRules(kind)
      if (kind === 'ddl') ddlRules.value = result.rules_json
      else bodyRules.value = result.rules_json
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '加载规则失败'
    } finally {
      loading.value = false
    }
  }

  async function saveRules(kind: 'ddl' | 'body', rulesJson: Record<string, unknown>): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await saveUserRules(kind, rulesJson)
      if (kind === 'ddl') ddlRules.value = rulesJson
      else bodyRules.value = rulesJson
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '保存规则失败'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resetRules(kind: 'ddl' | 'body'): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      await resetUserRules(kind)
      if (kind === 'ddl') ddlRules.value = {}
      else bodyRules.value = {}
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '重置规则失败'
    } finally {
      loading.value = false
    }
  }

  function $reset(): void {
    ddlRules.value = {}
    bodyRules.value = {}
    loading.value = false
    error.value = ''
  }

  return { ddlRules, bodyRules, loading, error, loadRules, saveRules, resetRules, $reset }
})