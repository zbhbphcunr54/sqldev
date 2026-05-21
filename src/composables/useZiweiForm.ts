import { computed, ref, watch } from 'vue'
import { writeOperationLog } from '@/api/operation-logs'
import { computeZiweiChart, validateBirthDate, validateBirthTime } from '@/features/ziwei/compute'
import type { ZiweiChart } from '@/features/ziwei/compute'
import {
  PROVINCE_OPTIONS,
  getCityOptionsByProvince,
  getDefaultProvinceCity,
  getLongitudeByCity
} from '@/features/ziwei/city-longitude'
import { DEFAULT_FORM_VALUES, UI_LABELS } from '@/features/ziwei/ui-constants'
import { mapErrorCodeToMessage } from '@/utils/error-map'

type SelectOption = {
  value: string
  label: string
}

type ShiChenOption = SelectOption & {
  hour: string
  minute: string
}

const LUNAR_MONTH_LABELS = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月'
]

const LUNAR_DAY_LABELS = [
  '',
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十'
]

const SHICHEN_OPTIONS: ShiChenOption[] = [
  { value: 'zi', label: '子时', hour: '23', minute: '00' },
  { value: 'chou', label: '丑时', hour: '01', minute: '00' },
  { value: 'yin', label: '寅时', hour: '03', minute: '00' },
  { value: 'mao', label: '卯时', hour: '05', minute: '00' },
  { value: 'chen', label: '辰时', hour: '07', minute: '00' },
  { value: 'si', label: '巳时', hour: '09', minute: '00' },
  { value: 'wu', label: '午时', hour: '11', minute: '00' },
  { value: 'wei', label: '未时', hour: '13', minute: '00' },
  { value: 'shen', label: '申时', hour: '15', minute: '00' },
  { value: 'you', label: '酉时', hour: '17', minute: '00' },
  { value: 'xu', label: '戌时', hour: '19', minute: '00' },
  { value: 'hai', label: '亥时', hour: '21', minute: '00' }
]

function resolveShiChenValue(hour: string, minute: string): string {
  const resolvedHour = Number(hour)
  const resolvedMinute = Number(minute)

  if (!Number.isInteger(resolvedHour) || !Number.isInteger(resolvedMinute)) {
    return 'wu'
  }

  const totalMinutes = resolvedHour * 60 + resolvedMinute

  if (totalMinutes >= 23 * 60 || totalMinutes < 60) return 'zi'
  if (totalMinutes < 3 * 60) return 'chou'
  if (totalMinutes < 5 * 60) return 'yin'
  if (totalMinutes < 7 * 60) return 'mao'
  if (totalMinutes < 9 * 60) return 'chen'
  if (totalMinutes < 11 * 60) return 'si'
  if (totalMinutes < 13 * 60) return 'wu'
  if (totalMinutes < 15 * 60) return 'wei'
  if (totalMinutes < 17 * 60) return 'shen'
  if (totalMinutes < 19 * 60) return 'you'
  if (totalMinutes < 21 * 60) return 'xu'
  return 'hai'
}

function getChineseCalendarParts(date: Date): {
  relatedYear: string
  month: string
  day: string
} {
  const formatter = new Intl.DateTimeFormat('en-u-ca-chinese', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  })
  const parts = formatter.formatToParts(date)

  return {
    relatedYear:
      parts.find((part) => part.type === 'relatedYear')?.value ||
      parts.find((part) => part.type === 'year')?.value ||
      '',
    month: parts.find((part) => part.type === 'month')?.value || '',
    day: parts.find((part) => part.type === 'day')?.value || ''
  }
}

function normalizeLunarMonthValue(value: string): { month: number; isLeap: boolean } {
  const raw = String(value || '').trim()
  const isLeap = raw.endsWith('bis')
  const month = Number.parseInt(isLeap ? raw.slice(0, -3) : raw, 10)

  return {
    month: Number.isInteger(month) ? month : 1,
    isLeap
  }
}

function buildLunarMonthOptions(year: string): SelectOption[] {
  const targetYear = Number(year)
  if (!Number.isInteger(targetYear)) {
    return LUNAR_MONTH_LABELS.map((label, index) => ({
      value: String(index + 1),
      label
    }))
  }

  const seen = new Set<string>()
  const options: SelectOption[] = []

  for (let month = 0; month < 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const parts = getChineseCalendarParts(new Date(targetYear, month, day))
      if (parts.relatedYear !== String(targetYear)) continue
      if (!parts.month) continue
      if (seen.has(parts.month)) continue

      const normalized = normalizeLunarMonthValue(parts.month)
      const baseLabel = LUNAR_MONTH_LABELS[normalized.month - 1]
      if (!baseLabel) continue

      seen.add(parts.month)
      options.push({
        value: parts.month,
        label: normalized.isLeap ? `闰${baseLabel}` : baseLabel
      })
    }
  }

  return options.sort((a, b) => {
    const aMonth = normalizeLunarMonthValue(a.value)
    const bMonth = normalizeLunarMonthValue(b.value)
    if (aMonth.month !== bMonth.month) return aMonth.month - bMonth.month
    if (aMonth.isLeap === bMonth.isLeap) return 0
    return aMonth.isLeap ? 1 : -1
  })
}

function getLunarMonthMaxDay(year: string, monthValue: string): number {
  const targetYear = Number(year)
  if (!Number.isInteger(targetYear) || !monthValue) return 30

  let maxDay = 29

  for (let month = 0; month < 12; month += 1) {
    for (let day = 1; day <= 31; day += 1) {
      const parts = getChineseCalendarParts(new Date(targetYear, month, day))
      if (parts.relatedYear !== String(targetYear)) continue
      if (parts.month !== monthValue) continue

      const lunarDay = Number(parts.day)
      if (Number.isInteger(lunarDay) && lunarDay > maxDay) {
        maxDay = lunarDay
      }
    }
  }

  return maxDay
}

export function useZiweiForm() {
  const defaultLocation = getDefaultProvinceCity()

  const calendarType = ref<'solar' | 'lunar'>('solar')
  const solarYear = ref(DEFAULT_FORM_VALUES.DEFAULT_SOLAR_YEAR)
  const solarMonth = ref(DEFAULT_FORM_VALUES.DEFAULT_SOLAR_MONTH)
  const solarDay = ref(DEFAULT_FORM_VALUES.DEFAULT_SOLAR_DAY)
  const lunarYear = ref(DEFAULT_FORM_VALUES.DEFAULT_LUNAR_YEAR)
  const lunarMonth = ref(DEFAULT_FORM_VALUES.DEFAULT_LUNAR_MONTH)
  const lunarDay = ref(DEFAULT_FORM_VALUES.DEFAULT_LUNAR_DAY)
  const lunarLeap = ref(false)
  const birthHour = ref(DEFAULT_FORM_VALUES.DEFAULT_BIRTH_HOUR)
  const birthMinute = ref(DEFAULT_FORM_VALUES.DEFAULT_BIRTH_MINUTE)
  const gender = ref<'male' | 'female'>('male')
  const profileName = ref('')
  const school = ref<'traditional' | 'flying'>('traditional')
  const birthProvince = ref(defaultLocation.province)
  const birthCity = ref(defaultLocation.city)

  const showUserMenu = ref(false)
  const generating = ref(false)
  const status = ref<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const chart = ref<ZiweiChart | null>(null)

  const yearOptions = computed(() => {
    const years: string[] = []
    for (let year = 2100; year >= 1900; year -= 1) years.push(String(year))
    return years
  })

  const yearFormOptions = computed<SelectOption[]>(() =>
    yearOptions.value.map((year) => ({ value: year, label: `${year}年` }))
  )

  const solarMonthOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: `${String(index + 1).padStart(2, '0')}月`
    }))
  )

  const solarDayOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 31 }, (_, index) => ({
      value: String(index + 1).padStart(2, '0'),
      label: `${String(index + 1).padStart(2, '0')}日`
    }))
  )

  const solarHourOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 24 }, (_, index) => ({
      value: String(index).padStart(2, '0'),
      label: `${String(index).padStart(2, '0')}时`
    }))
  )

  const minuteOptions = computed<SelectOption[]>(() =>
    Array.from({ length: 60 }, (_, index) => ({
      value: String(index).padStart(2, '0'),
      label: `${String(index).padStart(2, '0')}分`
    }))
  )

  const lunarMonthOptions = computed<SelectOption[]>(() => buildLunarMonthOptions(lunarYear.value))
  const lunarDayOptions = computed<SelectOption[]>(() => {
    const maxDay = getLunarMonthMaxDay(lunarYear.value, lunarMonth.value)
    return LUNAR_DAY_LABELS.slice(1, maxDay + 1).map((label, index) => ({
      value: String(index + 1),
      label
    }))
  })

  const birthShiChenOptions = computed<SelectOption[]>(() =>
    SHICHEN_OPTIONS.map(({ value, label }) => ({ value, label }))
  )

  const birthShiChen = computed({
    get: () => resolveShiChenValue(birthHour.value, birthMinute.value),
    set: (value: string) => {
      const option = SHICHEN_OPTIONS.find((item) => item.value === value)
      if (!option) return

      birthHour.value = option.hour
      birthMinute.value = option.minute
    }
  })

  const provinceOptions = PROVINCE_OPTIONS
  const cityOptions = computed(() => getCityOptionsByProvince(birthProvince.value))
  const selectedLongitude = computed(() => {
    const value = getLongitudeByCity(birthProvince.value, birthCity.value)
    return value ?? defaultLocation.longitude
  })
  const selectedLongitudeText = computed(() => `${selectedLongitude.value.toFixed(2)}°E`)
  const correctionText = computed(() => chart.value?.center?.timeCorrectionText || '')
  const shiChenCorrectionNotice = computed(() => {
    const text = correctionText.value
    return text.includes('时辰由') ? text : ''
  })

  const calendarTypeOptions: SelectOption[] = [
    { value: 'solar', label: UI_LABELS.CALENDAR_SOLAR },
    { value: 'lunar', label: UI_LABELS.CALENDAR_LUNAR }
  ]

  watch(
    () => birthProvince.value,
    (newProvince) => {
      const options = getCityOptionsByProvince(newProvince)
      if (!options.some((option) => option.value === birthCity.value)) {
        birthCity.value = options[0]?.value || ''
      }
    },
    { immediate: true }
  )

  watch(
    () => lunarYear.value,
    () => {
      const validMonthValues = new Set(lunarMonthOptions.value.map((option) => option.value))
      if (!validMonthValues.has(lunarMonth.value)) {
        lunarMonth.value = lunarMonthOptions.value[0]?.value || '1'
      }
    },
    { immediate: true }
  )

  watch(
    () => lunarMonth.value,
    (value) => {
      lunarLeap.value = normalizeLunarMonthValue(value).isLeap

      const maxDay = getLunarMonthMaxDay(lunarYear.value, value)
      if (Number(lunarDay.value) > maxDay) {
        lunarDay.value = String(maxDay)
      }
    },
    { immediate: true }
  )

  function toggleUserMenu(): void {
    showUserMenu.value = !showUserMenu.value
  }

  function closeUserMenu(): void {
    showUserMenu.value = false
  }

  function clearChart(): void {
    chart.value = null
    status.value = { type: '', text: '' }
  }

  function writeChartLog(
    responseStatus: number,
    durationMs: number,
    responseBody: Record<string, unknown>,
    errorMessage?: string
  ): void {
    void writeOperationLog({
      operation: 'ziwei_chart_generate',
      api_name: 'ziwei-page',
      response_status: responseStatus,
      duration_ms: durationMs,
      request_body: {
        calendar_type: calendarType.value,
        gender: gender.value,
        school: school.value,
        longitude: Number(selectedLongitude.value.toFixed(3)),
        clock_mode: DEFAULT_FORM_VALUES.CLOCK_MODE
      },
      response_body: responseBody,
      error_message: errorMessage
    }).catch(() => {})
  }

  async function handleGenerate(): Promise<void> {
    const startTime = performance.now()
    generating.value = true
    status.value = { type: '', text: '' }

    try {
      const dateValidation =
        calendarType.value === 'solar'
          ? validateBirthDate(calendarType.value, solarYear.value, solarMonth.value, solarDay.value)
          : validateBirthDate(
              calendarType.value,
              lunarYear.value,
              String(normalizeLunarMonthValue(lunarMonth.value).month),
              lunarDay.value,
              lunarLeap.value
            )

      if (!dateValidation.valid) {
        status.value = {
          type: 'error',
          text: dateValidation.error || mapErrorCodeToMessage('ziwei_birth_invalid')
        }
        writeChartLog(
          400,
          Math.round(performance.now() - startTime),
          { ok: false, error: 'invalid_birth_date' },
          dateValidation.error || 'invalid_birth_date'
        )
        return
      }

      const timeValidation = validateBirthTime(birthHour.value, birthMinute.value)
      if (!timeValidation.valid) {
        status.value = {
          type: 'error',
          text: timeValidation.error || mapErrorCodeToMessage('ziwei_birth_time_invalid')
        }
        writeChartLog(
          400,
          Math.round(performance.now() - startTime),
          { ok: false, error: 'invalid_birth_time' },
          timeValidation.error || 'invalid_birth_time'
        )
        return
      }

      const result = computeZiweiChart({
        calendarType: calendarType.value,
        solarYear: solarYear.value,
        solarMonth: solarMonth.value,
        solarDay: solarDay.value,
        lunarYear: lunarYear.value,
        lunarMonth: String(normalizeLunarMonthValue(lunarMonth.value).month),
        lunarDay: lunarDay.value,
        lunarLeap: lunarLeap.value,
        birthHour: birthHour.value,
        birthMinute: birthMinute.value,
        gender: gender.value,
        school: school.value,
        clockMode: DEFAULT_FORM_VALUES.CLOCK_MODE,
        timezoneOffset: DEFAULT_FORM_VALUES.TIMEZONE_OFFSET,
        longitude: selectedLongitude.value.toFixed(3),
        xiaoXianRule: DEFAULT_FORM_VALUES.XIAO_XIAN_RULE,
        liuNianRule: DEFAULT_FORM_VALUES.LIU_NIAN_RULE
      })

      if (result.ok && result.chart) {
        chart.value = result.chart
        status.value = { type: 'success', text: UI_LABELS.SUCCESS_GENERATED }
        writeChartLog(200, Math.round(performance.now() - startTime), {
          ok: true,
          shichen: result.chart.center?.shichenLabel || '',
          current_year: result.chart.center?.currentYearLabel || '',
          has_correction_notice: Boolean(result.chart.center?.timeCorrectionText)
        })
      } else {
        status.value = {
          type: 'error',
          text: result.error || mapErrorCodeToMessage('ziwei_chart_failed')
        }
        writeChartLog(
          500,
          Math.round(performance.now() - startTime),
          { ok: false, error: result.error || 'ziwei_chart_failed' },
          result.error || 'ziwei_chart_failed'
        )
      }
    } catch (error) {
      console.error('[useZiweiForm] generate failed:', error)
      status.value = { type: 'error', text: mapErrorCodeToMessage('ziwei_chart_failed') }
      writeChartLog(
        500,
        Math.round(performance.now() - startTime),
        { ok: false, error: 'ziwei_chart_failed' },
        error instanceof Error ? error.message : 'ziwei_chart_failed'
      )
    } finally {
      generating.value = false
    }
  }

  return {
    calendarType,
    solarYear,
    solarMonth,
    solarDay,
    lunarYear,
    lunarMonth,
    lunarDay,
    lunarLeap,
    birthHour,
    birthMinute,
    birthShiChen,
    gender,
    profileName,
    school,
    birthProvince,
    birthCity,
    showUserMenu,
    generating,
    status,
    chart,
    correctionText,
    shiChenCorrectionNotice,
    yearOptions,
    solarMonthOptions,
    solarDayOptions,
    solarHourOptions,
    minuteOptions,
    lunarMonthOptions,
    lunarDayOptions,
    birthShiChenOptions,
    yearFormOptions,
    provinceOptions,
    cityOptions,
    selectedLongitudeText,
    calendarTypeOptions,
    toggleUserMenu,
    closeUserMenu,
    clearChart,
    handleGenerate
  }
}
