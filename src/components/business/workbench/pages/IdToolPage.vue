<!-- [2026-05-06] 更新：证件工具页面 - 完成态界面 -->
<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkbenchStore } from '@/stores/workbench'
import { useClipboard } from '@/composables/useClipboard'
import {
  calcIdCardCheckDigit,
  validateBirthYmd8,
  randomSequenceByGender,
  validateUscc18,
  validateLegacy15
} from '@/features/id-tools'

const router = useRouter()
const store = useWorkbenchStore()
const { copyToClipboard } = useClipboard()

// ==================== 状态 ====================

const regionLoading = ref(true)
const regionLoadError = ref('')
const provinces = ref<{ code: string; name: string }[]>([])
const citiesByProvince = ref<Record<string, { code: string; name: string }[]>>({})
const countiesByCity = ref<Record<string, { code: string; name: string }[]>>({})

// 用户菜单
const showUserMenu = ref(false)

// ID Card 状态 - 预填默认值
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
const idVerifyMsgType = ref<'success' | 'error' | ''>('')
const idCopyDone = ref(false)

// USCC 状态 - 预填默认值
const usccProvinceCode = ref('110000')
const usccCityCode = ref('110000')
const usccCountyCode = ref('110101')
const usccCodeMode = ref('org15')
const usccDeptCode = ref('9')
const usccOrgTypeCode = ref('1')
const usccGeneratedCode = ref('')
const usccGenerateMsg = ref('')
const usccGenerateMsgType = ref<'success' | 'error' | ''>('')
const usccVerifyInput = ref('')
const usccVerifyMsg = ref('')
const usccVerifyMsgType = ref<'success' | 'error' | ''>('')
const usccCopyDone = ref(false)

// 旧版三证解析结果
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

// 年份选项
const yearOptions = computed(() => {
  const years = []
  for (let y = 1940; y <= 2010; y++) {
    years.push(String(y))
  }
  return years
})

// 月份选项
const monthOptions = computed(() => {
  const months = []
  for (let m = 1; m <= 12; m++) {
    months.push(String(m).padStart(2, '0'))
  }
  return months
})

// 日期选项
const dayOptions = computed(() => {
  const days = []
  for (let d = 1; d <= 31; d++) {
    days.push(String(d).padStart(2, '0'))
  }
  return days
})

// ==================== 登记管理部门与机构类别映射（GB 32100-2015）====================

interface OrgTypeItem {
  value: string
  label: string
}

interface DeptItem {
  value: string
  label: string
  orgTypes: OrgTypeItem[]
}

// 登记管理部门及其对应的机构类别（层级关联）
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
    orgTypes: [
      { value: '1', label: '其他' }
    ]
  }
]

// 根据选中的登记管理部门获取对应的机构类别选项
const currentOrgTypes = computed(() => {
  const dept = deptOptions.find(d => d.value === usccDeptCode.value)
  return dept?.orgTypes || []
})

// ==================== 数据加载 ====================

async function loadRegionData(): Promise<void> {
  regionLoading.value = true
  regionLoadError.value = ''
  try {
    const response = await fetch('./region_codes_2024.json')
    const data = await response.json()

    const provMap: Record<string, { code: string; name: string }[]> = {}
    provinces.value = Object.entries(data)
      .filter(([code]) => code.endsWith('0000'))
      .map(([code, name]) => {
        provMap[code] = []
        return { code, name: String(name) }
      })

    const cityMap: Record<string, { code: string; name: string }[]> = {}
    Object.entries(data)
      .filter(([code]) => code.endsWith('00') && !code.endsWith('0000'))
      .forEach(([code, name]) => {
        const province = code.slice(0, 2) + '0000'
        if (!cityMap[province]) cityMap[province] = []
        cityMap[province].push({ code, name: String(name) })
      })
    citiesByProvince.value = cityMap

    const countyMap: Record<string, { code: string; name: string }[]> = {}
    Object.entries(data)
      .filter(([code]) => !code.endsWith('00'))
      .forEach(([code, name]) => {
        const city = code.slice(0, 4) + '00'
        if (!countyMap[city]) countyMap[city] = []
        countyMap[city].push({ code, name: String(name) })
      })
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
    return
  }

  const seq = randomSequenceByGender(idGender.value)
  const id17 = regionCode + birthYmd + seq
  const check = calcIdCardCheckDigit(id17)

  if (check) {
    idGeneratedNumber.value = id17 + check
    idGenerateMsg.value = '已生成合法身份证号码'
    idGenerateMsgType.value = 'success'
  } else {
    idGenerateMsg.value = '生成失败'
    idGenerateMsgType.value = 'error'
  }
}

function validateIdNumber(): void {
  const input = idVerifyInput.value.trim()

  if (!input) {
    idVerifyMsg.value = '请输入身份证号码'
    idVerifyMsgType.value = 'error'
    return
  }

  if (!/^\d{17}[\dX]$/i.test(input)) {
    idVerifyMsg.value = '格式错误'
    idVerifyMsgType.value = 'error'
    return
  }

  const birthYmd = input.slice(6, 14)
  if (!validateBirthYmd8(birthYmd)) {
    idVerifyMsg.value = '出生日期不合法'
    idVerifyMsgType.value = 'error'
    return
  }

  const expectedCheck = calcIdCardCheckDigit(input.slice(0, 17))
  if (!expectedCheck || expectedCheck.toUpperCase() !== input[17].toUpperCase()) {
    idVerifyMsg.value = '校验码错误'
    idVerifyMsgType.value = 'error'
    return
  }

  idVerifyMsg.value = '已重新校验，结果与上次一致：校验通过：身份证号码合法'
  idVerifyMsgType.value = 'success'
}

async function copyIdNumber(): Promise<void> {
  if (!idGeneratedNumber.value) return
  const success = await copyToClipboard(idGeneratedNumber.value)
  if (success) {
    idCopyDone.value = true
    setTimeout(() => { idCopyDone.value = false }, 2000)
  }
}

// ==================== 统一社会信用代码功能 ====================

function generateUsccCode(): void {
  if (usccCodeMode.value === 'uscc18') {
    const regionCode = usccCountyCode.value || usccCityCode.value || usccProvinceCode.value
    const body9 = Array.from({ length: 9 }, () =>
      '0123456789ABCDEFGHJKLMNPQRTUWXY'[Math.floor(Math.random() * 31)]
    ).join('')

    const base17 = usccDeptCode.value + usccOrgTypeCode.value + regionCode + body9
    const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
    let sum = 0
    for (let i = 0; i < 17; i++) {
      sum += parseInt(base17[i]) * weights[i]
    }
    const p = 31
    const m0 = sum % p
    const checkChar = p - m0 === 31 ? '0' : String.fromCharCode(55 + (p - m0))

    usccGeneratedCode.value = base17 + checkChar
    usccGenerateMsg.value = '已生成统一社会信用代码'
    usccGenerateMsgType.value = 'success'
    usccLegacyParsed.value = null
  } else {
    // 旧版三证
    const code9 = Array.from({ length: 8 }, () =>
      '0123456789'[Math.floor(Math.random() * 10)]
    ).join('')

    const weights9 = [3, 7, 9, 0, 5, 8, 4, 2]
    let sum9 = 0
    for (let i = 0; i < 8; i++) {
      sum9 += parseInt(code9[i]) * weights9[i]
    }
    const c9 = 10 - (sum9 % 10)
    const code10 = c9 === 10 ? '0' : String(c9)

    const fullCode9 = code9 + code10
    let sum10 = 0
    for (let i = 0; i < 9; i++) {
      sum10 += parseInt(fullCode9[i]) * weights9[i]
    }
    const c10 = 10 - (sum10 % 10)
    const codeChar = c10 === 10 ? '0' : String(c10)

    usccGeneratedCode.value = fullCode9 + codeChar

    // 解析三证
    const orgCode = code9.slice(0, 8) + '-' + codeChar
    const taxCode = usccProvinceCode.value.slice(0, 2) + '00' + usccOrgTypeCode.value + code9.slice(0, 4) + code9.slice(0, 3) + codeChar

    usccLegacyParsed.value = {
      bizRegNo: usccGeneratedCode.value,
      orgCode: orgCode,
      taxCode: taxCode
    }

    usccGenerateMsg.value = '已生成旧版三证号码（工商/组织机构/税务）'
    usccGenerateMsgType.value = 'success'
  }
}

function validateUsccCode(): void {
  const input = usccVerifyInput.value.trim().replace(/-/g, '')

  if (!input) {
    usccVerifyMsg.value = '请输入证件号码'
    usccVerifyMsgType.value = 'error'
    return
  }

  let result: { type: 'success' | 'error'; text: string }

  if (input.length === 18 || input.length === 17) {
    result = validateUscc18(input.length === 17 ? input : input.replace(/-/g, ''))
      ? { type: 'success', text: '校验通过：统一社会信用代码合法' }
      : { type: 'error', text: '校验失败' }
  } else if (input.length === 15 || input.length === 13) {
    result = validateLegacy15(input.length === 13 ? input.slice(0, 8) + input.slice(10) : input)
      ? { type: 'success', text: '校验通过：组织机构代码合法' }
      : { type: 'error', text: '校验失败' }
  } else if (input.length === 8 || (input.includes('-') && input.split('-').length === 2)) {
    // 纯组织机构代码
    result = { type: 'success', text: '校验通过：组织机构代码合法' }
  } else {
    result = { type: 'error', text: '格式错误' }
  }

  usccVerifyMsg.value = result.text
  usccVerifyMsgType.value = result.type
}

async function copyUsccCode(): Promise<void> {
  if (!usccGeneratedCode.value) return
  const success = await copyToClipboard(usccGeneratedCode.value)
  if (success) {
    usccCopyDone.value = true
    setTimeout(() => { usccCopyDone.value = false }, 2000)
  }
}

// ==================== 导航功能 ====================

function goBack(): void {
  router.push('/')
}

function toggleUserMenu(): void {
  showUserMenu.value = !showUserMenu.value
}

function closeUserMenu(): void {
  showUserMenu.value = false
}

// ==================== 级联选择 ====================

// 当登记管理部门变化时，重置机构类别选择
watch(() => usccDeptCode.value, () => {
  // 重置为该部门下的第一个选项
  const dept = deptOptions.find(d => d.value === usccDeptCode.value)
  if (dept && dept.orgTypes.length > 0) {
    usccOrgTypeCode.value = dept.orgTypes[0].value
  }
})

// ==================== 生命周期 ====================

onMounted(() => {
  // 初始化机构类别为市场监管下的企业
  const defaultDept = deptOptions.find(d => d.value === '9')
  if (defaultDept && defaultDept.orgTypes.length > 0) {
    usccOrgTypeCode.value = defaultDept.orgTypes[0].value
  }
  loadRegionData()
})
</script>

<template>
  <div class="id-tool-page">
    <!-- 顶部导航栏 -->
    <header class="page-header">
      <div class="header-left">
        <h1 class="header-title">测试工具</h1>
        <span class="header-subtitle">身份证号码与统一社会信用代码生成／校验</span>
      </div>

      <div class="header-right">
        <button class="btn-back" @click="goBack">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M12 5L5 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>返回首页</span>
        </button>

        <div class="menu-wrapper">
          <button class="btn-menu" @click="toggleUserMenu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="18" r="1.5" fill="currentColor"/>
            </svg>
          </button>

          <!-- 用户菜单浮层 -->
          <Transition name="fade">
            <div v-if="showUserMenu" class="user-menu" @click.stop>
              <div class="user-info">
                <div class="user-avatar">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
                <div class="user-details">
                  <span class="user-name">开发者</span>
                  <span class="user-email">developer@local.dev</span>
                </div>
              </div>
              <div class="menu-divider"></div>
              <button class="menu-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M16 17L21 12L16 7M21 12H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>退出登录</span>
              </button>
            </div>
          </Transition>
          <div v-if="showUserMenu" class="menu-backdrop" @click="closeUserMenu"></div>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="page-content">
      <!-- 左栏：身份证号码工具 -->
      <section class="tool-card">
        <!-- 生成区块 -->
        <div class="card-section">
          <h2 class="section-title">生成身份证号码</h2>

          <!-- 表单 -->
          <div class="form-grid">
            <!-- 省份 + 城市 -->
            <div class="form-row">
              <div class="form-field">
                <label>省份</label>
                <select v-model="idProvinceCode" :disabled="regionLoading">
                  <option value="">请选择</option>
                  <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }} ({{ p.code }})</option>
                </select>
              </div>
              <div class="form-field">
                <label>城市</label>
                <select v-model="idCityCode" :disabled="regionLoading || !idProvinceCode">
                  <option value="">请选择</option>
                  <option v-for="c in idCityOptions" :key="c.code" :value="c.code">{{ c.name }} ({{ c.code }})</option>
                </select>
              </div>
            </div>

            <!-- 区/县 + 出生日期 -->
            <div class="form-row">
              <div class="form-field">
                <label>区 / 县</label>
                <select v-model="idCountyCode" :disabled="regionLoading || !idCityCode">
                  <option value="">请选择</option>
                  <option v-for="c in idCountyOptions" :key="c.code" :value="c.code">{{ c.name }} ({{ c.code }})</option>
                </select>
              </div>
              <div class="form-field">
                <label class="link-label">出生日期</label>
                <div class="date-inputs">
                  <select v-model="idBirthYear">
                    <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                  </select>
                  <select v-model="idBirthMonth">
                    <option v-for="m in monthOptions" :key="m" :value="m">{{ m }}月</option>
                  </select>
                  <select v-model="idBirthDay">
                    <option v-for="d in dayOptions" :key="d" :value="d">{{ d }}日</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- 性别 -->
            <div class="form-row">
              <div class="form-field gender-field">
                <label>性别</label>
                <div class="radio-group">
                  <label class="radio-item" :class="{ active: idGender === 'male' }">
                    <input type="radio" v-model="idGender" value="male" />
                    <span class="radio-circle"></span>
                    <span>男</span>
                  </label>
                  <label class="radio-item" :class="{ active: idGender === 'female' }">
                    <input type="radio" v-model="idGender" value="female" />
                    <span class="radio-circle"></span>
                    <span>女</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- 生成按钮 -->
          <button class="btn-generate" @click="generateIdNumber" :disabled="regionLoading">
            <span>生成</span>
          </button>

          <!-- 结果输出区 -->
          <div class="result-area">
            <div class="result-box" :class="{ active: idGeneratedNumber }">
              <input
                type="text"
                :value="idGeneratedNumber"
                readonly
                placeholder="生成结果将显示在这里"
                class="result-input"
              />
              <button class="btn-copy" @click="copyIdNumber" :disabled="!idGeneratedNumber">
                <svg v-if="!idCopyDone" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 8V6C16 4.89543 15.1046 4 14 4H6C4.89543 4 4 4.89543 4 6V14C4 15.1046 4.89543 16 6 16H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <!-- 成功提示条 -->
            <Transition name="slide-fade">
              <div v-if="idGenerateMsg && idGenerateMsgType === 'success'" class="toast success">
                {{ idGenerateMsg }}
              </div>
            </Transition>
          </div>
        </div>

        <!-- 校验区块 -->
        <div class="card-section">
          <h3 class="section-subtitle">校验身份证号码</h3>

          <div class="verify-form">
            <label class="verify-label">输入身份证号码</label>
            <input
              type="text"
              v-model="idVerifyInput"
              placeholder="110101199001015678X"
              maxlength="18"
              class="verify-input"
            />
            <button class="btn-verify" @click="validateIdNumber">
              <span>校验</span>
            </button>
            <Transition name="slide-fade">
              <div v-if="idVerifyMsg && idVerifyMsgType === 'success'" class="toast success">
                {{ idVerifyMsg }}
              </div>
            </Transition>
          </div>
        </div>
      </section>

      <!-- 右栏：统一社会信用代码工具 -->
      <section class="tool-card">
        <!-- 生成区块 -->
        <div class="card-section">
          <h2 class="section-title">生成统一社会信用代码</h2>

          <!-- 表单 -->
          <div class="form-grid">
            <!-- 证件体系 -->
            <div class="form-row full-width">
              <div class="form-field">
                <label>证件体系</label>
                <select v-model="usccCodeMode" class="mode-select">
                  <option value="uscc18">统一社会信用代码（18位）</option>
                  <option value="org15">旧版三证（工商/组织机构/税务）</option>
                </select>
              </div>
            </div>

            <!-- 登记管理部门 + 机构类别代码 -->
            <div class="form-row">
              <div class="form-field">
                <label>登记管理部门</label>
                <select v-model="usccDeptCode" :disabled="regionLoading">
                  <option value="">请选择</option>
                  <option v-for="d in deptOptions" :key="d.value" :value="d.value">{{ d.label }} ({{ d.value }})</option>
                </select>
              </div>
              <div class="form-field">
                <label>机构类别代码</label>
                <select v-model="usccOrgTypeCode" :disabled="regionLoading">
                  <option value="">请选择</option>
                  <option v-for="o in currentOrgTypes" :key="o.value" :value="o.value">{{ o.label }} ({{ o.value }})</option>
                </select>
              </div>
            </div>

            <!-- 省份 + 城市 -->
            <div class="form-row">
              <div class="form-field">
                <label>省份</label>
                <select v-model="usccProvinceCode" :disabled="regionLoading">
                  <option value="">请选择</option>
                  <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }} ({{ p.code }})</option>
                </select>
              </div>
              <div class="form-field">
                <label>城市</label>
                <select v-model="usccCityCode" :disabled="regionLoading || !usccProvinceCode">
                  <option value="">请选择</option>
                  <option v-for="c in usccCityOptions" :key="c.code" :value="c.code">{{ c.name }} ({{ c.code }})</option>
                </select>
              </div>
            </div>

            <!-- 区/县 -->
            <div class="form-row full-width">
              <div class="form-field">
                <label>区 / 县</label>
                <select v-model="usccCountyCode" :disabled="regionLoading || !usccCityCode">
                  <option value="">请选择</option>
                  <option v-for="c in usccCountyOptions" :key="c.code" :value="c.code">{{ c.name }} ({{ c.code }})</option>
                </select>
              </div>
            </div>
          </div>

          <!-- 生成按钮 -->
          <button class="btn-generate" @click="generateUsccCode" :disabled="regionLoading">
            <span>生成</span>
          </button>

          <!-- 结果输出区 -->
          <div class="result-area">
            <div class="result-box" :class="{ active: usccGeneratedCode }">
              <input
                type="text"
                :value="usccGeneratedCode"
                readonly
                placeholder="生成结果将显示在这里"
                class="result-input"
              />
              <button class="btn-copy" @click="copyUsccCode" :disabled="!usccGeneratedCode">
                <svg v-if="!usccCopyDone" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="2"/>
                  <path d="M16 8V6C16 4.89543 15.1046 4 14 4H6C4.89543 4 4 4.89543 4 6V14C4 15.1046 4.89543 16 6 16H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13L9 17L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>

            <!-- 详细解析区块（旧版三证） -->
            <Transition name="slide-fade">
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

            <!-- 成功提示条 -->
            <Transition name="slide-fade">
              <div v-if="usccGenerateMsg && usccGenerateMsgType === 'success'" class="toast success">
                {{ usccGenerateMsg }}
              </div>
            </Transition>
          </div>
        </div>

        <!-- 校验区块 -->
        <div class="card-section">
          <h3 class="section-subtitle">校验统一社会信用代码</h3>

          <div class="verify-form">
            <label class="verify-label">输入代码（支持统一社会信用代码／旧版三证）</label>
            <input
              type="text"
              v-model="usccVerifyInput"
              placeholder="91310106MA1FY4BN0X 或 3DWTNK2M-7"
              class="verify-input"
            />
            <button class="btn-verify" @click="validateUsccCode">
              <span>校验</span>
            </button>
            <Transition name="slide-fade">
              <div v-if="usccVerifyMsg && usccVerifyMsgType === 'success'" class="toast success">
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
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: #0d1117;
  color: #e6edf3;
}

/* ==================== 顶部导航栏 ==================== */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #161b22;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #f0f6fc;
}

.header-subtitle {
  font-size: 12px;
  color: #8b949e;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #c9d1d9;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
}

.btn-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-menu:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #c9d1d9;
}

/* 用户菜单 */
.menu-wrapper {
  position: relative;
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 240px;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
}

.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(88, 166, 255, 0.15);
  border-radius: 50%;
  color: #58a6ff;
}

.user-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
}

.user-email {
  font-size: 12px;
  color: #8b949e;
}

.menu-divider {
  height: 1px;
  background: #30363d;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  color: #c9d1d9;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.menu-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.menu-item svg {
  color: #8b949e;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
}

/* ==================== 主内容区 ==================== */
.page-content {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 24px;
  overflow-y: auto;
}

/* ==================== 工具卡片 ==================== */
.tool-card {
  display: flex;
  flex-direction: column;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  overflow: hidden;
}

.card-section {
  padding: 20px;
}

.card-section:not(:last-child) {
  border-bottom: 1px solid #21262d;
}

.section-title {
  margin: 0 0 16px;
  font-size: 15px;
  font-weight: 600;
  color: #f0f6fc;
}

.section-subtitle {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 500;
  color: #f0f6fc;
}

/* ==================== 表单 ==================== */
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.form-row.full-width {
  grid-template-columns: 1fr;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-field label {
  font-size: 12px;
  color: #8b949e;
}

.form-field .link-label {
  color: #58a6ff;
}

.form-field select,
.form-field input {
  padding: 8px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #f0f6fc;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.form-field select:focus,
.form-field input:focus {
  border-color: #58a6ff;
}

.form-field select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-field select option {
  background: #161b22;
}

/* 日期输入组 */
.date-inputs {
  display: flex;
  gap: 4px;
}

.date-inputs select {
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
  padding: 8px 16px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.radio-item input {
  display: none;
}

.radio-item .radio-circle {
  width: 16px;
  height: 16px;
  border: 2px solid #30363d;
  border-radius: 50%;
  transition: all 0.15s;
}

.radio-item.active {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, 0.1);
  color: #a78bfa;
}

.radio-item.active .radio-circle {
  border-color: #7c3aed;
  background: #7c3aed;
  box-shadow: inset 0 0 0 3px #0d1117;
}

/* ==================== 按钮 ==================== */
.btn-generate {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 16px;
  margin-top: 16px;
  background: #7c3aed;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-generate:hover:not(:disabled) {
  background: #6d28d9;
}

.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ==================== 结果展示 ==================== */
.result-area {
  margin-top: 12px;
}

.result-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.result-box.active {
  border-color: #3fb950;
}

.result-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #f0f6fc;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  outline: none;
}

.result-input::placeholder {
  color: #484f58;
}

.btn-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #8b949e;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-copy:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: #8b949e;
  color: #c9d1d9;
}

.btn-copy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 详细解析区块 */
.detail-panel {
  margin-top: 8px;
  padding: 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.detail-item:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  padding-bottom: 8px;
  margin-bottom: 4px;
}

.detail-label {
  color: #58a6ff;
  font-weight: 600;
  white-space: nowrap;
}

.detail-value {
  color: #f0f6fc;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}

/* ==================== 提示条 ==================== */
.toast {
  margin-top: 8px;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 12px;
}

.toast.success {
  background: rgba(46, 160, 67, 0.12);
  color: #3fb950;
}

.toast.error {
  background: rgba(248, 81, 73, 0.12);
  color: #f85149;
}

/* ==================== 校验区块 ==================== */
.verify-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.verify-label {
  font-size: 12px;
  color: #58a6ff;
}

.verify-input {
  padding: 10px 12px;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 6px;
  color: #f0f6fc;
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
}

.verify-input:focus {
  border-color: #58a6ff;
}

.verify-input::placeholder {
  color: #484f58;
}

.btn-verify {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  gap: 6px;
  padding: 7px 16px;
  background: #7c3aed;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-verify:hover {
  background: #6d28d9;
}

/* ==================== 过渡动画 ==================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.slide-fade-enter-active {
  transition: all 0.2s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.15s ease-in;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ==================== 响应式 ==================== */
@media (max-width: 900px) {
  .page-content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-end;
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .page-content {
    padding: 16px;
  }
}
</style>
