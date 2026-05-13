import { ref, computed, watch } from 'vue'
import { computeZiweiChart, validateBirthDate, validateBirthTime } from '@/features/ziwei/compute'
import type { ZiweiChart } from '@/features/ziwei/compute'
import { mapErrorCodeToMessage } from '@/utils/error-map'
import { DEFAULT_FORM_VALUES, UI_LABELS } from '@/features/ziwei/ui-constants'
import {
  PROVINCE_OPTIONS,
  getCityOptionsByProvince,
  getDefaultProvinceCity,
  getLongitudeByCity
} from '@/features/ziwei/city-longitude'

export function useZiweiForm() {
  const defaultLocation = getDefaultProvinceCity()

  // ==================== 表单状态 ====================
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

  // ==================== UI 状态 ====================
  const showUserMenu = ref(false)
  const generating = ref(false)
  const status = ref<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' })
  const chart = ref<ZiweiChart | null>(null)

  // ==================== 选项数据 ====================
  const yearOptions = computed(() => {
    const years: string[] = []
    for (let y = 2100; y >= 1900; y--) years.push(String(y))
    return years
  })

  const monthOptions = computed(() =>
    Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1).padStart(2, '0'),
      label: `${String(i + 1).padStart(2, '0')}月`
    }))
  )

  const dayOptions = computed(() =>
    Array.from({ length: 31 }, (_, i) => ({
      value: String(i + 1).padStart(2, '0'),
      label: `${String(i + 1).padStart(2, '0')}日`
    }))
  )

  const hourOptions = computed(() =>
    Array.from({ length: 24 }, (_, i) => ({
      value: String(i).padStart(2, '0'),
      label: `${String(i).padStart(2, '0')}时`
    }))
  )

  const minuteOptions = computed(() =>
    Array.from({ length: 60 }, (_, i) => ({
      value: String(i).padStart(2, '0'),
      label: `${String(i).padStart(2, '0')}分`
    }))
  )

  const yearFormOptions = computed(() =>
    yearOptions.value.map((y) => ({ value: y, label: `${y}年` }))
  )
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

  const calendarTypeOptions: { value: string; label: string }[] = [
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

  // ==================== 动作 ====================
  function toggleUserMenu(): void {
    showUserMenu.value = !showUserMenu.value
  }

  function closeUserMenu(): void {
    showUserMenu.value = false
  }

  async function handleGenerate(): Promise<void> {
    generating.value = true
    status.value = { type: '', text: '' }

    try {
      const dateValidation =
        calendarType.value === 'solar'
          ? validateBirthDate(calendarType.value, solarYear.value, solarMonth.value, solarDay.value)
          : validateBirthDate(
              calendarType.value,
              lunarYear.value,
              lunarMonth.value,
              lunarDay.value,
              lunarLeap.value
            )

      if (!dateValidation.valid) {
        status.value = {
          type: 'error',
          text: dateValidation.error || mapErrorCodeToMessage('ziwei_birth_invalid')
        }
        return
      }

      const timeValidation = validateBirthTime(birthHour.value, birthMinute.value)
      if (!timeValidation.valid) {
        status.value = {
          type: 'error',
          text: timeValidation.error || mapErrorCodeToMessage('ziwei_birth_time_invalid')
        }
        return
      }

      const result = computeZiweiChart({
        calendarType: calendarType.value,
        solarYear: solarYear.value,
        solarMonth: solarMonth.value,
        solarDay: solarDay.value,
        lunarYear: lunarYear.value,
        lunarMonth: lunarMonth.value,
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
      } else {
        status.value = {
          type: 'error',
          text: result.error || mapErrorCodeToMessage('ziwei_chart_failed')
        }
      }
    } catch (err) {
      console.error('[useZiweiForm] generate failed:', err)
      status.value = { type: 'error', text: mapErrorCodeToMessage('ziwei_chart_failed') }
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
    monthOptions,
    dayOptions,
    hourOptions,
    minuteOptions,
    yearFormOptions,
    provinceOptions,
    cityOptions,
    selectedLongitudeText,
    calendarTypeOptions,
    toggleUserMenu,
    closeUserMenu,
    handleGenerate
  }
}
