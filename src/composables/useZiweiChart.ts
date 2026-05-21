import { computed } from 'vue'
import type { Ref } from 'vue'
import type { ZiweiChart, ZiweiCell, ZiweiStar } from '@/features/ziwei/compute'
import { getStarType, getPalaceName, PALACE_ORDER } from '@/features/ziwei/star-classifier'

interface HuaSummaryItem {
  tag: string
  label: string
  palace: string
}

interface PalaceStarView {
  name: string
  type: string
  hua?: string
  huaTags: string[]
  level?: string
}

function getTagFromHuaType(type: string): string {
  if (type === '化禄') return '禄'
  if (type === '化权') return '权'
  if (type === '化科') return '科'
  if (type === '化忌') return '忌'
  return type
}

function collectAllStars(cell: ZiweiCell): PalaceStarView[] {
  const allStars: PalaceStarView[] = []

  ;(cell.mainStars || []).forEach((star) => {
    allStars.push({
      name: star.name,
      type: getStarType(star.name),
      hua: star.huaTags?.[0],
      huaTags: star.huaTags || [],
      level: star.brightness
    })
  })

  ;(cell.assistStars || []).forEach((star) => {
    allStars.push({
      name: star.name,
      type: getStarType(star.name),
      hua: star.huaTags?.[0],
      huaTags: star.huaTags || [],
      level: star.brightness
    })
  })

  ;(cell.miscStars || []).forEach((star) => {
    allStars.push({
      name: star.name,
      type: getStarType(star.name),
      hua: star.huaTags?.[0],
      huaTags: star.huaTags || [],
      level: star.brightness
    })
  })

  return allStars
}

function buildBirthHuaSummary(cells: ZiweiCell[]): HuaSummaryItem[] {
  const items: HuaSummaryItem[] = []

  cells.forEach((cell) => {
    const palace = cell.palaceName || getPalaceName(cell.branch)
    const stars = [
      ...(cell.mainStars || []),
      ...(cell.assistStars || []),
      ...(cell.miscStars || [])
    ] as ZiweiStar[]

    stars.forEach((star) => {
      ;(star.huaTags || []).forEach((tag) => {
        items.push({
          tag,
          label: `${tag}—${star.name}→${palace}`,
          palace
        })
      })
    })
  })

  return items.sort((a, b) => a.tag.localeCompare(b.tag, 'zh-CN'))
}

function buildTransitHuaSummary(
  cells: ZiweiCell[],
  field: 'daxianSiHua' | 'liunianSiHua'
): HuaSummaryItem[] {
  const items: HuaSummaryItem[] = []

  cells.forEach((cell) => {
    const palace = cell.palaceName || getPalaceName(cell.branch)
    ;(cell[field] || []).forEach((item) => {
      items.push({
        tag: getTagFromHuaType(item.type),
        label: `${item.type}—${item.star}→${palace}`,
        palace
      })
    })
  })

  return items.sort((a, b) => a.tag.localeCompare(b.tag, 'zh-CN'))
}

export function useZiweiChart(
  chart: Ref<ZiweiChart | null>,
  calendarType: Ref<'solar' | 'lunar'>,
  solarYear: Ref<string>,
  lunarYear: Ref<string>
) {
  const rawCells = computed(() => chart.value?.boardCells || [])

  const palaceGrid = computed(() => {
    if (!rawCells.value.length) return []

    return PALACE_ORDER.map((branch) => {
      if (!branch) return null

      const cell = rawCells.value.find((item) => item.branch === branch)
      if (!cell) return null

      const stars = collectAllStars(cell)
      const mainStars = stars.filter((star) => star.type === 'main')
      const luckyStars = stars.filter((star) => star.type === 'luck')
      const evilStars = stars.filter((star) => star.type === 'harm')
      const miscStars = stars.filter(
        (star) => star.type !== 'main' && star.type !== 'luck' && star.type !== 'harm'
      )

      const birthHuaStars = stars
        .filter((star) => star.huaTags.length > 0)
        .flatMap((star) =>
          star.huaTags.map((tag) => ({
            tag,
            label: `${star.name}${tag === '禄' || tag === '权' || tag === '科' || tag === '忌' ? ` 化${tag}` : tag}`
          }))
        )

      return {
        branch,
        palace: getPalaceName(branch),
        ganzhi: cell.stemBranch || '',
        stars,
        mainStars,
        luckyStars,
        evilStars,
        miscStars,
        birthHuaStars,
        changSheng: cell.changSheng || '',
        daXianAge: cell.daXian || '',
        liuNianPalaceName: cell.liuNianPalaceName || '',
        isCurrentDaXian: Boolean(cell.isCurrentDaXian),
        isMing: branch === chart.value?.center?.mingBranch,
        isShen: branch === chart.value?.center?.shenBranch,
        daxianSiHua: cell.daxianSiHua || [],
        liunianSiHua: cell.liunianSiHua || []
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

    const birthHuaSummary = buildBirthHuaSummary(rawCells.value)
    const daxianHuaSummary = buildTransitHuaSummary(rawCells.value, 'daxianSiHua')
    const liunianHuaSummary = buildTransitHuaSummary(rawCells.value, 'liunianSiHua')

    return {
      yearGanzhi: c.yearGanZhi || '',
      bureau: c.bureauLabel || '',
      gender: c.genderLabel || '',
      lunar: c.lunarText || '',
      yinYang: c.naYinLabel || '',
      mingZhu: c.mingZhu || '',
      mingBranch: c.mingBranch || '',
      mingPalaceName: c.mingPalaceName || '',
      shenBranch: c.shenBranch || '',
      shenZhu: c.shenZhu || '',
      shenPalaceName: c.shenPalaceName || '',
      inputClockText: c.inputClockText || '',
      shichenLabel: c.shichenLabel || '',
      timeCorrectionText: c.timeCorrectionText || '',
      clockModeLabel: c.clockModeLabel || '',
      currentDaXianLabel: c.currentDaXianLabel || '',
      currentLiuNianPalaceLabel: c.currentLiuNianPalaceLabel || '',
      solarText: c.solarText || '',
      longitude: c.longitude ?? null,
      qiYunText: c.qiYunText || '',
      daXianDirectionLabel: c.daXianDirectionLabel || '',
      currentYearGanZhiLabel: c.currentYearGanZhiLabel || '',
      age: String(c.currentAgeLabel || age).replace(/岁$/, ''),
      currentYear: new Date().getFullYear(),
      huaSummary: birthHuaSummary,
      daxianHuaSummary,
      liunianHuaSummary
    }
  })

  const chartMeta = computed(() => {
    if (!centerInfo.value) return ''
    return `${centerInfo.value.yearGanzhi}·${centerInfo.value.bureau}·${centerInfo.value.gender}命`
  })

  return { palaceGrid, centerInfo, chartMeta }
}
