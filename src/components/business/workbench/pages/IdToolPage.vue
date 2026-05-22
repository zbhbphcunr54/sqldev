<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useClipboard } from '@/composables/useClipboard'
import { writeOperationLog } from '@/api/operation-logs'
import FormSelect from '@/components/common/FormSelect.vue'
import {
  calcIdCardCheckDigit,
  validateBirthYmd8,
  randomSequenceByGender,
  validateUscc18,
  validateOrgCode,
  validateLegacy15,
  generateLegacyThreeCert,
  calcUsccCheckChar,
  randomUsccBody
} from '@/features/id-tools'

const { copyToClipboard } = useClipboard()

// ==================== 状态 ====================

const regionLoading = ref(true)
const regionLoadError = ref('')
const provinces = ref<{ code: string; name: string }[]>([])
const citiesByProvince = ref<Record<string, { code: string; name: string }[]>>({})
const countiesByCity = ref<Record<string, { code: string; name: string }[]>>({})

// ID Card 状态
const idProvinceCode = ref('110000')
const idCityCode = ref('110000')
const idCountyCode = ref('110101')
const idBirthYear = ref('1990')
const idBirthMonth = ref('01')
const idBirthDay = ref('01')
const idGender = ref('male')
const idGeneratedNumber = ref('')
const idGenerateMsg = ref('')
const idGenerateMsgType = ref<'success' | 'error' | ''>('')
const idVerifyInput = ref('')
const idVerifyMsg = ref('')
const idVerifyMsgType = ref<'success' | 'error' | 'neutral' | ''>('')
const idCopyDone = ref(false)
const idVerifyKey = ref(0)
const idLastVerifyResult = ref('')

// USCC 状态
const usccProvinceCode = ref('110000')
const usccCityCode = ref('110000')
const usccCountyCode = ref('110101')
const usccCodeMode = ref('uscc18')
const usccDeptCode = ref('9')
const usccOrgTypeCode = ref('1')
const usccGeneratedCode = ref('')
const usccGenerateMsg = ref('')
const usccGenerateMsgType = ref<'success' | 'error' | ''>('')
const usccVerifyInput = ref('')
const usccVerifyMsg = ref('')
const usccVerifyMsgType = ref<'success' | 'error' | 'neutral' | ''>('')
const usccCopyDone = ref(false)
const usccVerifyKey = ref(0)
const usccLastVerifyResult = ref('')

const usccLegacyParsed = ref<{
  bizRegNo: string
  orgCode: string
  taxCode: string
} | null>(null)

// ==================== 计算属性 ====================

const idCityOptions = computed(() => citiesByProvince.value[idProvinceCode.value] || [])
const idCountyOptions = computed(() => countiesByCity.value[idCityCode.value] || [])
const usccCityOptions = computed(() => citiesByProvince.value[usccProvinceCode.value] || [])
const usccCountyOptions = computed(() => countiesByCity.value[usccCityCode.value] || [])

const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years: string[] = []
  for (let y = 1940; y <= currentYear; y++) {
    years.push(String(y))
  }
  return years
})

const monthOptions = computed(() => {
  const months: string[] = []
  for (let m = 1; m <= 12; m++) {
    months.push(String(m).padStart(2, '0'))
  }
  return months
})

const dayOptions = computed(() => {
  const days: string[] = []
  for (let d = 1; d <= 31; d++) {
    days.push(String(d).padStart(2, '0'))
  }
  return days
})

// ==================== FormSelect 选项 ====================

const provinceFormOptions = computed(() =>
  provinces.value.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` }))
)
const idCityFormOptions = computed(() =>
  idCityOptions.value.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))
)
const usccCityFormOptions = computed(() =>
  usccCityOptions.value.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))
)
const idCountyFormOptions = computed(() =>
  idCountyOptions.value.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))
)
const usccCountyFormOptions = computed(() =>
  usccCountyOptions.value.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))
)
const yearFormOptions = computed(() =>
  yearOptions.value.map((y) => ({ value: y, label: `${y}年` }))
)
const monthFormOptions = computed(() =>
  monthOptions.value.map((m) => ({ value: m, label: `${m}月` }))
)
const dayFormOptions = computed(() => dayOptions.value.map((d) => ({ value: d, label: `${d}日` })))

const codeModeOptions: { value: string; label: string }[] = [
  { value: 'uscc18', label: '统一社会信用代码（18位）' },
  { value: 'org15', label: '旧版三证（工商/组织机构/税务）' }
]

const deptFormOptions = computed(() =>
  deptOptions.map((d) => ({ value: d.value, label: `${d.label} (${d.value})` }))
)
const orgTypeFormOptions = computed(() =>
  currentOrgTypes.value.map((o) => ({ value: o.value, label: `${o.label} (${o.value})` }))
)

// ==================== 登记管理部门与机构类别映射 ====================

interface OrgTypeItem {
  value: string
  label: string
}

interface DeptItem {
  value: string
  label: string
  orgTypes: OrgTypeItem[]
}

const deptOptions: DeptItem[] = [
  {
    value: '1',
    label: '机构编制',
    orgTypes: [
      { value: '1', label: '机关' },
      { value: '2', label: '事业单位' },
      { value: '3', label: '中央编办直接管理机构编制的群众团体' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '2',
    label: '外交',
    orgTypes: [
      { value: '1', label: '外国常驻新闻机构' },
      { value: '2', label: '外国企业常驻代表机构' },
      { value: '3', label: '外国企业在中国境内从事生产经营活动' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '3',
    label: '司法行政',
    orgTypes: [
      { value: '1', label: '律师执业机构' },
      { value: '2', label: '公证处' },
      { value: '3', label: '基层法律服务所' },
      { value: '4', label: '司法鉴定机构' },
      { value: '5', label: '仲裁委员会' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '4',
    label: '文化',
    orgTypes: [
      { value: '1', label: '外国在华文化中心' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '5',
    label: '民政',
    orgTypes: [
      { value: '1', label: '社会团体' },
      { value: '2', label: '民办非企业单位' },
      { value: '3', label: '基金会' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '6',
    label: '旅游',
    orgTypes: [
      { value: '1', label: '外国旅游部门常驻代表机构' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '7',
    label: '宗教',
    orgTypes: [
      { value: '1', label: '宗教活动场所' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '8',
    label: '工会',
    orgTypes: [
      { value: '1', label: '基层工会' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: '9',
    label: '市场监管',
    orgTypes: [
      { value: '1', label: '企业' },
      { value: '2', label: '个体工商户' },
      { value: '3', label: '农民专业合作社' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: 'A',
    label: '中央军委',
    orgTypes: [
      { value: '1', label: '军队事业单位' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: 'N',
    label: '农业',
    orgTypes: [
      { value: '1', label: '组级集体经济组织' },
      { value: '2', label: '村级集体经济组织' },
      { value: '3', label: '乡镇级集体经济组织' },
      { value: '9', label: '其他' }
    ]
  },
  {
    value: 'Y',
    label: '其他',
    orgTypes: [{ value: '1', label: '其他' }]
  }
]

const currentOrgTypes = computed(() => {
  const dept = deptOptions.find((d) => d.value === usccDeptCode.value)
  return dept?.orgTypes || []
})

// ==================== 行政区划存在性检查 ====================

function regionCodeExists(code: string): boolean {
  if (provinces.value.some((p) => p.code === code)) return true
  for (const list of Object.values(citiesByProvince.value)) {
    if (list.some((c) => c.code === code)) return true
  }
  for (const list of Object.values(countiesByCity.value)) {
    if (list.some((c) => c.code === code)) return true
  }
  return false
}

function maskCodePreview(value: string): string {
  if (!value) return ''
  if (value.length <= 6) return `${value.slice(0, 2)}***`
  return `${value.slice(0, 3)}***${value.slice(-2)}`
}

function writeIdToolLog(params: {
  operation: 'id_card_generate' | 'id_card_validate' | 'uscc_generate' | 'uscc_validate'
  responseStatus: number
  requestBody: Record<string, unknown>
  responseBody: Record<string, unknown>
  errorMessage?: string
}): void {
  void writeOperationLog({
    operation: params.operation,
    api_name: 'id-tool-page',
    request_body: params.requestBody,
    response_body: params.responseBody,
    response_status: params.responseStatus,
    error_message: params.errorMessage
  }).catch((err: unknown) => { console.warn('[IdTool] operation log write failed:', err) })
}

// ==================== 数据加载 ====================

interface RegionJsonItem {
  code: string
  name: string
  cityList?: RegionCityItem[]
}

interface RegionCityItem {
  code: string
  name: string
  areaList?: { code: string; name: string }[]
}

async function loadRegionData(): Promise<void> {
  regionLoading.value = true
  regionLoadError.value = ''
  try {
    const baseUrl = import.meta.env.BASE_URL || '/'
    // Static asset read, not a business API request — exempt from API layer requirement
    const response = await fetch(baseUrl + 'region_codes_2024.json')
    const data: RegionJsonItem[] = await response.json()

    provinces.value = data.map((p) => ({ code: p.code, name: p.name }))

    const cityMap: Record<string, { code: string; name: string }[]> = {}
    const countyMap: Record<string, { code: string; name: string }[]> = {}

    for (const province of data) {
      if (province.cityList) {
        for (const city of province.cityList) {
          if (!cityMap[province.code]) cityMap[province.code] = []
          cityMap[province.code].push({ code: city.code, name: city.name })

          if (city.areaList) {
            for (const area of city.areaList) {
              if (!countyMap[city.code]) countyMap[city.code] = []
              countyMap[city.code].push({ code: area.code, name: area.name })
            }
          }
        }
      }
    }

    citiesByProvince.value = cityMap
    countiesByCity.value = countyMap
  } catch {
    regionLoadError.value = '行政区划数据加载失败'
  } finally {
    regionLoading.value = false
  }
}

// ==================== 身份证功能 ====================

function generateIdNumber(): void {
  const regionCode = idCountyCode.value || idCityCode.value || idProvinceCode.value
  const birthYmd = `${idBirthYear.value}${idBirthMonth.value}${idBirthDay.value}`

  if (!validateBirthYmd8(birthYmd)) {
    idGenerateMsg.value = '出生日期不合法'
    idGenerateMsgType.value = 'error'
    writeIdToolLog({
      operation: 'id_card_generate',
      responseStatus: 400,
      requestBody: {
        region_code: regionCode,
        birth_year: idBirthYear.value,
        birth_month: idBirthMonth.value,
        birth_day: idBirthDay.value,
        gender: idGender.value
      },
      responseBody: { ok: false, error: 'invalid_birth_date' },
      errorMessage: 'invalid_birth_date'
    })
    return
  }

  const seq = randomSequenceByGender(idGender.value)
  const id17 = regionCode + birthYmd + seq
  const check = calcIdCardCheckDigit(id17)

  if (check) {
    idGeneratedNumber.value = id17 + check
    idGenerateMsg.value = '已生成合法身份证号码'
    idGenerateMsgType.value = 'success'
    writeIdToolLog({
      operation: 'id_card_generate',
      responseStatus: 200,
      requestBody: {
        region_code: regionCode,
        birth_year: idBirthYear.value,
        birth_month: idBirthMonth.value,
        birth_day: idBirthDay.value,
        gender: idGender.value
      },
      responseBody: {
        ok: true,
        length: idGeneratedNumber.value.length,
        preview: maskCodePreview(idGeneratedNumber.value)
      }
    })
  } else {
    idGenerateMsg.value = '生成失败'
    idGenerateMsgType.value = 'error'
    writeIdToolLog({
      operation: 'id_card_generate',
      responseStatus: 500,
      requestBody: {
        region_code: regionCode,
        birth_year: idBirthYear.value,
        birth_month: idBirthMonth.value,
        birth_day: idBirthDay.value,
        gender: idGender.value
      },
      responseBody: { ok: false, error: 'generate_failed' },
      errorMessage: 'generate_failed'
    })
  }
}

async function validateIdNumber(): Promise<void> {
  const input = idVerifyInput.value.trim()

  if (!input) {
    idVerifyKey.value++
    idVerifyMsg.value = '请输入身份证号码'
    idVerifyMsgType.value = 'error'
    idLastVerifyResult.value = ''
    writeIdToolLog({
      operation: 'id_card_validate',
      responseStatus: 400,
      requestBody: { input_length: input.length },
      responseBody: { ok: false, error: 'empty_input' },
      errorMessage: 'empty_input'
    })
    return
  }

  if (!/^\d{17}[\dX]$/i.test(input)) {
    idVerifyKey.value++
    idVerifyMsg.value = '格式错误'
    idVerifyMsgType.value = 'error'
    idLastVerifyResult.value = input + '|格式错误'
    writeIdToolLog({
      operation: 'id_card_validate',
      responseStatus: 400,
      requestBody: { input_length: input.length, preview: maskCodePreview(input) },
      responseBody: { ok: false, error: 'invalid_format' },
      errorMessage: 'invalid_format'
    })
    return
  }

  const birthYmd = input.slice(6, 14)
  if (!validateBirthYmd8(birthYmd)) {
    idVerifyKey.value++
    idVerifyMsg.value = '出生日期不合法'
    idVerifyMsgType.value = 'error'
    idLastVerifyResult.value = input + '|出生日期不合法'
    writeIdToolLog({
      operation: 'id_card_validate',
      responseStatus: 400,
      requestBody: { input_length: input.length, preview: maskCodePreview(input) },
      responseBody: { ok: false, error: 'invalid_birth_date' },
      errorMessage: 'invalid_birth_date'
    })
    return
  }

  const expectedCheck = calcIdCardCheckDigit(input.slice(0, 17))
  if (!expectedCheck || expectedCheck.toUpperCase() !== input[17].toUpperCase()) {
    idVerifyKey.value++
    idVerifyMsg.value = '校验码错误'
    idVerifyMsgType.value = 'error'
    idLastVerifyResult.value = input + '|校验码错误'
    writeIdToolLog({
      operation: 'id_card_validate',
      responseStatus: 400,
      requestBody: { input_length: input.length, preview: maskCodePreview(input) },
      responseBody: { ok: false, error: 'invalid_check_digit' },
      errorMessage: 'invalid_check_digit'
    })
    return
  }

  const resultKey = input + '|校验通过'
  if (resultKey === idLastVerifyResult.value) {
    idVerifyMsg.value = '校验结果与上次相同'
    idVerifyMsgType.value = 'neutral'
  } else {
    idVerifyKey.value++
    idVerifyMsg.value = '校验通过：身份证号码合法'
    idVerifyMsgType.value = 'success'
    idLastVerifyResult.value = resultKey
  }

  writeIdToolLog({
    operation: 'id_card_validate',
    responseStatus: 200,
    requestBody: { input_length: input.length, preview: maskCodePreview(input) },
    responseBody: { ok: true }
  })
}

async function copyIdNumber(): Promise<void> {
  if (!idGeneratedNumber.value) return
  const success = await copyToClipboard(idGeneratedNumber.value)
  if (success) {
    idCopyDone.value = true
    setTimeout(() => {
      idCopyDone.value = false
    }, 2000)
  }
}

// ==================== 统一社会信用代码功能 ====================

function generateUsccCode(): void {
  const regionCode = usccCountyCode.value || usccCityCode.value || usccProvinceCode.value

  if (usccCodeMode.value === 'uscc18') {
    const body9 = randomUsccBody(9)
    const base17 = usccDeptCode.value + usccOrgTypeCode.value + regionCode + body9
    const checkChar = calcUsccCheckChar(base17)

    if (!checkChar) {
      usccGenerateMsg.value = '生成失败：校验码计算错误'
      usccGenerateMsgType.value = 'error'
      writeIdToolLog({
        operation: 'uscc_generate',
        responseStatus: 500,
        requestBody: {
          code_mode: usccCodeMode.value,
          dept_code: usccDeptCode.value,
          org_type_code: usccOrgTypeCode.value,
          region_code: regionCode
        },
        responseBody: { ok: false, error: 'invalid_check_char' },
        errorMessage: 'invalid_check_char'
      })
      return
    }

    usccGeneratedCode.value = base17 + checkChar
    usccGenerateMsg.value = '已生成统一社会信用代码'
    usccGenerateMsgType.value = 'success'
    usccLegacyParsed.value = null
    writeIdToolLog({
      operation: 'uscc_generate',
      responseStatus: 200,
      requestBody: {
        code_mode: usccCodeMode.value,
        dept_code: usccDeptCode.value,
        org_type_code: usccOrgTypeCode.value,
        region_code: regionCode
      },
      responseBody: {
        ok: true,
        length: usccGeneratedCode.value.length,
        preview: maskCodePreview(usccGeneratedCode.value)
      }
    })
  } else {
    const result = generateLegacyThreeCert(regionCode)

    if (result) {
      usccGeneratedCode.value = result.businessRegNo
      usccLegacyParsed.value = {
        bizRegNo: result.businessRegNo,
        orgCode: result.orgCode,
        taxCode: result.taxNo
      }
      usccGenerateMsg.value = '已生成旧版三证号码（工商/组织机构/税务）'
      usccGenerateMsgType.value = 'success'
      writeIdToolLog({
        operation: 'uscc_generate',
        responseStatus: 200,
        requestBody: {
          code_mode: usccCodeMode.value,
          dept_code: usccDeptCode.value,
          org_type_code: usccOrgTypeCode.value,
          region_code: regionCode
        },
        responseBody: {
          ok: true,
          length: usccGeneratedCode.value.length,
          preview: maskCodePreview(usccGeneratedCode.value)
        }
      })
    } else {
      usccGenerateMsg.value = '生成失败：行政区划码无效'
      usccGenerateMsgType.value = 'error'
      writeIdToolLog({
        operation: 'uscc_generate',
        responseStatus: 400,
        requestBody: {
          code_mode: usccCodeMode.value,
          dept_code: usccDeptCode.value,
          org_type_code: usccOrgTypeCode.value,
          region_code: regionCode
        },
        responseBody: { ok: false, error: 'invalid_region_code' },
        errorMessage: 'invalid_region_code'
      })
    }
  }
}

function validateUsccCode(): void {
  const raw = usccVerifyInput.value.trim()

  if (!raw) {
    usccVerifyKey.value++
    usccVerifyMsg.value = '请输入证件号码'
    usccVerifyMsgType.value = 'error'
    usccLastVerifyResult.value = ''
    writeIdToolLog({
      operation: 'uscc_validate',
      responseStatus: 400,
      requestBody: { input_length: raw.length },
      responseBody: { ok: false, error: 'empty_input' },
      errorMessage: 'empty_input'
    })
    return
  }

  // 去掉中划线后的值
  const noDash = raw.replace(/-/g, '')

  // 统一社会信用代码：18位，字母数字混合（不含 I/O/S/V/Z）
  if (/^[0-9A-HJ-NPQRTUWXY]{18}$/i.test(noDash)) {
    const result = validateUscc18(noDash.toUpperCase(), regionCodeExists)
    applyUsccResult(raw, result.msg, result.ok ? 'success' : 'error')
    writeIdToolLog({
      operation: 'uscc_validate',
      responseStatus: result.ok ? 200 : 400,
      requestBody: { input_length: raw.length, normalized_length: noDash.length, preview: maskCodePreview(noDash) },
      responseBody: { ok: result.ok, message: result.msg },
      errorMessage: result.ok ? undefined : result.msg
    })
    return
  }

  // 组织机构代码：8位主体 + 可选中划线 + 1位校验（数字或X）
  const orgMatch = raw.match(/^([0-9A-Z]{8})-?([0-9X])$/i)
  if (orgMatch) {
    const result = validateOrgCode(orgMatch[1] + orgMatch[2])
    applyUsccResult(raw, result.msg, result.ok ? 'success' : 'error')
    writeIdToolLog({
      operation: 'uscc_validate',
      responseStatus: result.ok ? 200 : 400,
      requestBody: { input_length: raw.length, normalized_length: noDash.length, preview: maskCodePreview(noDash) },
      responseBody: { ok: result.ok, message: result.msg },
      errorMessage: result.ok ? undefined : result.msg
    })
    return
  }

  // 旧版15位号码（工商注册号 / 税务登记号）
  if (/^\d{15}$/.test(noDash)) {
    const result = validateLegacy15(noDash, regionCodeExists)
    applyUsccResult(raw, result.msg, result.ok ? 'success' : 'error')
    writeIdToolLog({
      operation: 'uscc_validate',
      responseStatus: result.ok ? 200 : 400,
      requestBody: { input_length: raw.length, normalized_length: noDash.length, preview: maskCodePreview(noDash) },
      responseBody: { ok: result.ok, message: result.msg },
      errorMessage: result.ok ? undefined : result.msg
    })
    return
  }

  const fallbackMsg =
    '无法识别的证件格式，支持：统一社会信用代码（18位）、组织机构代码（9位）、旧版15位号码'
  applyUsccResult(raw, fallbackMsg, 'error')
  writeIdToolLog({
    operation: 'uscc_validate',
    responseStatus: 400,
    requestBody: { input_length: raw.length, normalized_length: noDash.length, preview: maskCodePreview(noDash) },
    responseBody: { ok: false, message: fallbackMsg },
    errorMessage: fallbackMsg
  })
}

function applyUsccResult(input: string, msg: string, type: 'success' | 'error'): void {
  const resultKey = `${input}|${msg}|${type}`
  if (resultKey === usccLastVerifyResult.value) {
    usccVerifyMsg.value = '校验结果与上次相同'
    usccVerifyMsgType.value = 'neutral'
  } else {
    usccVerifyKey.value++
    usccVerifyMsg.value = msg
    usccVerifyMsgType.value = type
    usccLastVerifyResult.value = resultKey
  }
}

async function copyUsccCode(): Promise<void> {
  if (!usccGeneratedCode.value) return
  const success = await copyToClipboard(usccGeneratedCode.value)
  if (success) {
    usccCopyDone.value = true
    setTimeout(() => {
      usccCopyDone.value = false
    }, 2000)
  }
}

// ==================== 级联选择 ====================

watch(
  () => usccDeptCode.value,
  () => {
    const dept = deptOptions.find((d) => d.value === usccDeptCode.value)
    if (dept && dept.orgTypes.length > 0) {
      usccOrgTypeCode.value = dept.orgTypes[0].value
    }
  }
)

// ==================== 生命周期 ====================

onMounted(() => {
  const defaultDept = deptOptions.find((d) => d.value === '9')
  if (defaultDept && defaultDept.orgTypes.length > 0) {
    usccOrgTypeCode.value = defaultDept.orgTypes[0].value
  }
  loadRegionData()
})
</script>

<template>
  <div class="id-tool-page">
    <!-- 顶栏 -->
    <div class="idt-top-bar">
      <h1 class="idt-title">证件工具</h1>
      <p class="idt-subtitle">身份证 / 统一社会信用代码生成与校验</p>
    </div>

    <main class="page-content">
      <!-- 左栏：身份证号码工具 -->
      <section class="tool-card">
        <div class="card-section">
          <h2 class="section-title">生成身份证号码</h2>

          <div class="form-grid">
            <div class="form-row">
              <div class="form-field">
                <label>省份</label>
                <FormSelect
                  v-model="idProvinceCode"
                  :options="provinceFormOptions"
                  :disabled="regionLoading"
                  placeholder="请选择"
                />
              </div>
              <div class="form-field">
                <label>城市</label>
                <FormSelect
                  v-model="idCityCode"
                  :options="idCityFormOptions"
                  :disabled="regionLoading || !idProvinceCode"
                  placeholder="请选择"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>区 / 县</label>
                <FormSelect
                  v-model="idCountyCode"
                  :options="idCountyFormOptions"
                  :disabled="regionLoading || !idCityCode"
                  placeholder="请选择"
                />
              </div>
              <div class="form-field">
                <label>出生日期</label>
                <div class="date-inputs">
                  <FormSelect v-model="idBirthYear" :options="yearFormOptions" />
                  <FormSelect v-model="idBirthMonth" :options="monthFormOptions" />
                  <FormSelect v-model="idBirthDay" :options="dayFormOptions" />
                </div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-field gender-field">
                <label>性别</label>
                <div class="radio-group">
                  <label class="radio-item" :class="{ active: idGender === 'male' }">
                    <input v-model="idGender" type="radio" value="male" />
                    <span class="radio-circle"></span>
                    <span>男</span>
                  </label>
                  <label class="radio-item" :class="{ active: idGender === 'female' }">
                    <input v-model="idGender" type="radio" value="female" />
                    <span class="radio-circle"></span>
                    <span>女</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <button class="btn-generate" :disabled="regionLoading" @click="generateIdNumber">
            生成
          </button>

          <div class="result-area">
            <div class="result-box" :class="{ active: idGeneratedNumber }">
              <input type="text" :value="idGeneratedNumber" readonly class="result-input" />
              <button
                class="btn-copy"
                :disabled="!idGeneratedNumber"
                aria-label="复制"
                @click="copyIdNumber"
              >
                <svg v-if="!idCopyDone" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="8"
                    y="8"
                    width="12"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <path
                    d="M16 8V6C16 4.89543 15.1046 4 14 4H6C4.89543 4 4 4.89543 4 6V14C4 15.1046 4.89543 16 6 16H8"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13L9 17L19 7"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <Transition name="toast-fade" mode="out-in">
              <div
                v-if="idGenerateMsg"
                :key="'id-gen-' + idVerifyKey"
                class="toast"
                :class="idGenerateMsgType"
              >
                {{ idGenerateMsg }}
              </div>
            </Transition>
          </div>
        </div>

        <div class="card-section">
          <h3 class="section-subtitle">校验身份证号码</h3>

          <div class="verify-form">
            <input v-model="idVerifyInput" type="text" maxlength="18" class="verify-input" />
            <button class="btn-verify" @click="validateIdNumber">校验</button>
            <Transition name="toast-fade" mode="out-in">
              <div
                v-if="idVerifyMsg"
                :key="'id-v-' + idVerifyKey"
                class="toast"
                :class="idVerifyMsgType"
              >
                {{ idVerifyMsg }}
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- 右栏：统一社会信用代码工具 -->
      <section class="tool-card">
        <div class="card-section">
          <h2 class="section-title">生成统一社会信用代码</h2>

          <div class="form-grid">
            <div class="form-row full-width">
              <div class="form-field">
                <label>证件体系</label>
                <FormSelect v-model="usccCodeMode" :options="codeModeOptions" />
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>登记管理部门</label>
                <FormSelect
                  v-model="usccDeptCode"
                  :options="deptFormOptions"
                  :disabled="regionLoading"
                  placeholder="请选择"
                />
              </div>
              <div class="form-field">
                <label>机构类别代码</label>
                <FormSelect
                  v-model="usccOrgTypeCode"
                  :options="orgTypeFormOptions"
                  :disabled="regionLoading"
                  placeholder="请选择"
                />
              </div>
            </div>

            <div class="form-row">
              <div class="form-field">
                <label>省份</label>
                <FormSelect
                  v-model="usccProvinceCode"
                  :options="provinceFormOptions"
                  :disabled="regionLoading"
                  placeholder="请选择"
                />
              </div>
              <div class="form-field">
                <label>城市</label>
                <FormSelect
                  v-model="usccCityCode"
                  :options="usccCityFormOptions"
                  :disabled="regionLoading || !usccProvinceCode"
                  placeholder="请选择"
                />
              </div>
            </div>

            <div class="form-row full-width">
              <div class="form-field">
                <label>区 / 县</label>
                <FormSelect
                  v-model="usccCountyCode"
                  :options="usccCountyFormOptions"
                  :disabled="regionLoading || !usccCityCode"
                  placeholder="请选择"
                />
              </div>
            </div>
          </div>

          <button class="btn-generate" :disabled="regionLoading" @click="generateUsccCode">
            生成
          </button>

          <div class="result-area">
            <div class="result-box" :class="{ active: usccGeneratedCode }">
              <input type="text" :value="usccGeneratedCode" readonly class="result-input" />
              <button
                class="btn-copy"
                :disabled="!usccGeneratedCode"
                aria-label="复制"
                @click="copyUsccCode"
              >
                <svg v-if="!usccCopyDone" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect
                    x="8"
                    y="8"
                    width="12"
                    height="12"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="2"
                  />
                  <path
                    d="M16 8V6C16 4.89543 15.1046 4 14 4H6C4.89543 4 4 4.89543 4 6V14C4 15.1046 4.89543 16 6 16H8"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M5 13L9 17L19 7"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>

            <Transition name="toast-fade" mode="out-in">
              <div v-if="usccLegacyParsed" class="detail-panel">
                <div class="detail-item">
                  <span class="detail-label">工商注册号：</span>
                  <span class="detail-value">{{ usccLegacyParsed.bizRegNo }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">组织机构代码：</span>
                  <span class="detail-value">{{ usccLegacyParsed.orgCode }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">税务登记号：</span>
                  <span class="detail-value">{{ usccLegacyParsed.taxCode }}</span>
                </div>
              </div>
            </Transition>

            <Transition name="toast-fade" mode="out-in">
              <div
                v-if="usccGenerateMsg"
                :key="'uscc-gen-' + usccVerifyKey"
                class="toast"
                :class="usccGenerateMsgType"
              >
                {{ usccGenerateMsg }}
              </div>
            </Transition>
          </div>
        </div>

        <div class="card-section">
          <h3 class="section-subtitle">校验统一社会信用代码</h3>

          <div class="verify-form">
            <input v-model="usccVerifyInput" type="text" class="verify-input" />
            <button class="btn-verify" @click="validateUsccCode">校验</button>
            <Transition name="toast-fade" mode="out-in">
              <div
                v-if="usccVerifyMsg"
                :key="'uscc-v-' + usccVerifyKey"
                class="toast"
                :class="usccVerifyMsgType"
              >
                {{ usccVerifyMsg }}
              </div>
            </Transition>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
/* ==================== 页面布局 ==================== */
.id-tool-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-page-bg);
  color: var(--color-page-text);
}

/* 顶栏 */
.idt-top-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  height: calc(var(--header-height) + 12px);
  padding: 0 24px;
  flex-shrink: 0;
  background: var(--color-page-panel);
}

.idt-title {
  font-size: var(--text-lg);
  font-weight: 700;
  line-height: 1;
  color: var(--color-page-text);
  letter-spacing: var(--tracking-tight);
  margin: 0;
}

.idt-subtitle {
  font-size: var(--text-xs);
  color: var(--color-page-text-muted);
  margin: 0;
  line-height: 1;
}

.page-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 24px 12px 12px;
  overflow-y: auto;
  min-height: 0;
}

/* ==================== 工具卡片 ==================== */
.tool-card {
  display: flex;
  flex-direction: column;
  background: var(--color-page-panel);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-section {
  padding: 18px;
}

.card-section:not(:last-child) {
  border-bottom: 1px solid var(--color-page-border-subtle);
}

.section-title {
  margin: 0 0 14px;
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-page-text);
}

.section-subtitle {
  margin: 0 0 10px;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--color-page-text);
}

/* ==================== 表单 ==================== */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.form-row.full-width {
  grid-template-columns: 1fr;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-field label {
  font-size: var(--text-sm);
  color: var(--color-page-text-subtle);
}

/* 日期输入组 */
.date-inputs {
  display: flex;
  gap: 4px;
}

.date-inputs > * {
  flex: 1;
  min-width: 0;
}

/* 性别单选 */
.gender-field {
  grid-column: 1 / -1;
}

.radio-group {
  display: flex;
  gap: 8px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-page-text-subtle);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.radio-item input {
  display: none;
}

.radio-item .radio-circle {
  width: 16px;
  height: 16px;
  border: 2px solid var(--color-page-border-subtle);
  border-radius: 50%;
  transition: all var(--duration-fast);
}

.radio-item.active {
  border-color: var(--color-page-brand);
  background: var(--color-page-brand-bg);
  color: var(--color-page-brand);
}

.radio-item.active .radio-circle {
  border-color: var(--color-page-brand);
  background: var(--color-page-brand);
  box-shadow: inset 0 0 0 3px var(--color-page-panel);
}

/* ==================== 按钮 ==================== */
.btn-generate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 24px;
  margin-top: 12px;
  background: var(--color-page-brand);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-btn-primary-text);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast);
}

.btn-generate:hover:not(:disabled) {
  background: var(--color-page-brand-hover);
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== 结果展示 ==================== */
.result-area {
  margin-top: 10px;
}

.result-box {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-sm);
}

.result-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-page-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  outline: none;
  padding: 4px 0;
}

.btn-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-page-text-subtle);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.btn-copy:hover:not(:disabled) {
  background: var(--color-page-elevated);
  border-color: var(--color-page-border-hover);
  color: var(--color-page-text);
}

.btn-copy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 详细解析区块 */
.detail-panel {
  margin-top: 8px;
  padding: 10px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-sm);
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: var(--text-sm);
}

.detail-item:not(:last-child) {
  border-bottom: 1px solid var(--color-page-border-subtle);
  padding-bottom: 6px;
  margin-bottom: 4px;
}

.detail-label {
  color: var(--color-page-brand);
  font-weight: 600;
  white-space: nowrap;
}

.detail-value {
  color: var(--color-page-text);
  font-family: var(--font-body);
}

/* ==================== 提示条 ==================== */
.toast {
  margin-top: 8px;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}

.toast.success {
  background: var(--color-page-success-bg);
  color: var(--color-page-success);
}

.toast.error {
  background: var(--color-page-danger-bg);
  color: var(--color-page-danger);
}

.toast.neutral {
  background: var(--color-page-input);
  color: var(--color-page-text-subtle);
}

/* ==================== 校验区块 ==================== */
.verify-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.verify-input {
  padding: 6px 10px;
  background: var(--color-page-input);
  border: 1px solid var(--color-page-border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-page-text);
  font-family: var(--font-body);
  font-size: var(--text-base);
  outline: none;
}

.btn-verify {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  padding: 6px 24px;
  background: var(--color-page-brand);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-btn-primary-text);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--duration-fast);
}

.btn-verify:hover {
  background: var(--color-page-brand-hover);
}

/* ==================== 过渡动画 ==================== */
.toast-fade-enter-active {
  transition: all 0.2s ease-out;
}

.toast-fade-leave-active {
  transition: all 0.15s ease-in;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ==================== 焦点与滚动条 ==================== */
.verify-input:focus-visible,
.result-input:focus-visible {
  box-shadow: none;
}

/* ==================== 响应式 ==================== */
@media (max-width: 900px) {
  .page-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .form-row {
    grid-template-columns: 1fr;
  }

  .page-content {
    padding: 6px 8px 8px;
    gap: 8px;
  }
}
</style>
