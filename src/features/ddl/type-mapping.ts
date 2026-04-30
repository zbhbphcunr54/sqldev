import { normalizeSupportedDatabase, type SupportedDatabase } from '../shared/database'

export interface DdlRuleCondition {
  op: '<' | '>' | '<=' | '>='
  val: number
}

export interface DdlParsedSourceRule {
  types: string[]
  hasN: boolean
  hasP: boolean
  hasPS: boolean
  specificVal: number | null
  cond: DdlRuleCondition | null
}

export interface DdlColumnMappingInput {
  type: string
  rawType?: string
  precision?: number | null
  scale?: number | null
  length?: number | null
}

export interface DdlTypeRule {
  source?: string
  target?: string
}

export function parseDdlRuleSource(sourceValue: unknown): DdlParsedSourceRule {
  let source = String(sourceValue || '').trim()
  let cond: DdlRuleCondition | null = null
  const conditionMatch = source.match(/\s*\[p([<>]=?)(\d+)\]\s*$/)

  if (conditionMatch) {
    cond = {
      op: conditionMatch[1] as DdlRuleCondition['op'],
      val: parseInt(conditionMatch[2], 10)
    }
    source = source.replace(/\s*\[.*\]$/, '').trim()
  }

  let hasN = false
  let hasP = false
  let hasPS = false
  let specificVal: number | null = null
  const paramsMatch = source.match(/^(.+?)\(([^)]*)\)$/)

  if (paramsMatch) {
    const params = paramsMatch[2].trim()
    source = paramsMatch[1].trim()
    if (params === 'n') hasN = true
    else if (params === 'p,s') hasPS = true
    else if (params === 'p') hasP = true
    else if (params === 'p,0') hasP = true
    else if (/^\d+$/.test(params)) specificVal = parseInt(params, 10)
  }

  return {
    types: source.split(/\s*\/\s*/).map((item) => item.trim().toUpperCase()),
    hasN,
    hasP,
    hasPS,
    specificVal,
    cond
  }
}

export function matchesDdlRuleSource(
  columnValue: DdlColumnMappingInput,
  parsedValue: DdlParsedSourceRule
): boolean {
  const column = columnValue
  const parsed = parsedValue
  const type = String(column.type || '').toUpperCase()

  let matched = false
  for (const parsedType of parsed.types) {
    if (type === parsedType) {
      matched = true
      break
    }
    if (parsedType === 'TIMESTAMP' && type.startsWith('TIMESTAMP')) {
      matched = true
      break
    }
  }
  if (!matched) return false

  if (parsed.specificVal !== null) {
    const currentValue = column.precision != null ? column.precision : column.length
    if (currentValue !== parsed.specificVal) return false
  }

  if (parsed.hasPS && (!column.precision || column.scale == null)) return false
  if (parsed.hasP) {
    if (!column.precision) return false
    if (column.scale != null && column.scale !== 0) return false
  }
  if (parsed.hasN && !column.length) return false

  if (parsed.cond) {
    const precision = column.precision
    if (!precision) return false
    if (parsed.cond.op === '<=' && !(precision <= parsed.cond.val)) return false
    if (parsed.cond.op === '>=' && !(precision >= parsed.cond.val)) return false
    if (parsed.cond.op === '<' && !(precision < parsed.cond.val)) return false
    if (parsed.cond.op === '>' && !(precision > parsed.cond.val)) return false
  }

  return true
}

export function applyDdlRuleTarget(
  columnValue: DdlColumnMappingInput,
  targetValue: unknown
): string {
  const column = columnValue
  const target = String(targetValue || '').trim()
  const paramsMatch = target.match(/^(.+?)\(([^)]*)\)$/)
  if (!paramsMatch) return target

  const base = paramsMatch[1].trim()
  const inner = paramsMatch[2].trim()
  if (inner === 'n') return `${base}(${column.length || 255})`
  if (inner === 'p,s')
    return `${base}(${column.precision || 38},${column.scale != null ? column.scale : 0})`
  if (inner === 'p,0') return `${base}(${column.precision || 38},0)`
  if (inner === 'p') return `${base}(${column.precision || 38})`
  return target
}

export function mapDdlTypeByRules(
  columnValue: DdlColumnMappingInput,
  rulesValue: DdlTypeRule[]
): string {
  const column = columnValue
  const rules = Array.isArray(rulesValue) ? rulesValue : []

  if (!rules.length) {
    return `${column.rawType || column.type} /* [注意: 无可用映射规则, 请人工确认] */`
  }

  for (const rule of rules) {
    if (!rule?.source || !rule?.target) continue
    const parsed = parseDdlRuleSource(rule.source)
    if (matchesDdlRuleSource(column, parsed)) {
      return applyDdlRuleTarget(column, rule.target)
    }
  }

  return `${column.rawType || column.type} /* [注意: 未匹配到映射规则, 类型原样保留] */`
}

export function convertDdlDefaultValue(
  value: unknown,
  fromValue: SupportedDatabase,
  toValue: SupportedDatabase
): string | null {
  if (!value) return null

  const original = String(value)
  const from = normalizeSupportedDatabase(fromValue)
  const to = normalizeSupportedDatabase(toValue)
  if (!from || !to) return original
  const normalized = original.toUpperCase().trim()

  if (from === 'oracle') {
    if (normalized === 'SYSDATE' || normalized === 'SYSTIMESTAMP') {
      return to === 'mysql' ? 'CURRENT_TIMESTAMP(6)' : 'CLOCK_TIMESTAMP()'
    }
    if (normalized === 'SYS_GUID()') {
      return to === 'mysql' ? 'UUID()' : 'gen_random_uuid()'
    }
  }

  if (from === 'mysql') {
    if (
      normalized === 'CURRENT_TIMESTAMP' ||
      normalized.startsWith('CURRENT_TIMESTAMP(') ||
      normalized === 'NOW()' ||
      normalized.startsWith('NOW(')
    ) {
      return to === 'oracle' ? 'SYSTIMESTAMP' : 'CLOCK_TIMESTAMP()'
    }
    if (normalized === 'UUID()') {
      return to === 'oracle' ? 'SYS_GUID()' : 'gen_random_uuid()'
    }
    if (normalized === 'TRUE') return to === 'oracle' ? '1' : 'TRUE'
    if (normalized === 'FALSE') return to === 'oracle' ? '0' : 'FALSE'
  }

  if (from === 'postgresql') {
    if (
      normalized === 'CLOCK_TIMESTAMP()' ||
      normalized === 'NOW()' ||
      normalized === 'CURRENT_TIMESTAMP'
    ) {
      return to === 'oracle' ? 'SYSTIMESTAMP' : 'CURRENT_TIMESTAMP(6)'
    }
    if (normalized === 'GEN_RANDOM_UUID()') {
      return to === 'oracle' ? 'SYS_GUID()' : 'UUID()'
    }
    if (normalized === 'TRUE') return to === 'oracle' ? '1' : to === 'mysql' ? '1' : 'TRUE'
    if (normalized === 'FALSE') return to === 'oracle' ? '0' : to === 'mysql' ? '0' : 'FALSE'
  }

  return original
}
