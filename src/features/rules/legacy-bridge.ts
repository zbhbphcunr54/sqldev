import { getBodyRuleCategories, mapParamTypeByRules, transformBodyByRules } from './index'
import {
  hydrateRulesData,
  loadBodyRulesFromStorage,
  loadDdlRulesFromStorage,
  persistRulesToStorage,
  saveBodyRulesToStorage,
  saveDdlRulesToStorage
} from './persistence'

declare global {
  interface Window {
    SQLDEV_RULE_STORAGE_UTILS?: {
      getBodyRuleCategories: typeof getBodyRuleCategories
      mapParamTypeByRules: typeof mapParamTypeByRules
      transformBodyByRules: typeof transformBodyByRules
      hydrateRulesData: typeof hydrateRulesData
      loadBodyRulesFromStorage: typeof loadBodyRulesFromStorage
      loadDdlRulesFromStorage: typeof loadDdlRulesFromStorage
      persistRulesToStorage: typeof persistRulesToStorage
      saveBodyRulesToStorage: typeof saveBodyRulesToStorage
      saveDdlRulesToStorage: typeof saveDdlRulesToStorage
    }
  }
}

window.SQLDEV_RULE_STORAGE_UTILS = Object.freeze({
  getBodyRuleCategories,
  mapParamTypeByRules,
  transformBodyByRules,
  hydrateRulesData,
  loadBodyRulesFromStorage,
  loadDdlRulesFromStorage,
  persistRulesToStorage,
  saveBodyRulesToStorage,
  saveDdlRulesToStorage
})
