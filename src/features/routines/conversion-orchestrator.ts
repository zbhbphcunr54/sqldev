type SupportedDatabase = 'oracle' | 'mysql' | 'postgresql'

interface RoutineOrchestrationDeps {
  labels: Record<string, string>
  nowIsoString?: () => string
}

interface FunctionOrchestrationDeps extends RoutineOrchestrationDeps {
  convertSingleFunction: (
    input: string,
    sourceDb: SupportedDatabase,
    targetDb: SupportedDatabase
  ) => string
}

interface ProcedureOrchestrationDeps extends RoutineOrchestrationDeps {
  convertSingleProcedure: (
    input: string,
    sourceDb: SupportedDatabase,
    targetDb: SupportedDatabase
  ) => string
}

function formatNow(nowIsoString?: () => string): string {
  const value = typeof nowIsoString === 'function' ? nowIsoString() : new Date().toISOString()
  return String(value).slice(0, 19).replace('T', ' ')
}

function splitCreateBlocks(input: string): string[] {
  return input.split(/\n(?=\s*CREATE\b)/i).filter((block) => /\bCREATE\b/i.test(block))
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error ?? '未知错误')
}

export function convertFunctionOrchestrated(
  inputValue: unknown,
  sourceDbValue: unknown,
  targetDbValue: unknown,
  deps: FunctionOrchestrationDeps
): string {
  const input = String(inputValue || '')
  const sourceDb = String(sourceDbValue || '').toLowerCase() as SupportedDatabase
  const targetDb = String(targetDbValue || '').toLowerCase() as SupportedDatabase

  if (!input.trim()) return '-- 请在左侧输入区粘贴源函数定义'
  if (input.length > 5 * 1024 * 1024) return '-- 错误：输入超过5MB限制\n'
  if (sourceDb === targetDb) {
    return `-- 源库与目标库相同 (${deps.labels[sourceDb]})，无需翻译\n\n${input.trim()}`
  }

  const blocks = splitCreateBlocks(input)
  const results: string[] = []
  let errorCount = 0

  for (const block of blocks) {
    try {
      results.push(deps.convertSingleFunction(block.trim(), sourceDb, targetDb))
    } catch (error) {
      errorCount += 1
      const message = getErrorMessage(error)
      results.push(`-- 翻译失败: ${message}\n-- 原始代码:\n${block.trim()}`)
    }
  }

  const header =
    `-- 函数翻译: ${deps.labels[sourceDb]} \u2192 ${deps.labels[targetDb]}` +
    ` | 共 ${results.length} 个函数` +
    (errorCount > 0 ? ` (${errorCount} 个失败)` : '') +
    ` | ${formatNow(deps.nowIsoString)}\n`

  return `${header}\n${results.join('\n\n')}`
}

export function convertProcedureOrchestrated(
  inputValue: unknown,
  sourceDbValue: unknown,
  targetDbValue: unknown,
  deps: ProcedureOrchestrationDeps
): string {
  const input = String(inputValue || '')
  const sourceDb = String(sourceDbValue || '').toLowerCase() as SupportedDatabase
  const targetDb = String(targetDbValue || '').toLowerCase() as SupportedDatabase

  if (!input.trim()) return '-- 请在左侧输入区粘贴源存储过程定义'
  if (input.length > 5 * 1024 * 1024) return '-- 错误：输入超过5MB限制\n'
  if (sourceDb === targetDb) {
    return `-- 源库与目标库相同 (${deps.labels[sourceDb]})，无需翻译\n\n${input.trim()}`
  }

  const blocks = splitCreateBlocks(input)
  const results: string[] = []
  let errorCount = 0

  for (const block of blocks) {
    try {
      results.push(deps.convertSingleProcedure(block.trim(), sourceDb, targetDb))
    } catch (error) {
      errorCount += 1
      const message = getErrorMessage(error)
      results.push(`-- 翻译失败: ${message}\n-- 原始代码:\n${block.trim()}`)
    }
  }

  const header =
    `-- 存储过程翻译: ${deps.labels[sourceDb]} \u2192 ${deps.labels[targetDb]}` +
    ` | 共 ${results.length} 个存储过程` +
    (errorCount > 0 ? ` (${errorCount} 个失败)` : '') +
    ` | ${formatNow(deps.nowIsoString)}\n`

  return `${header}\n${results.join('\n\n')}`
}
