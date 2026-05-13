import { MAIN_STARS, PALACE_NAMES } from './compute'

// 吉星
const LUCK_STARS = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存', '天马']
// 煞星
const HARM_STARS = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '天空']
// 四化
const POWER_STARS = ['化禄', '化权', '化科', '化忌']

export type StarType = 'main' | 'luck' | 'power' | 'harm' | 'assist'

export function getStarType(starName: string): StarType {
  if (MAIN_STARS.includes(starName)) return 'main'
  if (LUCK_STARS.includes(starName)) return 'luck'
  if (HARM_STARS.includes(starName)) return 'harm'
  if (POWER_STARS.includes(starName)) return 'power'
  return 'assist'
}

/** Returns Tailwind text color class for a star type */
export function getStarColorClass(starType: string): string {
  const map: Record<string, string> = {
    main: 'text-major-star',
    luck: 'text-success',
    power: 'text-warning',
    harm: 'text-danger',
    assist: 'text-link'
  }
  return map[starType] || 'text-link'
}

/** Returns Tailwind bg/text class pair for 四化 tag */
export function getHuaTagClass(hua: string): string {
  const map: Record<string, string> = {
    禄: 'hua-tag hua-lu',
    权: 'hua-tag hua-quan',
    科: 'hua-tag hua-ke',
    忌: 'hua-tag hua-ji'
  }
  return map[hua] || ''
}

/** Returns Tailwind bg/text class pair for star level badge */
export function getPalaceLevelClass(level: string): string {
  const map: Record<string, string> = {
    庙: 'level-miao',
    旺: 'level-wang',
    得: 'level-de-li',
    利: 'level-li',
    不: 'level-ping',
    不得: 'level-ping',
    平: 'level-ping',
    陷: 'level-xian'
  }
  return map[level] || ''
}

/** Branch name → palace name */
export function getPalaceName(branch: string): string {
  return PALACE_NAMES[branch] || branch
}

/**
 * 4×4 宫格布局顺序
 * 布局:
 * 1.寅(夫妻)  2.卯(子女)  3.辰(财帛)  4.巳(疾厄)
 * 5.子(命宫)   6.[中央]   7.[中央]    8.午(迁移)
 * 9.亥(福德)   10.[中央]  11.[中央]   12.未(仆役)
 * 13.戌(父母) 14.酉(田宅) 15.申(官禄) 16.丑(兄弟)
 */
export const PALACE_ORDER: (string | null)[] = [
  '寅',
  '卯',
  '辰',
  '巳',
  '子',
  null,
  null,
  '午',
  '亥',
  null,
  null,
  '未',
  '戌',
  '酉',
  '申',
  '丑'
]
