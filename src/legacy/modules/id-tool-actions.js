const USCC_DEPT_ALLOWED = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'N', 'Y'])
const USCC_CHARSET = '0123456789ABCDEFGHJKLMNPQRTUWXY'

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getIdUtils() {
  return typeof window !== 'undefined' ? window.SQLDEV_ID_TOOL_UTILS : null
}

function isRegionReady(options, resultRef) {
  if (options.regionReady.value) return true
  resultRef.value = {
    type: 'error',
    text: options.regionLoadError.value || '行政区划数据尚未就绪，请稍后再试'
  }
  return false
}

function pickBestRegionCode(options, provinceCode, cityCode, countyCode) {
  var codeSet = options.regionCodeSet.value
  var county = String(countyCode || '')
  var city = String(cityCode || '')
  var province = String(provinceCode || '')
  if (/^\d{6}$/.test(county) && codeSet.has(county)) return county
  if (/^\d{6}$/.test(city) && codeSet.has(city)) return city
  if (/^\d{6}$/.test(province) && codeSet.has(province)) return province
  return ''
}

function validateIdBirth(ymd, maxDate) {
  var idUtils = getIdUtils()
  return !!(idUtils && idUtils.validateBirthYmd8(ymd, { maxDate: maxDate }))
}

function parseBirthDate(value) {
  var idUtils = getIdUtils()
  return idUtils ? idUtils.parseYmdFromIsoDate(value) : ''
}

function buildGeneratedId(regionCode, birthYmd, gender) {
  var idUtils = getIdUtils()
  if (!idUtils) return ''
  var seq = idUtils.randomSequenceByGender(gender, randomInt)
  var id17 = regionCode + birthYmd + seq
  var check = idUtils.calcIdCardCheckDigit(id17)
  return check ? id17 + check : ''
}

function validateSingleId(options, rawInput) {
  var idUtils = getIdUtils()
  if (!rawInput) return { type: 'error', text: '请输入待校验的身份证号码' }
  if (!/^\d{17}[\dX]$/.test(rawInput)) {
    return { type: 'error', text: '格式错误：应为18位（17位数字 + 最后1位数字或X）' }
  }
  if (!options.regionCodeSet.value.has(rawInput.slice(0, 6))) {
    return { type: 'error', text: '行政区划代码不存在：' + rawInput.slice(0, 6) }
  }
  var birthYmd = rawInput.slice(6, 14)
  if (!validateIdBirth(birthYmd, options.idBirthMax.value)) {
    return { type: 'error', text: '出生日期不合法：' + birthYmd }
  }
  var expectedCheck = idUtils ? idUtils.calcIdCardCheckDigit(rawInput.slice(0, 17)) : ''
  if (!expectedCheck || expectedCheck !== rawInput[17]) {
    return { type: 'error', text: '校验码错误：应为 ' + expectedCheck + '，实际为 ' + rawInput[17] }
  }
  return { type: 'success', text: '校验通过：身份证号码合法' }
}

function generateLegacyThreeCert(regionCode) {
  var idUtils = getIdUtils()
  return idUtils ? idUtils.generateLegacyThreeCert(regionCode, randomInt) : null
}

function generateUscc18(options, regionCode) {
  var idUtils = getIdUtils()
  if (!idUtils) return ''
  var body9 = idUtils.randomUsccBody(9, randomInt)
  var base17 = String(options.usccDeptCode.value) + String(options.usccOrgTypeCode.value) + regionCode + body9
  var check = idUtils.calcUsccCheckChar(base17)
  return check ? base17 + check : ''
}

function validateUsccToken(options, raw) {
  var idUtils = getIdUtils()
  if (!idUtils) return { ok: false, msg: '证件工具初始化失败，请刷新页面后重试' }
  return idUtils.validateUsccOrLegacyToken(raw, function (code) {
    return options.regionCodeSet.value.has(code)
  })
}

export function createIdToolActions(options) {
  function generateIdNumber() {
    if (!isRegionReady(options, options.idGenerateResult)) return
    var regionCode = pickBestRegionCode(
      options,
      options.idProvinceCode.value,
      options.idCityCode.value,
      options.idCountyCode.value
    )
    if (!regionCode) {
      options.idGenerateResult.value = { type: 'error', text: '请选择有效的省市区' }
      return
    }
    var ymd = parseBirthDate(options.idBirthDate.value)
    if (!ymd) {
      options.idGenerateResult.value = { type: 'error', text: '请输入合法的出生日期' }
      return
    }
    if (!validateIdBirth(ymd, options.idBirthMax.value)) {
      options.idGenerateResult.value = { type: 'error', text: '出生日期不在合理范围内' }
      return
    }
    var idNumber = buildGeneratedId(regionCode, ymd, options.idGender.value)
    if (!idNumber) {
      options.idGenerateResult.value = { type: 'error', text: '生成失败，请重试' }
      return
    }
    options.idGeneratedNumber.value = idNumber
    options.idGenerateResult.value = { type: 'success', text: '已生成合法身份证号码' }
  }

  function validateIdNumber() {
    var rawInput = String(options.idVerifyInput.value || '').trim().toUpperCase()
    var result = validateSingleId(options, rawInput)
    options.setIdVerifyResult(result.type, result.text)
  }

  function copyGeneratedIdNumber() {
    if (!options.idGeneratedNumber.value) {
      options.idGenerateResult.value = { type: 'info', text: '请先生成身份证号码' }
      return
    }
    options.clipboardWrite(options.idGeneratedNumber.value).then(function (ok) {
      if (ok) options.flashButtonState(options.idCopyDone, 'idCopy')
    })
  }

  function generateUsccCode() {
    if (!isRegionReady(options, options.usccGenerateResult)) return
    if (!USCC_DEPT_ALLOWED.has(options.usccDeptCode.value)) {
      options.usccGenerateResult.value = { type: 'error', text: '登记管理部门代码无效' }
      return
    }
    if (!USCC_CHARSET.includes(options.usccOrgTypeCode.value)) {
      options.usccGenerateResult.value = { type: 'error', text: '机构类别代码无效' }
      return
    }
    var regionCode = pickBestRegionCode(
      options,
      options.usccProvinceCode.value,
      options.usccCityCode.value,
      options.usccCountyCode.value
    )
    if (!regionCode) {
      options.usccGenerateResult.value = { type: 'error', text: '请选择有效的登记机关行政区划' }
      return
    }
    if (options.usccCodeMode.value === 'legacy3') {
      var legacy = generateLegacyThreeCert(regionCode)
      if (!legacy) {
        options.usccGenerateResult.value = { type: 'error', text: '旧版三证生成失败，请重试' }
        return
      }
      options.usccLegacyGenerated.value = legacy
      options.usccGeneratedCode.value = legacy.businessRegNo
      options.usccCopyPayload.value =
        '工商注册号：' +
        legacy.businessRegNo +
        '\n' +
        '组织机构代码：' +
        legacy.orgCode +
        '\n' +
        '税务登记号：' +
        legacy.taxNo
      options.usccGenerateResult.value = {
        type: 'success',
        text: '已生成旧版三证号码（工商/组织机构/税务）'
      }
      return
    }
    var uscc = generateUscc18(options, regionCode)
    if (!uscc) {
      options.usccGenerateResult.value = { type: 'error', text: '生成失败，请重试' }
      return
    }
    options.usccLegacyGenerated.value = null
    options.usccGeneratedCode.value = uscc
    options.usccCopyPayload.value = uscc
    options.usccGenerateResult.value = { type: 'success', text: '已生成统一社会信用代码' }
  }

  function validateUsccCode() {
    var rawInput = String(options.usccVerifyInput.value || '').trim().toUpperCase()
    if (!rawInput) {
      options.setUsccVerifyResult('error', '请输入待校验的代码')
      return
    }
    var tokens = rawInput.match(/[0-9A-HJ-NPQRTUWXY]{18}|[0-9A-Z]{8}-?[0-9X]|\d{15}/g)
    if (tokens && tokens.length > 1) {
      var lines = []
      var allOk = true
      for (var idx = 0; idx < tokens.length; idx++) {
        var token = tokens[idx]
        var checkRes = validateUsccToken(options, token)
        lines.push((checkRes.ok ? '√ ' : '× ') + token + '：' + checkRes.msg.replace(/^校验通过：/, ''))
        if (!checkRes.ok) allOk = false
      }
      options.setUsccVerifyResult(allOk ? 'success' : 'info', lines.join('；'))
      return
    }
    var verifyRes = validateUsccToken(options, rawInput)
    options.setUsccVerifyResult(verifyRes.ok ? 'success' : 'error', verifyRes.msg)
  }

  function copyGeneratedUsccCode() {
    var payload = String(options.usccCopyPayload.value || options.usccGeneratedCode.value || '').trim()
    if (!payload) {
      options.usccGenerateResult.value = { type: 'info', text: '请先生成代码' }
      return
    }
    options.clipboardWrite(payload).then(function (ok) {
      if (ok) options.flashButtonState(options.usccCopyDone, 'usccCopy')
    })
  }

  return {
    generateIdNumber,
    validateIdNumber,
    copyGeneratedIdNumber,
    generateUsccCode,
    validateUsccCode,
    copyGeneratedUsccCode
  }
}

if (typeof window !== 'undefined') {
  window.SQLDEV_LEGACY_ID_TOOL_ACTIONS = {
    createIdToolActions
  }
}
