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

export interface ParsedRoutineFunctionModel {
  name: string
  params: RoutineParameterModel[]
  returnType: string
  vars: RoutineVariableModel[]
  body: string
}

export function parseOracleFunctionDefinition(input: string): ParsedRoutineFunctionModel {
  let source = input.replace(/\s*\/\s*$/, '').trim()
  source = stripTrailingOracleStyleComments(source)

  const withParams = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(/i
  )

  let name = ''
  let paramStr = ''
  let afterParams = ''
  if (withParams) {
    name = withParams.name
    paramStr = withParams.paramStr
    afterParams = withParams.afterParams
  } else {
    const noParen = source.match(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s+/i)
    if (!noParen || typeof noParen.index !== 'number') {
      throw new Error('无法解析 Oracle 函数头')
    }
    name = noParen[1]
    afterParams = source.substring(noParen.index + noParen[0].length).trim()
  }

  const returnMatch = afterParams.match(/^RETURN\s+(\S+(?:\s*\([^)]*\))?)\s+(IS|AS)\b/i)
  if (!returnMatch) {
    throw new Error('无法解析 Oracle 函数返回类型')
  }

  const returnType = returnMatch[1]
  const afterHeader = afterParams.substring(returnMatch[0].length)
  const beginIndex = afterHeader.search(/\bBEGIN\b/i)
  let declBlock = ''
  let bodyPart = afterHeader
  if (beginIndex >= 0) {
    declBlock = afterHeader.substring(0, beginIndex).trim()
    bodyPart = afterHeader.substring(beginIndex)
  }

  const params = splitRoutineParamList(paramStr)
    .map(parseOracleRoutineParam)
    .filter(Boolean) as RoutineParameterModel[]
  const vars = parseOracleVariableDeclarations(declBlock)
  const bodyMatch = bodyPart.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i)
  const body = bodyMatch ? bodyMatch[1] : bodyPart

  return { name, params, returnType, vars, body }
}

export function parseMySqlFunctionDefinition(input: string): ParsedRoutineFunctionModel {
  let source = input.replace(/^\s*DELIMITER\s+\S+\s*$/gim, '').trim()
  source = source.replace(/\$\$/g, '').trim()
  source = stripTrailingOracleStyleComments(source)

  const header = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:DEFINER\s*=\s*\S+\s+)?FUNCTION\s+([\w.]+)\s*\(/i
  )
  if (!header) {
    throw new Error('无法解析 MySQL 函数头')
  }

  const returnMatch = header.afterParams.match(
    /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*(?:DETERMINISTIC\s*)?(?:READS\s+SQL\s+DATA\s*)?(?:CONTAINS\s+SQL\s*)?(?:NO\s+SQL\s*)?(?:MODIFIES\s+SQL\s+DATA\s*)?/i
  )
  if (!returnMatch) {
    throw new Error('无法解析 MySQL 函数返回类型')
  }

  const returnType = returnMatch[1]
  const afterHeader = header.afterParams.substring(returnMatch[0].length)
  const bodyMatch = afterHeader.match(/\bBEGIN\b([\s\S]*)\bEND\b\s*\w*\s*;?\s*$/i)
  if (!bodyMatch) {
    throw new Error('无法找到 MySQL 函数体 BEGIN...END')
  }

  const extracted = extractMySqlRoutineDeclarations(bodyMatch[1])
  const params = splitRoutineParamList(header.paramStr)
    .map(parseMySqlRoutineParam)
    .filter(Boolean) as RoutineParameterModel[]

  return {
    name: header.name,
    params,
    returnType,
    vars: extracted.vars,
    body: extracted.body
  }
}

export function parsePostgresFunctionDefinition(input: string): ParsedRoutineFunctionModel {
  let source = input.trim()
  source = stripTrailingPostgresDollarComments(source)

  const header = extractRoutineHeaderWithParams(
    source,
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([\w.]+)\s*\(/i
  )
  if (!header) {
    throw new Error('无法解析 PostgreSQL 函数头')
  }

  let returnsRe = /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*(?:LANGUAGE\s+\w+\s*)?AS\s*\$\$/i
  let returnMatch = header.afterParams.match(returnsRe)
  if (!returnMatch) {
    returnsRe = /^RETURNS\s+(\S+(?:\s*\([^)]*\))?)\s*AS\s*\$\$/i
    returnMatch = header.afterParams.match(returnsRe)
  }
  if (!returnMatch) {
    throw new Error('无法解析 PostgreSQL 函数返回类型')
  }

  const returnType = returnMatch[1]
  let inner = header.afterParams
    .substring(returnMatch[0].length)
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
    returnType,
    vars: extracted.vars,
    body: extracted.body
  }
}
