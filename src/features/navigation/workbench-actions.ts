export type LegacyPrimaryWorkbenchPage = 'ddl' | 'func' | 'proc'
export type LegacyPrimaryActionHandlerName = 'convert' | 'convertFunc' | 'convertProc'

export interface LegacyWorkbenchActionDecision {
  type: 'theme' | 'feedback' | 'unsupported' | 'invoke'
  handlerName?: string
}

export function resolveLegacyPrimaryWorkbenchPage(
  pageValue: unknown
): LegacyPrimaryWorkbenchPage | null {
  const page = String(pageValue || '').trim()
  if (page === 'ddl' || page === 'func' || page === 'proc') return page
  return null
}

export function resolveLegacyPrimaryActionHandlerName(
  pageValue: unknown
): LegacyPrimaryActionHandlerName | null {
  const page = resolveLegacyPrimaryWorkbenchPage(pageValue)
  if (page === 'ddl') return 'convert'
  if (page === 'func') return 'convertFunc'
  if (page === 'proc') return 'convertProc'
  return null
}

export function resolveLegacyWorkbenchActionDecision(
  pageValue: unknown,
  actionValue: unknown
): LegacyWorkbenchActionDecision {
  const action = String(actionValue || '').trim()
  if (action === 'theme') return { type: 'theme' }
  if (action === 'feedback') return { type: 'feedback' }
  if (action === 'upload') return { type: 'invoke', handlerName: 'uploadFile' }
  if (action === 'format') return { type: 'invoke', handlerName: 'formatActiveWorkbench' }

  const page = resolveLegacyPrimaryWorkbenchPage(pageValue)
  if (!page) return { type: 'unsupported' }

  const pageActionMap: Record<LegacyPrimaryWorkbenchPage, Record<string, string>> = {
    ddl: {
      sample: 'loadSample',
      clear: 'clearAll',
      copy: 'copyOutput',
      save: 'saveOutput'
    },
    func: {
      sample: 'loadFuncSample',
      clear: 'clearFunc',
      copy: 'copyFuncOutput',
      save: 'saveFuncOutput'
    },
    proc: {
      sample: 'loadProcSample',
      clear: 'clearProc',
      copy: 'copyProcOutput',
      save: 'saveProcOutput'
    }
  }
  const pageActionHandlers = pageActionMap[page]
  const handlerName = pageActionHandlers?.[action]
  return handlerName ? { type: 'invoke', handlerName } : { type: 'unsupported' }
}
