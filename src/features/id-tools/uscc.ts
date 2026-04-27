export const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY'
export const USCC_WEIGHTS = [
  1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28
] as const
export const USCC_DEPT_ALLOWED = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'A',
  'N',
  'Y'
])
export const ORG_CODE_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const ORG_CODE_WEIGHTS = [3, 7, 9, 10, 5, 8, 4, 2] as const

const USCC_CHAR_INDEX = new Map(USCC_CHARSET.split('').map((char, index) => [char, index]))

export interface LegacyThreeCert {
  businessRegNo: string
  orgCode: string
  taxNo: string
}

export interface ValidateCodeResult {
  ok: boolean
  msg: string
}

export function calcUsccCheckChar(base17: unknown): string {
  const value = String(base17 || '').toUpperCase()
  if (!/^[0-9A-HJ-NPQRTUWXY]{17}$/.test(value)) return ''

  let sum = 0
  for (let index = 0; index < 17; index++) {
    const charIndex = USCC_CHAR_INDEX.get(value[index])
    if (typeof charIndex !== 'number') return ''
    sum += charIndex * USCC_WEIGHTS[index]
  }

  return USCC_CHARSET[(31 - (sum % 31)) % 31]
}

export function calcOrgCodeCheckChar(base8: unknown): string {
  const value = String(base8 || '').toUpperCase()
  if (!/^[0-9A-Z]{8}$/.test(value)) return ''

  let sum = 0
  for (let index = 0; index < 8; index++) {
    const charIndex = ORG_CODE_CHARSET.indexOf(value[index])
    if (charIndex < 0) return ''
    sum += charIndex * ORG_CODE_WEIGHTS[index]
  }

  const check = 11 - (sum % 11)
  if (check === 10) return 'X'
  if (check === 11 || check === 12) return '0'
  return String(check)
}

export function randomUsccBody(length: number, randomInt = defaultRandomInt): string {
  return randomChars(USCC_CHARSET, length, randomInt)
}

export function randomOrgCodeBody(length: number, randomInt = defaultRandomInt): string {
  return randomChars(ORG_CODE_CHARSET, length, randomInt)
}

export function generateLegacyThreeCert(
  regionCode: unknown,
  randomInt = defaultRandomInt
): LegacyThreeCert | null {
  const region = String(regionCode || '')
  if (!/^\d{6}$/.test(region)) return null

  const businessRegNo = region + String(randomInt(0, 999999999)).padStart(9, '0')
  const orgBody = randomOrgCodeBody(8, randomInt)
  const orgCheck = calcOrgCodeCheckChar(orgBody)
  if (!orgCheck) return null

  return {
    businessRegNo,
    orgCode: `${orgBody}-${orgCheck}`,
    taxNo: `${region}${orgBody}${orgCheck}`
  }
}

export function validateUscc18(
  raw: unknown,
  regionCodeExists: (code: string) => boolean
): ValidateCodeResult {
  const value = String(raw || '').toUpperCase()
  if (!/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(value)) {
    return { ok: false, msg: '格式错误：应为18位，仅允许数字及大写字母（不含 I/O/S/V/Z）' }
  }

  if (!USCC_DEPT_ALLOWED.has(value[0])) {
    return { ok: false, msg: `登记管理部门代码不合法：${value[0]}` }
  }

  if (!USCC_CHARSET.includes(value[1])) {
    return { ok: false, msg: `机构类别代码不合法：${value[1]}` }
  }

  const regionCode = value.slice(2, 8)
  if (!regionCodeExists(regionCode)) {
    return { ok: false, msg: `行政区划码不存在：${regionCode}` }
  }

  const expected = calcUsccCheckChar(value.slice(0, 17))
  if (!expected || expected !== value[17]) {
    return { ok: false, msg: `校验码错误：应为 ${expected}，实际为 ${value[17]}` }
  }

  return { ok: true, msg: '校验通过：统一社会信用代码合法' }
}

export function validateOrgCode(raw: unknown): ValidateCodeResult {
  const normalized = String(raw || '')
    .toUpperCase()
    .replace(/-/g, '')

  if (!/^[0-9A-Z]{8}[0-9X]$/.test(normalized)) {
    return { ok: false, msg: '组织机构代码格式错误：应为8位主体码 + 校验位（支持中划线）' }
  }

  const expected = calcOrgCodeCheckChar(normalized.slice(0, 8))
  if (!expected || expected !== normalized[8]) {
    return { ok: false, msg: `组织机构代码校验位错误：应为 ${expected}，实际为 ${normalized[8]}` }
  }

  return { ok: true, msg: '校验通过：组织机构代码合法' }
}

export function validateLegacy15(
  raw: unknown,
  regionCodeExists: (code: string) => boolean
): ValidateCodeResult {
  const value = String(raw || '')
  if (!/^\d{15}$/.test(value)) {
    return { ok: false, msg: '旧版15位号码格式错误：应为15位数字' }
  }

  const regionCode = value.slice(0, 6)
  if (!regionCodeExists(regionCode)) {
    return { ok: false, msg: `行政区划码不存在：${regionCode}` }
  }

  return { ok: true, msg: '校验通过：15位旧版号码格式合法' }
}

export function validateUsccOrLegacyToken(
  raw: unknown,
  regionCodeExists: (code: string) => boolean
): ValidateCodeResult {
  const value = String(raw || '').toUpperCase()
  if (/^[0-9A-HJ-NPQRTUWXY]{18}$/.test(value)) return validateUscc18(value, regionCodeExists)
  if (/^[0-9A-Z]{8}-?[0-9X]$/.test(value)) return validateOrgCode(value)
  if (/^\d{15}$/.test(value)) return validateLegacy15(value, regionCodeExists)
  return { ok: false, msg: `无法识别的编码格式：${value}` }
}

function randomChars(
  charset: string,
  length: number,
  randomInt: (min: number, max: number) => number
): string {
  let output = ''
  for (let index = 0; index < length; index++) {
    output += charset[randomInt(0, charset.length - 1)]
  }
  return output
}

function defaultRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
