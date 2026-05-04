type RecordLike = Record<string, unknown>

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function asRecord(value: unknown): RecordLike {
  return value && typeof value === 'object' ? (value as RecordLike) : {}
}

function cloneBodyRuleForStorage(ruleValue: unknown): { s: unknown; t: unknown } {
  const rule = asRecord(ruleValue)
  return { s: rule.s, t: rule.t }
}

export function saveDdlRulesToStorage(
  storage: StorageLike,
  storageKey: string,
  ddlRulesData: unknown
): { ok: boolean; error: string } {
  try {
    storage.setItem(storageKey, JSON.stringify(ddlRulesData))
    // Async sync to Supabase (fire-and-forget)
    if (ddlRulesData && typeof ddlRulesData === 'object') {
      import('./sync').then(({ syncRulesToServer }) =>
        syncRulesToServer('ddl', ddlRulesData as RecordLike)
      ).catch((err) => console.error('[rules:persistence] ddl sync failed:', err))
    }
    return { ok: true, error: '' }
  } catch (error) {
    console.error('[rules:persistence] saveDdlRules failed:', error)
    return { ok: false, error: String((error as Error)?.message || error || '未知错误') }
  }
}

export function saveBodyRulesToStorage(
  storage: StorageLike,
  storageKey: string,
  bodyRulesData: unknown
): { ok: boolean; error: string } {
  const source = asRecord(bodyRulesData)
  const output: RecordLike = {}

  for (const key of Object.keys(source)) {
    const list = Array.isArray(source[key]) ? source[key] : []
    output[key] = list.map(cloneBodyRuleForStorage)
  }

  try {
    storage.setItem(storageKey, JSON.stringify(output))
    // Async sync to Supabase (fire-and-forget)
    import('./sync').then(({ syncRulesToServer }) =>
      syncRulesToServer('body', output)
    ).catch((err) => console.error('[rules:persistence] body sync failed:', err))
    return { ok: true, error: '' }
  } catch (error) {
    console.error('[rules:persistence] saveBodyRules failed:', error)
    return { ok: false, error: String((error as Error)?.message || error || '未知错误') }
  }
}

export function persistRulesToStorage(
  storage: StorageLike,
  ddlStorageKey: string,
  bodyStorageKey: string,
  ddlRulesData: unknown,
  bodyRulesData: unknown
): { ok: boolean; error: string } {
  const ddlResult = saveDdlRulesToStorage(storage, ddlStorageKey, ddlRulesData)
  const bodyResult = saveBodyRulesToStorage(storage, bodyStorageKey, bodyRulesData)
  return {
    ok: ddlResult.ok && bodyResult.ok,
    error: ddlResult.error || bodyResult.error || ''
  }
}

export function loadDdlRulesFromStorage(
  storage: StorageLike,
  storageKey: string
): RecordLike | null {
  try {
    const text = storage.getItem(storageKey)
    if (!text) return null
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? (parsed as RecordLike) : null
  } catch (error) {
    console.error('[rules:persistence] loadDdlRules failed:', error)
    return null
  }
}

export function loadBodyRulesFromStorage(
  storage: StorageLike,
  storageKey: string,
  bodyRulesDefault: unknown
): RecordLike | null {
  try {
    const text = storage.getItem(storageKey)
    if (!text) return null

    const saved = JSON.parse(text)
    if (!saved || typeof saved !== 'object') return null

    const defaults = asRecord(bodyRulesDefault)
    const result: RecordLike = {}

    for (const pair of Object.keys(saved)) {
      if (!defaults[pair]) continue

      const defLookup: Record<string, RecordLike> = {}
      const defaultRules = Array.isArray(defaults[pair]) ? defaults[pair] : []
      for (const defaultRuleValue of defaultRules) {
        const defaultRule = asRecord(defaultRuleValue)
        defLookup[`${String(defaultRule.s)}\x00${String(defaultRule.t)}`] = defaultRule
      }

      const savedRules = Array.isArray(saved[pair]) ? saved[pair] : []
      result[pair] = savedRules.map((savedRuleValue) => {
        const savedRule = asRecord(savedRuleValue)
        const defaultRule = defLookup[`${String(savedRule.s)}\x00${String(savedRule.t)}`]
        if (defaultRule) {
          return {
            s: savedRule.s,
            t: savedRule.t,
            fwd: defaultRule.fwd ?? null,
            rev: defaultRule.rev ?? null,
            typeFwd: defaultRule.typeFwd ?? null,
            typeRev: defaultRule.typeRev ?? null
          }
        }
        return {
          s: savedRule.s,
          t: savedRule.t,
          fwd: null,
          rev: null
        }
      })
    }

    return result
  } catch (error) {
    console.error('[rules:persistence] loadBodyRules failed:', error)
    return null
  }
}

export function hydrateRulesData(target: unknown, source: unknown): void {
  const targetRecord = asRecord(target)
  const sourceRecord = asRecord(source)
  for (const key of Object.keys(sourceRecord)) {
    if (Object.prototype.hasOwnProperty.call(targetRecord, key)) {
      targetRecord[key] = sourceRecord[key]
    }
  }
}
