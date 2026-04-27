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

export interface LegacyMenuKeyDecisionConfig {
  key: unknown
  activeIndex: unknown
  itemCount: unknown
}

export interface LegacyMenuKeyDecisionResult {
  action: 'none' | 'focus' | 'closeMenu'
  nextIndex: number
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

export function resolveLegacyMenuKeyDecision(
  config: LegacyMenuKeyDecisionConfig
): LegacyMenuKeyDecisionResult {
  const key = String(config.key || '')
  const itemCount = Number.isFinite(config.itemCount) ? Number(config.itemCount) : 0
  if (itemCount <= 0) return { action: 'none', nextIndex: -1 }
  const activeIndex = Number.isFinite(config.activeIndex) ? Number(config.activeIndex) : -1

  if (key === 'ArrowDown') {
    return {
      action: 'focus',
      nextIndex: (activeIndex + 1) % itemCount
    }
  }
  if (key === 'ArrowUp') {
    return {
      action: 'focus',
      nextIndex: (activeIndex - 1 + itemCount) % itemCount
    }
  }
  if (key === 'Home') {
    return {
      action: 'focus',
      nextIndex: 0
    }
  }
  if (key === 'End') {
    return {
      action: 'focus',
      nextIndex: itemCount - 1
    }
  }
  if (key === 'Escape') {
    return {
      action: 'closeMenu',
      nextIndex: -1
    }
  }
  return { action: 'none', nextIndex: -1 }
}
