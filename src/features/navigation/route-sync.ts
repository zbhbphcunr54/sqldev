export interface LegacyRouteSyncConfig {
  currentHash: unknown
  targetHash: unknown
  replaceUrl?: boolean
  hasHistoryApi?: boolean
  hasReplaceStateApi?: boolean
  hasPushStateApi?: boolean
}

export interface LegacyRouteSyncDecision {
  shouldSync: boolean
  strategy: 'none' | 'replaceState' | 'pushState' | 'hashOnly'
}

export function resolveLegacyRouteSyncDecision(
  config: LegacyRouteSyncConfig
): LegacyRouteSyncDecision {
  const currentHash = String(config.currentHash || '')
  const targetHash = String(config.targetHash || '')
  if (currentHash === targetHash) {
    return {
      shouldSync: false,
      strategy: 'none'
    }
  }

  if (config.hasHistoryApi && config.replaceUrl && config.hasReplaceStateApi) {
    return {
      shouldSync: true,
      strategy: 'replaceState'
    }
  }

  if (config.hasHistoryApi && !config.replaceUrl && config.hasPushStateApi) {
    return {
      shouldSync: true,
      strategy: 'pushState'
    }
  }

  return {
    shouldSync: true,
    strategy: 'hashOnly'
  }
}
