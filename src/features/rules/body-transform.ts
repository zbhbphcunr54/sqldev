import { normalizeSupportedDatabase } from '../shared/database'

export interface BodyRuleCategory {
  name: string
  forward: boolean
}

export interface BodyTransformRule {
  s?: string
  t?: string
  fwd?: ((body: string) => string) | null
  rev?: ((body: string) => string) | null
  typeFwd?: ((type: string) => string) | null
  typeRev?: ((type: string) => string) | null
}

export type BodyRuleMap = Record<string, BodyTransformRule[]>

export function getBodyRuleCategories(
  fromDbValue: unknown,
  toDbValue: unknown
): BodyRuleCategory[] {
  const fromDb = normalizeSupportedDatabase(fromDbValue)
  const toDb = normalizeSupportedDatabase(toDbValue)
  if (!fromDb || !toDb) return []

  if (fromDb === 'oracle' && toDb === 'postgresql') return [{ name: 'oraclePg', forward: true }]
  if (fromDb === 'postgresql' && toDb === 'oracle') return [{ name: 'oraclePg', forward: false }]
  if (fromDb === 'oracle' && toDb === 'mysql') return [{ name: 'oracleMysql', forward: true }]
  if (fromDb === 'mysql' && toDb === 'oracle') return [{ name: 'oracleMysql', forward: false }]
  if (fromDb === 'mysql' && toDb === 'postgresql') return [{ name: 'mysqlPg', forward: true }]
  if (fromDb === 'postgresql' && toDb === 'mysql') return [{ name: 'mysqlPg', forward: false }]
  return []
}

export function mapParamTypeByRules(
  typeValue: unknown,
  fromDbValue: unknown,
  toDbValue: unknown,
  bodyRulesValue: BodyRuleMap
): string {
  const originalType = String(typeValue || '')
  if (!originalType) return originalType

  let mapped = originalType.trim()
  const fromDb = normalizeSupportedDatabase(fromDbValue)
  const toDb = normalizeSupportedDatabase(toDbValue)
  if (!fromDb || !toDb) return mapped
  if (/%ROWTYPE\b/i.test(mapped)) {
    if (toDb === 'postgresql') return 'RECORD'
    if (toDb === 'mysql') {
      return `VARCHAR(4000) /* [注意: 原为 ${mapped}, MySQL 无 %ROWTYPE] */`
    }
    return mapped
  }
  if (fromDb === toDb) return mapped

  const categories = getBodyRuleCategories(fromDb, toDb)
  const bodyRules = bodyRulesValue || {}
  for (const category of categories) {
    const rules = Array.isArray(bodyRules[category.name]) ? bodyRules[category.name] : []
    for (const rule of rules) {
      const transformer = category.forward ? rule.typeFwd : rule.typeRev
      if (typeof transformer === 'function') {
        mapped = transformer(mapped)
      }
    }
  }

  return mapped
}

export function transformBodyByRules(
  bodyValue: unknown,
  fromDbValue: unknown,
  toDbValue: unknown,
  bodyRulesValue: BodyRuleMap
): string {
  const originalBody = String(bodyValue || '')
  const fromDb = normalizeSupportedDatabase(fromDbValue)
  const toDb = normalizeSupportedDatabase(toDbValue)
  if (!originalBody || !fromDb || !toDb || fromDb === toDb) return originalBody

  let transformed = originalBody
  const categories = getBodyRuleCategories(fromDb, toDb)
  const bodyRules = bodyRulesValue || {}
  for (const category of categories) {
    const rules = Array.isArray(bodyRules[category.name]) ? bodyRules[category.name] : []
    for (const rule of rules) {
      const transformer = category.forward ? rule.fwd : rule.rev
      if (typeof transformer === 'function') {
        transformed = transformer(transformed)
      }
    }
  }

  return transformed
}
