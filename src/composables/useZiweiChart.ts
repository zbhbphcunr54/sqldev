import { computed } from 'vue'
import type { Ref } from 'vue'
import type { ZiweiChart } from '@/features/ziwei/compute'
import { getStarType, getPalaceName, PALACE_ORDER } from '@/features/ziwei/star-classifier'

export function useZiweiChart(
  chart: Ref<ZiweiChart | null>,
  calendarType: Ref<'solar' | 'lunar'>,
  solarYear: Ref<string>,
  lunarYear: Ref<string>
) {
  const palaceGrid = computed(() => {
    if (!chart.value?.boardCells) return []

    const cells = chart.value.boardCells

    return PALACE_ORDER.map((branch) => {
      if (!branch) return null

      const cell = cells.find((c) => c.branch === branch)
      if (!cell) return null

      const allStars: Array<{
        name: string
        type: string
        hua?: string
        level?: string
      }> = []

      ;(cell.mainStars || []).forEach((s) => {
        allStars.push({
          name: s.name,
          type: getStarType(s.name),
          hua: s.huaTags?.[0],
          level: s.brightness
        })
      })
      ;(cell.assistStars || []).forEach((s) => {
        allStars.push({ name: s.name, type: getStarType(s.name) })
      })
      ;(cell.miscStars || []).forEach((s) => {
        allStars.push({ name: s.name, type: getStarType(s.name) })
      })

      const mainStars = allStars.filter((star) => star.type === 'main')
      const luckyStars = allStars.filter((star) => star.type === 'luck')
      const evilStars = allStars.filter((star) => star.type === 'harm')
      const miscStars = allStars.filter(
        (star) => star.type !== 'main' && star.type !== 'luck' && star.type !== 'harm'
      )

      return {
        branch,
        palace: getPalaceName(branch),
        ganzhi: cell.stemBranch || '',
        stars: allStars,
        mainStars,
        luckyStars,
        evilStars,
        miscStars,
        changSheng: cell.changSheng || '',
        daXianAge: cell.daXian || '',
        liuNianPalaceName: cell.liuNianPalaceName || '',
        isCurrentDaXian: Boolean(cell.isCurrentDaXian),
        isMing: branch === chart.value?.center?.mingBranch,
        isShen: branch === chart.value?.center?.shenBranch
      }
    })
  })

  const centerInfo = computed(() => {
    if (!chart.value?.center) return null
    const c = chart.value.center

    let age = ''
    if (c.yearGanZhi) {
      const birthYear = parseInt(calendarType.value === 'solar' ? solarYear.value : lunarYear.value)
      const currentYear = new Date().getFullYear()
      age = String(currentYear - birthYear + 1)
    }
    const ageLabel = String(c.currentAgeLabel || age).replace(/岁$/, '')

    return {
      yearGanzhi: c.yearGanZhi || '',
      bureau: c.bureauLabel || '',
      gender: c.genderLabel || '',
      lunar: c.lunarText || '',
      yinYang: c.naYinLabel || '',
      mingZhu: c.mingZhu || '',
      mingBranch: c.mingBranch || '',
      shenBranch: c.shenBranch || '',
      shenZhu: c.shenZhu || '',
      inputClockText: c.inputClockText || '',
      shichenLabel: c.shichenLabel || '',
      timeCorrectionText: c.timeCorrectionText || '',
      currentDaXianLabel: c.currentDaXianLabel || '',
      currentLiuNianPalaceLabel: c.currentLiuNianPalaceLabel || '',
      age: ageLabel,
      currentYear: new Date().getFullYear()
    }
  })

  const chartMeta = computed(() => {
    if (!centerInfo.value) return ''
    return `${centerInfo.value.yearGanzhi}·${centerInfo.value.bureau}·${centerInfo.value.gender}命`
  })

  const daXianTimeline = computed(() => {
    const timeline = chart.value?.daXianTimeline || []
    return timeline.slice(0, 10)
  })

  const liuNianTimeline = computed(() => {
    const timeline = chart.value?.liuNianTimeline || []
    return timeline.slice(0, 12)
  })

  return { palaceGrid, centerInfo, chartMeta, daXianTimeline, liuNianTimeline }
}
