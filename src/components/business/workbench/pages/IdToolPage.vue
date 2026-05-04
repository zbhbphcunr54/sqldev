<!-- [2026-05-03] 新增：证件工具页面 -->
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWorkbenchStore } from '@/stores/workbench'
import { useClipboard } from '@/composables/useClipboard'
import {
  calcIdCardCheckDigit,
  parseYmdFromIsoDate,
  validateBirthYmd8,
  randomSequenceByGender,
  generateLegacyThreeCert,
  validateUscc18,
  validateOrgCode,
  validateLegacy15
} from '@/features/id-tools'

const store = useWorkbenchStore()
const { copyToClipboard } = useClipboard()

// Region data
const regionLoading = ref(true)
const regionLoadError = ref('')
const provinces = ref<{ code: string; name: string }[]>([])
const citiesByProvince = ref<Record<string, { code: string; name: string }[]>>({})
const countiesByCity = ref<Record<string, { code: string; name: string }[]>>({})

// ID Card state
const idProvinceCode = ref('')
const idCityCode = ref('')
const idCountyCode = ref('')
const idBirthYear = ref('1990')
const idBirthMonth = ref('01')
const idBirthDay = ref('01')
const idGender = ref('male')
const idGeneratedNumber = ref('')
const idGenerateResult = ref<{ type: string; text: string }>({ type: 'info', text: '' })
const idVerifyInput = ref('')
const idVerifyResult = ref<{ type: string; text: string }>({ type: 'info', text: '' })
const idCopyDone = ref(false)

// USCC state
const usccProvinceCode = ref('')
const usccCityCode = ref('')
const usccCountyCode = ref('')
const usccCodeMode = ref('uscc18')
const usccDeptCode = ref('9')
const usccOrgTypeCode = ref('1')
const usccGeneratedCode = ref('')
const usccGenerateResult = ref<{ type: string; text: string }>({ type: 'info', text: '' })
const usccVerifyInput = ref('')
const usccVerifyResult = ref<{ type: string; text: string }>({ type: 'info', text: '' })
const usccCopyDone = ref(false)

// Computed
const idCityOptions = computed(() => citiesByProvince.value[idProvinceCode.value] || [])
const idCountyOptions = computed(() => countiesByCity.value[idCityCode.value] || [])

const usccCityOptions = computed(() => citiesByProvince.value[usccProvinceCode.value] || [])
const usccCountyOptions = computed(() => countiesByCity.value[usccCityCode.value] || [])

const genderOptions = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' }
]

const usccModeOptions = [
  { value: 'uscc18', label: '统一社会信用代码' },
  { value: 'org15', label: '旧版组织机构代码' }
]

// Load region data
async function loadRegionData(): Promise<void> {
  regionLoading.value = true
  regionLoadError.value = ''
  try {
    const response = await fetch('./region_codes_2024.json')
    const data = await response.json()

    // Parse provinces
    const provMap: Record<string, { code: string; name: string }[]> = {}
    provinces.value = Object.entries(data)
      .filter(([code]) => code.endsWith('0000'))
      .map(([code, name]) => {
        provMap[code] = []
        return { code, name: String(name) }
      })

    // Parse cities
    const cityMap: Record<string, { code: string; name: string }[]> = {}
    Object.entries(data)
      .filter(([code]) => code.endsWith('00') && !code.endsWith('0000'))
      .forEach(([code, name]) => {
        const province = code.slice(0, 2) + '0000'
        if (!cityMap[province]) cityMap[province] = []
        cityMap[province].push({ code, name: String(name) })
      })
    citiesByProvince.value = cityMap

    // Parse counties
    const countyMap: Record<string, { code: string; name: string }[]> = {}
    Object.entries(data)
      .filter(([code]) => !code.endsWith('00'))
      .forEach(([code, name]) => {
        const city = code.slice(0, 4) + '00'
        if (!countyMap[city]) countyMap[city] = []
        countyMap[city].push({ code, name: String(name) })
      })
    countiesByCity.value = countyMap
  } catch (err) {
    regionLoadError.value = '行政区划数据加载失败'
    console.error('[IdToolPage] region data load failed:', err)
  } finally {
    regionLoading.value = false
  }
}

// ID Card functions
function generateIdNumber(): void {
  if (regionLoading.value) {
    idGenerateResult.value = { type: 'error', text: '行政区划数据加载中...' }
    return
  }

  if (!idProvinceCode.value) {
    idGenerateResult.value = { type: 'error', text: '请选择省份' }
    return
  }

  const regionCode = idCountyCode.value || idCityCode.value || idProvinceCode.value
  const birthYmd = `${idBirthYear.value}${idBirthMonth.value}${idBirthDay.value}`

  if (!validateBirthYmd8(birthYmd)) {
    idGenerateResult.value = { type: 'error', text: '出生日期不合法' }
    return
  }

  const seq = randomSequenceByGender(idGender.value)
  const id17 = regionCode + birthYmd + seq
  const check = calcIdCardCheckDigit(id17)

  if (check) {
    idGeneratedNumber.value = id17 + check
    idGenerateResult.value = { type: 'success', text: '生成成功' }
  } else {
    idGenerateResult.value = { type: 'error', text: '生成失败' }
  }
}

function validateIdNumber(): void {
  const input = idVerifyInput.value.trim()

  if (!input) {
    idVerifyResult.value = { type: 'error', text: '请输入身份证号码' }
    return
  }

  if (!/^\d{17}[\dX]$/i.test(input)) {
    idVerifyResult.value = { type: 'error', text: '格式错误：应为18位（17位数字 + 最后1位数字或X）' }
    return
  }

  const birthYmd = input.slice(6, 14)
  if (!validateBirthYmd8(birthYmd)) {
    idVerifyResult.value = { type: 'error', text: '出生日期不合法：' + birthYmd }
    return
  }

  const expectedCheck = calcIdCardCheckDigit(input.slice(0, 17))
  if (!expectedCheck || expectedCheck.toUpperCase() !== input[17].toUpperCase()) {
    idVerifyResult.value = { type: 'error', text: '校验码错误' }
    return
  }

  idVerifyResult.value = { type: 'success', text: '校验通过：身份证号码合法' }
}

async function copyIdNumber(): Promise<void> {
  if (!idGeneratedNumber.value) return
  const success = await copyToClipboard(idGeneratedNumber.value)
  if (success) {
    idCopyDone.value = true
    setTimeout(() => { idCopyDone.value = false }, 2000)
  }
}

// USCC functions
function generateUsccCode(): void {
  if (regionLoading.value) {
    usccGenerateResult.value = { type: 'error', text: '行政区划数据加载中...' }
    return
  }

  if (usccCodeMode.value === 'uscc18') {
    if (!usccProvinceCode.value) {
      usccGenerateResult.value = { type: 'error', text: '请选择省份' }
      return
    }

    const regionCode = usccCountyCode.value || usccCityCode.value || usccProvinceCode.value

    // Generate random 9-digit body
    const body9 = Array.from({ length: 9 }, () =>
      '0123456789ABCDEFGHJKLMNPQRTUWXY'[Math.floor(Math.random() * 31)]
    ).join('')

    const base17 = usccDeptCode.value + usccOrgTypeCode.value + regionCode + body9

    // Calculate check character (simplified)
    const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
    let sum = 0
    for (let i = 0; i < 17; i++) {
      sum += parseInt(base17[i]) * weights[i]
    }
    const p = 31
    const m0 = sum % p
    const checkChar = p - m0 === 31 ? '0' : String.fromCharCode(55 + (p - m0))

    usccGeneratedCode.value = base17 + checkChar
    usccGenerateResult.value = { type: 'success', text: '生成成功' }
  } else {
    // Org code (15-digit)
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

    const weights10 = [3, 7, 9, 0, 5, 8, 4, 2]
    const fullCode9 = code9 + code10
    let sum10 = 0
    for (let i = 0; i < 9; i++) {
      sum10 += parseInt(fullCode9[i]) * weights10[i]
    }
    const c10 = 10 - (sum10 % 10)
    const codeChar = c10 === 10 ? '0' : String(c10)

    usccGeneratedCode.value = fullCode9 + '-' + codeChar
    usccGenerateResult.value = { type: 'success', text: '生成成功' }
  }
}

function validateUsccCode(): void {
  const input = usccVerifyInput.value.trim().replace(/-/g, '')

  if (!input) {
    usccVerifyResult.value = { type: 'error', text: '请输入证件号码' }
    return
  }

  let result: { type: string; text: string }

  if (input.length === 18) {
    result = validateUscc18(input)
      ? { type: 'success', text: '校验通过：统一社会信用代码合法' }
      : { type: 'error', text: '校验失败：统一社会信用代码不合法' }
  } else if (input.length === 15) {
    result = validateLegacy15(input)
      ? { type: 'success', text: '校验通过：组织机构代码合法' }
      : { type: 'error', text: '校验失败：组织机构代码不合法' }
  } else {
    result = { type: 'error', text: '格式错误：应为18位或15位' }
  }

  usccVerifyResult.value = result
}

async function copyUsccCode(): Promise<void> {
  if (!usccGeneratedCode.value) return
  const success = await copyToClipboard(usccGeneratedCode.value)
  if (success) {
    usccCopyDone.value = true
    setTimeout(() => { usccCopyDone.value = false }, 2000)
  }
}

onMounted(() => {
  loadRegionData()
})
</script>

<template>
  <div class="id-tool-page">
    <!-- ID Card Section -->
    <section class="id-card-section">
      <h2 class="section-title">身份证号码生成与校验</h2>

      <div class="card">
        <h3 class="card-title">生成</h3>

        <div class="form-row">
          <label>省份</label>
          <select v-model="idProvinceCode" :disabled="regionLoading">
            <option value="">请选择</option>
            <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-row">
          <label>城市</label>
          <select v-model="idCityCode" :disabled="regionLoading || !idProvinceCode">
            <option value="">请选择</option>
            <option v-for="c in idCityOptions" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-row">
          <label>区县</label>
          <select v-model="idCountyCode" :disabled="regionLoading || !idCityCode">
            <option value="">请选择</option>
            <option v-for="c in idCountyOptions" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-row-inline">
          <div class="form-row">
            <label>出生年</label>
            <input type="text" v-model="idBirthYear" placeholder="1990" maxlength="4" />
          </div>
          <div class="form-row">
            <label>月</label>
            <input type="text" v-model="idBirthMonth" placeholder="01" maxlength="2" />
          </div>
          <div class="form-row">
            <label>日</label>
            <input type="text" v-model="idBirthDay" placeholder="01" maxlength="2" />
          </div>
        </div>

        <div class="form-row">
          <label>性别</label>
          <div class="radio-group">
            <label v-for="opt in genderOptions" :key="opt.value" class="radio-label">
              <input type="radio" v-model="idGender" :value="opt.value" />
              {{ opt.label }}
            </label>
          </div>
        </div>

        <div class="form-actions">
          <button class="btn primary" @click="generateIdNumber" :disabled="regionLoading">
            生成
          </button>
          <button class="btn" @click="copyIdNumber" :disabled="!idGeneratedNumber">
            {{ idCopyDone ? '已复制' : '复制' }}
          </button>
        </div>

        <div v-if="idGeneratedNumber" class="result-box">
          <span class="result-label">生成结果：</span>
          <code class="result-value">{{ idGeneratedNumber }}</code>
        </div>

        <div v-if="idGenerateResult.text" class="result-message" :class="idGenerateResult.type">
          {{ idGenerateResult.text }}
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">校验</h3>

        <div class="form-row">
          <label>身份证号码</label>
          <input type="text" v-model="idVerifyInput" placeholder="请输入18位身份证号码" maxlength="18" />
        </div>

        <div class="form-actions">
          <button class="btn primary" @click="validateIdNumber">校验</button>
        </div>

        <div v-if="idVerifyResult.text" class="result-message" :class="idVerifyResult.type">
          {{ idVerifyResult.text }}
        </div>
      </div>
    </section>

    <!-- USCC Section -->
    <section class="uscc-section">
      <h2 class="section-title">组织机构代码 / 统一社会信用代码</h2>

      <div class="card">
        <h3 class="card-title">生成</h3>

        <div class="form-row">
          <label>类型</label>
          <select v-model="usccCodeMode">
            <option v-for="opt in usccModeOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </div>

        <div class="form-row" v-if="usccCodeMode === 'uscc18'">
          <label>省份</label>
          <select v-model="usccProvinceCode" :disabled="regionLoading">
            <option value="">请选择</option>
            <option v-for="p in provinces" :key="p.code" :value="p.code">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-row" v-if="usccCodeMode === 'uscc18'">
          <label>城市</label>
          <select v-model="usccCityCode" :disabled="regionLoading || !usccProvinceCode">
            <option value="">请选择</option>
            <option v-for="c in usccCityOptions" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-row" v-if="usccCodeMode === 'uscc18'">
          <label>区县</label>
          <select v-model="usccCountyCode" :disabled="regionLoading || !usccCityCode">
            <option value="">请选择</option>
            <option v-for="c in usccCountyOptions" :key="c.code" :value="c.code">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-actions">
          <button class="btn primary" @click="generateUsccCode" :disabled="regionLoading">
            生成
          </button>
          <button class="btn" @click="copyUsccCode" :disabled="!usccGeneratedCode">
            {{ usccCopyDone ? '已复制' : '复制' }}
          </button>
        </div>

        <div v-if="usccGeneratedCode" class="result-box">
          <span class="result-label">生成结果：</span>
          <code class="result-value">{{ usccGeneratedCode }}</code>
        </div>

        <div v-if="usccGenerateResult.text" class="result-message" :class="usccGenerateResult.type">
          {{ usccGenerateResult.text }}
        </div>
      </div>

      <div class="card">
        <h3 class="card-title">校验</h3>

        <div class="form-row">
          <label>证件号码</label>
          <input type="text" v-model="usccVerifyInput" :placeholder="usccCodeMode === 'uscc18' ? '18位统一社会信用代码' : '15位组织机构代码'" />
        </div>

        <div class="form-actions">
          <button class="btn primary" @click="validateUsccCode">校验</button>
        </div>

        <div v-if="usccVerifyResult.text" class="result-message" :class="usccVerifyResult.type">
          {{ usccVerifyResult.text }}
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.id-tool-page {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.id-card-section,
.uscc-section {
  margin-bottom: 32px;
}

.card {
  padding: 20px;
  margin-bottom: 16px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-panel);
}

.card-title {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.form-row {
  margin-bottom: 12px;
}

.form-row label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  color: var(--color-text-subtle);
}

.form-row select,
.form-row input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
}

.form-row select:focus,
.form-row input[type="text"]:focus {
  outline: none;
  border-color: var(--color-brand-500);
}

.form-row-inline {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.form-row-inline .form-row {
  flex: 1;
  margin-bottom: 0;
}

.radio-group {
  display: flex;
  gap: 16px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-panel);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn:hover:not(:disabled) {
  background: var(--color-panel-2);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.primary {
  border-color: var(--color-brand-500);
  background: var(--color-brand-500);
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: var(--color-brand-600);
}

.result-box {
  margin-top: 16px;
  padding: 12px;
  border-radius: 6px;
  background: var(--color-panel-2);
}

.result-label {
  font-size: 12px;
  color: var(--color-text-subtle);
}

.result-value {
  display: block;
  margin-top: 4px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: var(--color-text);
  word-break: break-all;
}

.result-message {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
}

.result-message.info {
  background: var(--color-panel-2);
  color: var(--color-text-subtle);
}

.result-message.success {
  background: rgba(21, 145, 95, 0.1);
  color: var(--color-success);
}

.result-message.error {
  background: rgba(214, 69, 69, 0.1);
  color: var(--color-danger);
}

@media (max-width: 768px) {
  .form-row-inline {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
