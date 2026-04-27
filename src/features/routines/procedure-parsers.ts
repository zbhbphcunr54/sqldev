import {
  extractMySqlRoutineDeclarations,
  extractPostgresRoutineDeclarations,
  parseMySqlRoutineParam,
  parseOracleRoutineParam,
  parseOracleVariableDeclarations,
  parsePostgresRoutineParam,
  splitRoutineParamList,
  type RoutineParameterModel,
  type RoutineVariableModel
} from './parser-primitives'
import {
  extractRoutineHeaderWithParams,
  stripTrailingOracleStyleComments,
  stripTrailingPostgresDollarComments
} from './header-utils'

export interface ParsedRoutineProcedureModel {
  name: string
  params: RoutineParameterModel[]
  vars: RoutineVariableModel[]
  body: string
}

export function parseOracleProcedureDefinition(input: string): ParsedRoutineProcedureModel {
  let source = input.replace(/\s*\/\s*$/, '').trim()
  source = stripTrailingOracleStyleComments(source)

  const withParams = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([\w.]+)\s*\(/i
  )

  if (!withParams) {
    const withoutParams = source.match(
      /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([\w.]+)\s*(IS|AS)\b/i
    )
    if (!withoutParams || typeof withoutParams.index !== 'number') {
      throw new Error('无法解析 Oracle 存储过程头')
    }

    const afterHeader = source.substring(withoutParams.index + withoutParams[0].length)
    const beginIndex = afterHeader.search(/\bBEGIN\b/i)
    let declBlock = ''
    let bodyPart = afterHeader
    if (beginIndex >= 0) {
      declBlock = afterHeader.substring(0, beginIndex).trim()
      bodyPart = afterHeader.substring(beginIndex)
    }

    const vars = parseOracleVariableDeclarations(declBlock)
    const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i)
    return {
      name: withoutParams[1],
      params: [],
      vars,
      body: bodyMatch ? bodyMatch[1] : bodyPart
    }
  }

  const isAsMatch = withParams.afterParams.match(/^\s*(IS|AS)\b/i)
  if (!isAsMatch) {
    throw new Error('无法解析 Oracle 存储过程头 IS/AS')
  }

  const afterHeader = withParams.afterParams.substring(isAsMatch[0].length)
  const beginIndex = afterHeader.search(/\bBEGIN\b/i)
  let declBlock = ''
  let bodyPart = afterHeader
  if (beginIndex >= 0) {
    declBlock = afterHeader.substring(0, beginIndex).trim()
    bodyPart = afterHeader.substring(beginIndex)
  }

  const params = splitRoutineParamList(withParams.paramStr)
    .map(parseOracleRoutineParam)
    .filter(Boolean) as RoutineParameterModel[]
  const vars = parseOracleVariableDeclarations(declBlock)
  const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i)

  return {
    name: withParams.name,
    params,
    vars,
    body: bodyMatch ? bodyMatch[1] : bodyPart
  }
}

export function parseMySqlProcedureDefinition(input: string): ParsedRoutineProcedureModel {
  let source = input.replace(/^\s*DELIMITER\s+\S+\s*$/gim, '').trim()
  source = source.replace(/\$\$/g, '').trim()
  source = stripTrailingOracleStyleComments(source)

  const header = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?PROCEDURE\s+([\w.]+)\s*\(/i
  )
  if (!header) {
    throw new Error('无法解析 MySQL 存储过程头')
  }

  const bodyMatch = header.afterParams.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i)
  if (!bodyMatch) {
    throw new Error('无法找到 MySQL 存储过程体 BEGIN...END')
  }

  const extracted = extractMySqlRoutineDeclarations(bodyMatch[1])
  const params = splitRoutineParamList(header.paramStr)
    .map(parseMySqlRoutineParam)
    .filter(Boolean) as RoutineParameterModel[]

  return {
    name: header.name,
    params,
    vars: extracted.vars,
    body: extracted.body
  }
}

export function parsePostgresProcedureDefinition(input: string): ParsedRoutineProcedureModel {
  let source = input.trim()
  source = stripTrailingPostgresDollarComments(source)

  const header = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+([\w.]+)\s*\(/i
  )
  if (!header) {
    throw new Error('无法解析 PostgreSQL 存储过程头')
  }

  let asRe = /^(?:LANGUAGE\s+\w+\s*)?AS\s*\$\$/i
  let asMatch = header.afterParams.match(asRe)
  if (!asMatch) {
    asRe = /^AS\s*\$\$/i
    asMatch = header.afterParams.match(asRe)
  }
  if (!asMatch) {
    throw new Error('无法解析 PostgreSQL 存储过程头 AS $$')
  }

  let inner = header.afterParams
    .substring(asMatch[0].length)
    .replace(/\$\$\s*;?\s*$/g, '')
    .replace(/\bLANGUAGE\s+\w+\s*;?\s*$/gi, '')
    .replace(/\$\$\s*;?\s*$/g, '')
    .trim()
  inner = inner
    .replace(/\$\$\s*LANGUAGE\s+\w+\s*;?\s*$/gi, '')
    .replace(/\$\$\s*;?\s*$/g, '')
    .trim()

  const extracted = extractPostgresRoutineDeclarations(inner)
  const params = splitRoutineParamList(header.paramStr)
    .map(parsePostgresRoutineParam)
    .filter(Boolean) as RoutineParameterModel[]

  return {
    name: header.name,
    params,
    vars: extracted.vars,
    body: extracted.body
  }
}
