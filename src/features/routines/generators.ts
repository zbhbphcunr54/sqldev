export interface RoutineParam {
  name: string
  direction?: string
  type: string
  defaultVal?: string | null
}

export interface RoutineVar {
  name?: string
  type?: string
  defaultVal?: string | null
  cursor?: boolean
  query?: string
  raw?: string
}

export function generateOracleFunctionStatement(
  name: string,
  params: RoutineParam[],
  returnType: string,
  vars: RoutineVar[],
  body: string
): string {
  let out = 'CREATE OR REPLACE FUNCTION ' + name + '(\n'
  const pLines = params.map((p) => {
    let line = '  ' + p.name
    line += ' ' + (p.direction || 'IN')
    let ptype = p.type
    ptype = ptype.replace(
      /\b(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|RAW)\s*\(\s*\d+\s*(?:\s+(?:BYTE|CHAR))?\s*\)/gi,
      '$1'
    )
    line += ' ' + ptype
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal
    return line
  })
  out += pLines.join(',\n') + ')\nRETURN ' + returnType + '\nIS\n'
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i]
    if (v.raw) { out += '  ' + v.raw + '\n'; continue }
    if (v.cursor) { out += '  CURSOR ' + v.name + ' IS ' + v.query + ';\n'; continue }
    out += '  ' + v.name + ' ' + v.type
    if (v.defaultVal) out += ' := ' + v.defaultVal
    out += ';\n'
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '')
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '')
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/, '') + '\n'
  const afterBeginF = out.split('BEGIN').pop() ?? ''
  if (!/^\s*END\s*;\s*$/im.test(afterBeginF)) out += 'END;\n'
  else out = out.replace(/\bEND\b\s*;?\s*$/i, 'END;\n')
  out += '/'
  return out
}

export function generateMySqlFunctionStatement(
  name: string,
  params: RoutineParam[],
  returnType: string,
  vars: RoutineVar[],
  body: string
): string {
  let out = 'DELIMITER $$\nCREATE FUNCTION ' + name + '(\n'
  const filteredParams: RoutineParam[] = []
  let hasOutNote = false
  for (let i = 0; i < params.length; i++) {
    if (params[i].direction === 'OUT' || params[i].direction === 'IN OUT') {
      hasOutNote = true
      continue
    }
    filteredParams.push(params[i])
  }
  const pLines = filteredParams.map((p) => '  ' + p.name + ' ' + p.type)
  out += pLines.join(',\n') + ')\nRETURNS ' + returnType + '\nDETERMINISTIC\nBEGIN\n'
  if (hasOutNote) out += '  -- 注意: MySQL函数不支持OUT参数，已移除OUT/IN OUT参数\n'
  for (let j = 0; j < vars.length; j++) {
    const v = vars[j]
    if (v.raw) { out += '  ' + v.raw + '\n'; continue }
    if (v.cursor) { out += '  DECLARE ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue }
    out += '  DECLARE ' + v.name + ' ' + v.type
    if (v.defaultVal) out += ' DEFAULT ' + v.defaultVal
    out += ';\n'
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '').replace(/^\s*BEGIN\b/i, '')
  const bodyDeclares: string[] = []
  const bodyOther: string[] = []
  const bodyLines = cleanBody.replace(/^\n+/, '').split('\n')
  let inHandler = false
  let handlerDepth = 0
  let handlerLines: string[] = []
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li]
    if (inHandler) {
      handlerLines.push(line)
      if (/\bBEGIN\b/i.test(line)) handlerDepth++
      if (/\bEND\b\s*;/i.test(line)) {
        handlerDepth--
        if (handlerDepth <= 0) {
          bodyDeclares.push(handlerLines.join('\n'))
          handlerLines = []
          inHandler = false
        }
      }
    } else if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+/i.test(line)) {
      if (/;\s*$/.test(line) && !/\bBEGIN\b/i.test(line)) {
        bodyDeclares.push(line)
      } else {
        inHandler = true
        handlerDepth = 0
        handlerLines = [line]
        if (/\bBEGIN\b/i.test(line)) handlerDepth++
        if (/\bEND\b\s*;/i.test(line)) {
          bodyDeclares.push(handlerLines.join('\n'))
          handlerLines = []
          inHandler = false
        }
      }
    } else if (/^\s*DECLARE\s+/i.test(line)) {
      bodyDeclares.push(line)
    } else {
      bodyOther.push(line)
    }
  }
  if (bodyDeclares.length > 0) {
    const seen: Record<string, boolean> = {}
    const deduped: string[] = []
    for (let fdi = 0; fdi < bodyDeclares.length; fdi++) {
      const norm = bodyDeclares[fdi].trim().replace(/\s+/g, ' ').toUpperCase()
      if (!seen[norm]) {
        seen[norm] = true
        deduped.push(bodyDeclares[fdi])
      }
    }
    deduped.sort((a, b) => {
      const aIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(a)
      const bIsHandler = /^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(b)
      const aIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(a)
      const bIsCursor = /^\s*DECLARE\s+\w+\s+CURSOR\b/i.test(b)
      const aOrder = aIsHandler ? 2 : aIsCursor ? 1 : 0
      const bOrder = bIsHandler ? 2 : bIsCursor ? 1 : 0
      return aOrder - bOrder
    })
    out += deduped.join('\n') + '\n'
  }
  out += bodyOther.join('\n') + '\n'
  out = out.replace(/\s+$/, '\n')
  out = out.replace(/(\n\s*--[^\n]*)+\s*$/g, '\n')
  out = out.replace(/\bEND\b\s*\w*\s*;\s*(?:\/\s*)?\s*$/i, '')
  out += 'END$$\n'
  out += 'DELIMITER ;'
  return out
}

export function generatePostgresFunctionStatement(
  name: string,
  params: RoutineParam[],
  returnType: string,
  vars: RoutineVar[],
  body: string
): string {
  let out = 'CREATE OR REPLACE FUNCTION ' + name + '(\n'
  const pLines = params.map((p) => {
    let line = '  ' + p.name
    if (p.direction) line += ' ' + p.direction
    line += ' ' + p.type
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal
    return line
  })
  out += pLines.join(',\n') + ')\nRETURNS ' + returnType + '\nLANGUAGE plpgsql\nAS $$\n'
  const forVarRe = /\bFOR\s+(\w+)\s+IN\b/gi
  let forVarMatch: RegExpExecArray | null
  const forVarNames: string[] = []
  while ((forVarMatch = forVarRe.exec(body)) !== null) {
    const fvn = forVarMatch[1].toUpperCase()
    const afterFor = body.substring(
      forVarMatch.index + forVarMatch[0].length,
      forVarMatch.index + forVarMatch[0].length + 20
    )
    if (/^\s*\d/.test(afterFor) || /^\s*REVERSE\b/i.test(afterFor)) continue
    if (forVarNames.indexOf(fvn) < 0) forVarNames.push(fvn)
  }
  const cursorDecls: Array<{ name: string; query: string }> = []
  body = body.replace(/(^|\n)\s*(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?);/gim, (_m, pre, curName, curQuery) => {
    cursorDecls.push({ name: curName, query: curQuery.trim() })
    return pre
  })
  const needsDeclare =
    vars.length > 0 || body.indexOf('_pg_rowcount') >= 0 || forVarNames.length > 0 || cursorDecls.length > 0
  if (needsDeclare) {
    out += 'DECLARE\n'
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i]
      if (v.raw) { out += '  ' + v.raw + '\n'; continue }
      if (v.cursor) { out += '  ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue }
      out += '  ' + v.name + ' ' + v.type
      if (v.defaultVal) out += ' := ' + v.defaultVal
      out += ';\n'
    }
    for (let ci = 0; ci < cursorDecls.length; ci++) {
      out += '  ' + cursorDecls[ci].name + ' CURSOR FOR ' + cursorDecls[ci].query + ';\n'
    }
    if (body.indexOf('_pg_rowcount') >= 0) out += '  _pg_rowcount BIGINT;\n'
    for (let fi = 0; fi < forVarNames.length; fi++) {
      const alreadyDeclared = vars.some((v) => v.name && v.name.toUpperCase() === forVarNames[fi])
      if (!alreadyDeclared) out += '  ' + forVarNames[fi] + ' RECORD;\n'
    }
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '')
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '')
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/, '') + '\n'
  const trimmedOut = out.replace(/\s+$/, '')
  if (/\bEND\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut + '\n$$;'
  } else if (/\bEND\b\s*\w+\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut.replace(/\bEND\b\s*\w+\s*;?\s*$/i, 'END;') + '\n$$;'
  } else {
    out = trimmedOut + '\nEND;\n$$;'
  }
  return out
}

export function generateOracleProcedureStatement(
  name: string,
  params: RoutineParam[],
  vars: RoutineVar[],
  body: string
): string {
  let out = 'CREATE OR REPLACE PROCEDURE ' + name
  if (params.length > 0) {
    out += '(\n'
    const pLines = params.map((p) => {
      let line = '  ' + p.name
      line += ' ' + (p.direction || 'IN')
      let ptype = p.type
      ptype = ptype.replace(
        /\b(VARCHAR2|VARCHAR|NVARCHAR2|CHAR|NCHAR|RAW)\s*\(\s*\d+\s*(?:\s+(?:BYTE|CHAR))?\s*\)/gi,
        '$1'
      )
      line += ' ' + ptype
      if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal
      return line
    })
    out += pLines.join(',\n') + ')\n'
  } else {
    out += '\n'
  }
  out += 'IS\n'
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i]
    if (v.raw) { out += '  ' + v.raw + '\n'; continue }
    if (v.cursor) { out += '  CURSOR ' + v.name + ' IS ' + v.query + ';\n'; continue }
    out += '  ' + v.name + ' ' + v.type
    if (v.defaultVal) out += ' := ' + v.defaultVal
    out += ';\n'
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '')
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '')
  const cursorExtracted: Array<{ name: string; query: string }> = []
  cleanBody = cleanBody.replace(/(^|\n)\s*CURSOR\s+(\w+)\s+IS\s+([\s\S]*?)\s*;/gi, (_m, pre, curName, curQuery) => {
    cursorExtracted.push({ name: curName, query: curQuery.trim() })
    return pre
  })
  cleanBody = cleanBody.replace(
    /(^|\n)\s*DECLARE\s+(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?)\s*;/gi,
    (_m, pre, curName, curQuery) => {
      cursorExtracted.push({ name: curName, query: curQuery.trim() })
      return pre
    }
  )
  for (let ci = 0; ci < cursorExtracted.length; ci++) {
    out += '  CURSOR ' + cursorExtracted[ci].name + ' IS ' + cursorExtracted[ci].query + ';\n'
  }
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/, '') + '\n'
  const afterBegin = out.substring(out.lastIndexOf('BEGIN'))
  const hasEnd = /^\s*END\s*;\s*$/im.test(afterBegin)
  if (!hasEnd) {
    out = out.replace(/\s*$/, '\n')
    out += 'END;\n'
  } else {
    out = out.replace(/\bEND\s*;\s*$/i, 'END;\n')
  }
  out += '/'
  return out
}

export function generateMySqlProcedureStatement(
  name: string,
  params: RoutineParam[],
  vars: RoutineVar[],
  body: string
): string {
  let out = 'DELIMITER $$\nCREATE PROCEDURE ' + name + '(\n'
  const pLines = params.map((p) => {
    let dir = p.direction || 'IN'
    if (dir === 'IN OUT') dir = 'INOUT'
    return '  ' + dir + ' ' + p.name + ' ' + p.type
  })
  out += pLines.join(',\n') + ')\nBEGIN\n'
  const allDeclares: string[] = []
  for (let i = 0; i < vars.length; i++) {
    const v = vars[i]
    if (v.raw) { allDeclares.push('  ' + v.raw); continue }
    if (v.cursor) { allDeclares.push('  DECLARE ' + v.name + ' CURSOR FOR ' + v.query + ';'); continue }
    let decl = '  DECLARE ' + v.name + ' ' + v.type
    if (v.defaultVal) decl += ' DEFAULT ' + v.defaultVal
    decl += ';'
    allDeclares.push(decl)
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '').replace(/^\s*BEGIN\b/i, '')
  const bodyOther: string[] = []
  const bodyLines = cleanBody.replace(/^\n+/, '').split('\n')
  let inHandler = false
  let handlerDepth = 0
  let handlerLines: string[] = []
  for (let li = 0; li < bodyLines.length; li++) {
    const line = bodyLines[li]
    if (inHandler) {
      handlerLines.push(line)
      if (/\bBEGIN\b/i.test(line)) handlerDepth++
      if (/\bEND\b\s*;/i.test(line)) {
        handlerDepth--
        if (handlerDepth <= 0) {
          allDeclares.push(handlerLines.join('\n'))
          handlerLines = []
          inHandler = false
        }
      }
    } else if (/^\s*DECLARE\s+(EXIT|CONTINUE)\s+HANDLER\s+/i.test(line)) {
      if (/;\s*$/.test(line) && !/\bBEGIN\b/i.test(line)) {
        allDeclares.push(line)
      } else {
        inHandler = true
        handlerDepth = 0
        handlerLines = [line]
        if (/\bBEGIN\b/i.test(line)) handlerDepth++
        if (/\bEND\b\s*;/i.test(line)) {
          allDeclares.push(handlerLines.join('\n'))
          handlerLines = []
          inHandler = false
        }
      }
    } else if (/^\s*DECLARE\s+/i.test(line)) {
      allDeclares.push(line)
    } else {
      bodyOther.push(line)
    }
  }
  const seen: Record<string, boolean> = {}
  const deduped: string[] = []
  for (let di = 0; di < allDeclares.length; di++) {
    const norm = allDeclares[di].trim().replace(/\s+/g, ' ').toUpperCase()
    if (!seen[norm]) {
      seen[norm] = true
      deduped.push(allDeclares[di])
    }
  }
  deduped.sort((a, b) => {
    const aIsHandler = /DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(a)
    const bIsHandler = /DECLARE\s+(EXIT|CONTINUE)\s+HANDLER/i.test(b)
    const aIsCursor = /DECLARE\s+\w+\s+CURSOR\b/i.test(a) || /\bCURSOR\s+\w+\s+IS\b/i.test(a)
    const bIsCursor = /DECLARE\s+\w+\s+CURSOR\b/i.test(b) || /\bCURSOR\s+\w+\s+IS\b/i.test(b)
    const aOrder = aIsHandler ? 2 : aIsCursor ? 1 : 0
    const bOrder = bIsHandler ? 2 : bIsCursor ? 1 : 0
    return aOrder - bOrder
  })
  if (deduped.length > 0) out += deduped.join('\n') + '\n'
  out += bodyOther.join('\n') + '\n'
  out = out.replace(/(\n\s*--[^\n]*)+\s*$/g, '\n')
  out = out.replace(/\s+$/, '\n')
  out = out.replace(/\bEND\b\s*\w*\s*;\s*(?:\/\s*)?$/i, '')
  out += 'END$$\n'
  out += 'DELIMITER ;'
  return out
}

export function generatePostgresProcedureStatement(
  name: string,
  params: RoutineParam[],
  vars: RoutineVar[],
  body: string
): string {
  const sortedParams = params.slice().sort((a, b) => {
    const aIsOut =
      (a.direction || '').toUpperCase() === 'OUT' || (a.direction || '').toUpperCase() === 'INOUT'
    const bIsOut =
      (b.direction || '').toUpperCase() === 'OUT' || (b.direction || '').toUpperCase() === 'INOUT'
    const aHasDefault = !!a.defaultVal
    const bHasDefault = !!b.defaultVal
    const aOrder = aIsOut ? 1 : aHasDefault ? 2 : 0
    const bOrder = bIsOut ? 1 : bHasDefault ? 2 : 0
    return aOrder - bOrder
  })
  let out = 'CREATE OR REPLACE PROCEDURE ' + name + '(\n'
  const pLines = sortedParams.map((p) => {
    let line = '  ' + p.name
    if (p.direction) line += ' ' + p.direction
    line += ' ' + p.type
    if (p.defaultVal) line += ' DEFAULT ' + p.defaultVal
    return line
  })
  out += pLines.join(',\n') + ')\nLANGUAGE plpgsql\nAS $$\n'
  const forVarRe = /\bFOR\s+(\w+)\s+IN\b/gi
  let forVarMatch: RegExpExecArray | null
  const forVarNames: string[] = []
  while ((forVarMatch = forVarRe.exec(body)) !== null) {
    const fvn = forVarMatch[1].toUpperCase()
    const afterFor = body.substring(
      forVarMatch.index + forVarMatch[0].length,
      forVarMatch.index + forVarMatch[0].length + 20
    )
    if (/^\s*\d/.test(afterFor) || /^\s*REVERSE\b/i.test(afterFor)) continue
    if (forVarNames.indexOf(fvn) < 0) forVarNames.push(fvn)
  }
  const cursorDecls: Array<{ name: string; query: string }> = []
  body = body.replace(/(^|\n)\s*(\w+)\s+CURSOR\s+FOR\s+([\s\S]*?);/gim, (_m, pre, curName, curQuery) => {
    cursorDecls.push({ name: curName, query: curQuery.trim() })
    return pre
  })
  const needsDeclare =
    vars.length > 0 || body.indexOf('_pg_rowcount') >= 0 || forVarNames.length > 0 || cursorDecls.length > 0
  if (needsDeclare) {
    out += 'DECLARE\n'
    for (let i = 0; i < vars.length; i++) {
      const v = vars[i]
      if (v.raw) { out += '  ' + v.raw + '\n'; continue }
      if (v.cursor) { out += '  ' + v.name + ' CURSOR FOR ' + v.query + ';\n'; continue }
      out += '  ' + v.name + ' ' + v.type
      if (v.defaultVal) out += ' := ' + v.defaultVal
      out += ';\n'
    }
    for (let ci = 0; ci < cursorDecls.length; ci++) {
      out += '  ' + cursorDecls[ci].name + ' CURSOR FOR ' + cursorDecls[ci].query + ';\n'
    }
    if (body.indexOf('_pg_rowcount') >= 0) out += '  _pg_rowcount BIGINT;\n'
    for (let fi = 0; fi < forVarNames.length; fi++) {
      const alreadyDeclared = vars.some((v) => v.name && v.name.toUpperCase() === forVarNames[fi])
      if (!alreadyDeclared) out += '  ' + forVarNames[fi] + ' RECORD;\n'
    }
  }
  let cleanBody = body.replace(/^\s*\n/, '\n').replace(/\s+$/, '')
  cleanBody = cleanBody.replace(/^\s*BEGIN\b/i, '')
  out += 'BEGIN\n' + cleanBody.replace(/^\n+/, '') + '\n'
  const trimmedOut = out.replace(/\s+$/, '')
  if (/\bEND\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut + '\n$$;'
  } else if (/\bEND\b\s*\w+\s*;\s*$/i.test(trimmedOut)) {
    out = trimmedOut.replace(/\bEND\b\s*\w+\s*;?\s*$/i, 'END;') + '\n$$;'
  } else {
    out = trimmedOut + '\nEND;\n$$;'
  }
  return out
}
