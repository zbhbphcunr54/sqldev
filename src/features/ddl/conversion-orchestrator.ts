import type { Result } from '@/types'
import { normalizeSupportedDatabase, type SupportedDatabase } from '../shared/database'

interface ExtraDdlLike {
  sequences: unknown[]
  alterSequences: unknown[]
  alterColumns: unknown[]
  addColumns: unknown[]
}

interface DdlConversionDeps {
  labels: Record<string, string>
  nowIsoString?: () => string
  parseOracleDDL: (input: string) => unknown[]
  parseMySqlDDL: (input: string) => unknown[]
  parsePostgresDDL: (input: string) => unknown[]
  parseViews: (input: string, sourceDb: SupportedDatabase) => unknown[]
  parseExtraDDL: (input: string, sourceDb: SupportedDatabase) => ExtraDdlLike
  generateOracleDDL: (tables: unknown[], sourceDb: SupportedDatabase) => string
  generateMySqlDDL: (tables: unknown[], sourceDb: SupportedDatabase) => string
  generatePostgresDDL: (tables: unknown[], sourceDb: SupportedDatabase) => string
  generateOracleViews: (views: unknown[], sourceDb: SupportedDatabase) => string
  generateMySqlViews: (views: unknown[], sourceDb: SupportedDatabase) => string
  generatePostgresViews: (views: unknown[], sourceDb: SupportedDatabase) => string
  generateExtraDDL: (
    parsed: ExtraDdlLike,
    sourceDb: SupportedDatabase,
    targetDb: SupportedDatabase
  ) => string
}

function createEmptyExtraDdl(): ExtraDdlLike {
  return {
    sequences: [],
    alterSequences: [],
    alterColumns: [],
    addColumns: []
  }
}

function formatNow(nowIsoString?: () => string): string {
  const value = typeof nowIsoString === 'function' ? nowIsoString() : new Date().toISOString()
  return String(value).slice(0, 19).replace('T', ' ')
}

export function convertDdlOrchestratedResult(
  inputValue: unknown,
  sourceDbValue: unknown,
  targetDbValue: unknown,
  deps: DdlConversionDeps
): Result<string> {
  const input = String(inputValue || '')
  const sourceDb = normalizeSupportedDatabase(sourceDbValue)
  const targetDb = normalizeSupportedDatabase(targetDbValue)

  if (!input.trim()) return { ok: false, error: '-- 请输入 DDL 语句', code: 'input_empty' }
  if (input.length > 5 * 1024 * 1024) {
    return {
      ok: false,
      error: '-- 输入内容过大（超过 5MB），请分批处理',
      code: 'input_too_large'
    }
  }
  if (!sourceDb) {
    return { ok: false, error: `-- 不支持的源数据库: ${sourceDbValue}`, code: 'invalid_source_db' }
  }
  if (!targetDb) {
    return {
      ok: false,
      error: `-- 不支持的目标数据库: ${targetDbValue}`,
      code: 'invalid_target_db'
    }
  }
  if (sourceDb === targetDb) {
    return { ok: false, error: '-- 源数据库与目标数据库相同，无需转换', code: 'same_database' }
  }

  let tables: unknown[] = []
  try {
    if (sourceDb === 'oracle') tables = deps.parseOracleDDL(input)
    else if (sourceDb === 'mysql') tables = deps.parseMySqlDDL(input)
    else tables = deps.parsePostgresDDL(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '未知错误')
    return {
      ok: false,
      error: `-- 解析失败: ${message}\n-- 请检查输入的 DDL 语法是否正确`,
      code: 'parse_failed'
    }
  }

  let views: unknown[] = []
  try {
    views = deps.parseViews(input, sourceDb)
  } catch {
    views = []
  }

  let extraParsed = createEmptyExtraDdl()
  try {
    extraParsed = deps.parseExtraDDL(input, sourceDb)
  } catch {
    extraParsed = createEmptyExtraDdl()
  }

  const hasExtra =
    extraParsed.sequences.length ||
    extraParsed.alterSequences.length ||
    extraParsed.alterColumns.length ||
    extraParsed.addColumns.length
  const hasViews = views.length > 0

  if ((!tables || !tables.length) && !hasExtra && !hasViews) {
    return {
      ok: false,
      error: '-- 未识别到 CREATE TABLE / CREATE VIEW 语句，请检查输入格式',
      code: 'no_supported_ddl'
    }
  }

  let tableOutput = ''
  if (tables?.length) {
    try {
      if (targetDb === 'oracle') tableOutput = deps.generateOracleDDL(tables, sourceDb)
      else if (targetDb === 'mysql') tableOutput = deps.generateMySqlDDL(tables, sourceDb)
      else tableOutput = deps.generatePostgresDDL(tables, sourceDb)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误')
      return { ok: false, error: `-- 生成失败: ${message}`, code: 'generate_failed' }
    }
  }

  let viewOutput = ''
  if (hasViews) {
    try {
      if (targetDb === 'oracle') viewOutput = deps.generateOracleViews(views, sourceDb)
      else if (targetDb === 'mysql') viewOutput = deps.generateMySqlViews(views, sourceDb)
      else viewOutput = deps.generatePostgresViews(views, sourceDb)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误')
      viewOutput = `-- 视图生成失败: ${message}`
    }
  }

  let extraOutput = ''
  if (hasExtra) {
    try {
      extraOutput = deps.generateExtraDDL(extraParsed, sourceDb, targetDb)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || '未知错误')
      extraOutput = `-- 额外 DDL 生成失败: ${message}`
    }
  }

  const tableCount = tables?.length || 0
  const viewCount = views.length
  let countDescription = `表数量: ${tableCount}`
  if (viewCount > 0) countDescription += `, 视图: ${viewCount}`
  if (hasExtra) countDescription += '（含序列/ALTER 语句）'

  const sourceLabel = deps.labels[sourceDb] || sourceDb
  const targetLabel = deps.labels[targetDb] || targetDb
  const header =
    '-- ============================================================\n' +
    `-- 自动生成: ${sourceLabel} -> ${targetLabel}\n` +
    `-- ${countDescription}\n` +
    `-- 生成时间: ${formatNow(deps.nowIsoString)}\n` +
    '-- 请检查类型映射和分区语法是否符合目标库版本要求\n' +
    '-- ============================================================\n\n'

  let result = header
  if (tableOutput) result += tableOutput
  if (viewOutput) {
    if (tableOutput) result += '\n\n'
    result += viewOutput
  }
  if (extraOutput) {
    if (tableOutput || viewOutput) result += '\n\n'
    result += extraOutput
  }

  return { ok: true, data: result }
}

export function convertDdlOrchestrated(
  inputValue: unknown,
  sourceDbValue: unknown,
  targetDbValue: unknown,
  deps: DdlConversionDeps
): string {
  const result = convertDdlOrchestratedResult(inputValue, sourceDbValue, targetDbValue, deps)
  return result.ok ? result.data : result.error
}
