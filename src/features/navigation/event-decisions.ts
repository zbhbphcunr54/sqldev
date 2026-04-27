import { resolveLegacyPrimaryWorkbenchPage } from './workbench-actions'

export interface LegacyPrimaryHotkeyConfig {
  key: unknown
  ctrlKey?: boolean
  metaKey?: boolean
  hasBlockingModal?: boolean
  activePage: unknown
}

export interface LegacyOutsideClickDecisionConfig {
  showRulesMenu?: boolean
  ziweiAiSuggestionOpen?: boolean
  clickedInSettingsDropdown?: boolean
  clickedInZiweiInputWrap?: boolean
}

export interface LegacyOutsideClickDecisionResult {
  shouldCloseRulesMenu: boolean
  shouldCloseZiweiAiSuggestion: boolean
}

export function shouldLegacyCloseRulesMenuOnEscape(
  keyValue: unknown,
  showRulesMenuValue: unknown
): boolean {
  return String(keyValue || '') === 'Escape' && Boolean(showRulesMenuValue)
}

export function resolveLegacyPrimaryHotkeyTarget(
  config: LegacyPrimaryHotkeyConfig
): 'ddl' | 'func' | 'proc' | null {
  if (String(config.key || '') !== 'Enter') return null
  if (!config.ctrlKey && !config.metaKey) return null
  if (config.hasBlockingModal) return null
  return resolveLegacyPrimaryWorkbenchPage(config.activePage)
}

export function resolveLegacyOutsideClickDecision(
  config: LegacyOutsideClickDecisionConfig
): LegacyOutsideClickDecisionResult {
  return {
    shouldCloseRulesMenu: Boolean(config.showRulesMenu) && !config.clickedInSettingsDropdown,
    shouldCloseZiweiAiSuggestion:
      Boolean(config.ziweiAiSuggestionOpen) && !config.clickedInZiweiInputWrap
  }
}
