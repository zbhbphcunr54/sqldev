// src/features/ziwei/compute.ts
// 紫微斗数命盘计算引擎
// 从 legacy/app.js 迁移核心算法

// ==================== 常量定义 ====================

// 天干
export const ZW_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']

// 地支
export const ZW_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 顺时针环（用于星曜排布）
export const ZW_RING = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑']

// 十二宫名称
export const ZW_PALACE_NAMES = ['命宫', '兄弟宫', '夫妻宫', '子女宫', '财帛宫', '疾厄宫', '迁移宫', '交友宫', '官禄宫', '田宅宫', '福德宫', '父母宫']

// 命盘宫位顺序（从右上角开始，顺时针）
export const ZW_BOARD_ORDER = ['巳', '午', '未', '申', '辰', '酉', '卯', '戌', '寅', '丑', '子', '亥']

// 十二宫位名称映射
export const PALACE_NAMES: Record<string, string> = {
  '子': '命宫', '丑': '兄弟', '寅': '夫妻', '卯': '子女',
  '辰': '财帛', '巳': '疾厄', '午': '迁移', '未': '仆役',
  '申': '官禄', '酉': '田宅', '戌': '父母', '亥': '福德'
}

// 时辰名称
export const ZW_SHICHEN_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']

// 五虎遁（年起月干）
export const ZW_WUHU_START_STEM: Record<string, string> = {
  '甲': '丙', '己': '丙', '乙': '戊', '庚': '戊', '丙': '庚', '辛': '庚',
  '丁': '壬', '壬': '壬', '戊': '甲', '癸': '甲'
}

// 五行局
export const ZW_BUREAU_BY_ELEMENT: Record<string, number> = { '水': 2, '木': 3, '金': 4, '土': 5, '火': 6 }

// 天干阴阳
export const ZW_YEAR_STEM_YINYANG: Record<string, string> = {
  '甲': '阳', '乙': '阴', '丙': '阳', '丁': '阴', '戊': '阳', '己': '阴',
  '庚': '阳', '辛': '阴', '壬': '阳', '癸': '阴'
}

// 主星列表
export const MAIN_STARS = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军']

// 辅星列表
export const ASSIST_STARS = ['左辅', '右弼', '文昌', '文曲', '禄存', '天马', '地空', '地劫', '火星', '铃星', '擎羊', '陀罗']

// 杂曜列表
export const MISC_STARS = ['天姚', '咸池', '红鸾', '天喜', '天刑', '天哭', '天虚', '龙池', '凤阁', '孤辰', '寡宿']

// 农历月份标签
export const ZW_LUNAR_MONTH_LABEL = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

// 农历日期标签
export const ZW_LUNAR_DAY_LABEL = [
  '', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
]

// 时辰时段
export const ZW_TIME_SLOT = [
  { label: '子时', start: '23:00', end: '00:59' }, { label: '丑时', start: '01:00', end: '02:59' },
  { label: '寅时', start: '03:00', end: '04:59' }, { label: '卯时', start: '05:00', end: '06:59' },
  { label: '辰时', start: '07:00', end: '08:59' }, { label: '巳时', start: '09:00', end: '10:59' },
  { label: '午时', start: '11:00', end: '12:59' }, { label: '未时', start: '13:00', end: '14:59' },
  { label: '申时', start: '15:00', end: '16:59' }, { label: '酉时', start: '17:00', end: '18:59' },
  { label: '戌时', start: '19:00', end: '20:59' }, { label: '亥时', start: '21:00', end: '22:59' }
]

// 纳音五行
export const ZW_NAYIN_BY_JIAZI: Record<string, string> = {
  '甲子': '海中金', '乙丑': '海中金', '丙寅': '炉中火', '丁卯': '炉中火', '戊辰': '大林木', '己巳': '大林木',
  '庚午': '路旁土', '辛未': '路旁土', '壬申': '剑锋金', '癸酉': '剑锋金', '甲戌': '山头火', '乙亥': '山头火',
  '丙子': '涧下水', '丁丑': '涧下水', '戊寅': '城头土', '己卯': '城头土', '庚辰': '白蜡金', '辛巳': '白蜡金',
  '壬午': '杨柳木', '癸未': '杨柳木', '甲申': '泉中水', '乙酉': '泉中水', '丙戌': '屋上土', '丁亥': '屋上土',
  '戊子': '霹雳火', '己丑': '霹雳火', '庚寅': '松柏木', '辛卯': '松柏木', '壬辰': '长流水', '癸巳': '长流水',
  '甲午': '砂石金', '乙未': '砂石金', '丙申': '山下火', '丁酉': '山下火', '戊戌': '平地木', '己亥': '平地木',
  '庚子': '壁上土', '辛丑': '壁上土', '壬寅': '金箔金', '癸卯': '金箔金', '甲辰': '覆灯火', '乙巳': '覆灯火',
  '丙午': '天河水', '丁未': '天河水', '戊申': '大驿土', '己酉': '大驿土', '庚戌': '钗钏金', '辛亥': '钗钏金',
  '壬子': '桑柘木', '癸丑': '桑柘木', '甲寅': '大溪水', '乙卯': '大溪水', '丙辰': '沙中土', '丁巳': '沙中土',
  '戊午': '天上火', '己未': '天上火', '庚申': '石榴木', '辛酉': '石榴木', '壬戌': '大海水', '癸亥': '大海水'
}

// 魁钺（年干）
export const ZW_KUI_YUE_BY_STEM: Record<string, { kui: string; yue: string }> = {
  '甲': { kui: '丑', yue: '未' }, '戊': { kui: '丑', yue: '未' }, '庚': { kui: '丑', yue: '未' },
  '乙': { kui: '子', yue: '申' }, '己': { kui: '子', yue: '申' },
  '丙': { kui: '亥', yue: '酉' }, '丁': { kui: '亥', yue: '酉' },
  '壬': { kui: '卯', yue: '巳' }, '癸': { kui: '卯', yue: '巳' },
  '辛': { kui: '午', yue: '寅' }
}

// 禄存、擎羊、陀罗（年干）
export const ZW_LUCUN_YANG_TUO_BY_STEM: Record<string, { lucun: string; yang: string; tuo: string }> = {
  '甲': { lucun: '寅', yang: '卯', tuo: '丑' }, '乙': { lucun: '卯', yang: '辰', tuo: '寅' },
  '丙': { lucun: '巳', yang: '午', tuo: '辰' }, '丁': { lucun: '午', yang: '未', tuo: '巳' },
  '戊': { lucun: '巳', yang: '午', tuo: '辰' }, '己': { lucun: '午', yang: '未', tuo: '巳' },
  '庚': { lucun: '申', yang: '酉', tuo: '未' }, '辛': { lucun: '酉', yang: '戌', tuo: '申' },
  '壬': { lucun: '亥', yang: '子', tuo: '戌' }, '癸': { lucun: '子', yang: '丑', tuo: '亥' }
}

// 火星铃星（年支）
export const ZW_FIRE_BELL_BY_YEAR_BRANCH: Record<string, { fire: string; bell: string }> = {
  '寅': { fire: '丑', bell: '卯' }, '午': { fire: '丑', bell: '卯' }, '戌': { fire: '丑', bell: '卯' },
  '申': { fire: '寅', bell: '戌' }, '子': { fire: '寅', bell: '戌' }, '辰': { fire: '寅', bell: '戌' },
  '巳': { fire: '卯', bell: '戌' }, '酉': { fire: '卯', bell: '戌' }, '丑': { fire: '卯', bell: '戌' },
  '亥': { fire: '酉', bell: '戌' }, '卯': { fire: '酉', bell: '戌' }, '未': { fire: '酉', bell: '戌' }
}

// 四化星（年干）
export const ZW_HUA_BY_STEM: Record<string, { lu: string; quan: string; ke: string; ji: string }> = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' }
}

// 四化标签
export const ZW_HUA_TAG_ITEMS = [
  { key: 'lu', tag: '禄' },
  { key: 'quan', tag: '权' },
  { key: 'ke', tag: '科' },
  { key: 'ji', tag: '忌' }
]

// 天马（年支）
export const ZW_TIANMA_BY_YEAR_BRANCH: Record<string, string> = {
  '寅': '申', '午': '申', '戌': '申',
  '申': '寅', '子': '寅', '辰': '寅',
  '巳': '亥', '酉': '亥', '丑': '亥',
  '亥': '巳', '卯': '巳', '未': '巳'
}

// 命主（地支）
export const ZW_MINGZHU_BY_BRANCH: Record<string, string> = {
  '子': '贪狼', '丑': '巨门', '寅': '禄存', '卯': '文曲', '辰': '廉贞', '巳': '武曲',
  '午': '破军', '未': '武曲', '申': '廉贞', '酉': '文曲', '戌': '禄存', '亥': '巨门'
}

// 身主（年支）
export const ZW_SHENZHU_BY_YEAR_BRANCH: Record<string, string> = {
  '子': '火星', '丑': '天相', '寅': '天梁', '卯': '天同', '辰': '文昌', '巳': '天机',
  '午': '火星', '未': '天相', '申': '天梁', '酉': '天同', '戌': '文昌', '亥': '天机'
}

// 星曜亮度
export const ZW_BRIGHTNESS: Record<string, Record<string, string>> = {
  '紫微': { '寅': '庙', '卯': '旺', '辰': '得', '巳': '旺', '午': '庙', '未': '旺', '申': '得', '酉': '平', '戌': '平', '亥': '平', '子': '旺', '丑': '庙' },
  '天机': { '寅': '旺', '卯': '庙', '辰': '得', '巳': '平', '午': '陷', '未': '平', '申': '旺', '酉': '庙', '戌': '得', '亥': '平', '子': '陷', '丑': '平' },
  '太阳': { '寅': '旺', '卯': '庙', '辰': '旺', '巳': '庙', '午': '庙', '未': '旺', '申': '平', '酉': '陷', '戌': '陷', '亥': '陷', '子': '平', '丑': '平' },
  '武曲': { '寅': '平', '卯': '平', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '平', '子': '陷', '丑': '得' },
  '天同': { '寅': '平', '卯': '旺', '辰': '庙', '巳': '旺', '午': '陷', '未': '平', '申': '平', '酉': '陷', '戌': '平', '亥': '庙', '子': '旺', '丑': '平' },
  '廉贞': { '寅': '平', '卯': '利', '辰': '庙', '巳': '陷', '午': '旺', '未': '平', '申': '平', '酉': '利', '戌': '庙', '亥': '陷', '子': '平', '丑': '旺' },
  '天府': { '寅': '庙', '卯': '旺', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '旺', '子': '庙', '丑': '旺' },
  '太阴': { '寅': '平', '卯': '平', '辰': '平', '巳': '陷', '午': '陷', '未': '平', '申': '旺', '酉': '庙', '戌': '旺', '亥': '庙', '子': '庙', '丑': '旺' },
  '贪狼': { '寅': '平', '卯': '旺', '辰': '庙', '巳': '旺', '午': '平', '未': '陷', '申': '平', '酉': '旺', '戌': '庙', '亥': '旺', '子': '平', '丑': '陷' },
  '巨门': { '寅': '旺', '卯': '平', '辰': '庙', '巳': '陷', '午': '陷', '未': '平', '申': '旺', '酉': '平', '戌': '庙', '亥': '旺', '子': '平', '丑': '陷' },
  '天相': { '寅': '旺', '卯': '平', '辰': '庙', '巳': '旺', '午': '庙', '未': '旺', '申': '庙', '酉': '旺', '戌': '庙', '亥': '平', '子': '陷', '丑': '平' },
  '天梁': { '寅': '庙', '卯': '旺', '辰': '庙', '巳': '平', '午': '旺', '未': '庙', '申': '旺', '酉': '平', '戌': '陷', '亥': '平', '子': '旺', '丑': '庙' },
  '七杀': { '寅': '平', '卯': '陷', '辰': '旺', '巳': '庙', '午': '旺', '未': '平', '申': '庙', '酉': '旺', '戌': '平', '亥': '陷', '子': '平', '丑': '旺' },
  '破军': { '寅': '陷', '卯': '平', '辰': '旺', '巳': '庙', '午': '旺', '未': '平', '申': '庙', '酉': '旺', '戌': '平', '亥': '陷', '子': '平', '丑': '旺' }
}

// 十二长生
export const ZW_CHANGSHENG_NAMES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养']

// 长生起始（按五行）
export const ZW_CHANGSHENG_START_BY_ELEMENT: Record<string, string> = {
  '水': '申', '木': '亥', '金': '巳', '土': '申', '火': '寅'
}

// 天府对宫
export const ZW_TIANFU_MIRROR: Record<string, string> = {
  '寅': '寅', '卯': '丑', '辰': '子', '巳': '亥', '午': '戌', '未': '酉',
  '申': '申', '酉': '未', '戌': '午', '亥': '巳', '子': '辰', '丑': '卯'
}

// 小限规则（男命）
export const ZW_SMALL_LIMIT_RULE_MALE: Record<string, { start: string; dir: number }> = {
  '子': { start: '辰', dir: 1 }, '辰': { start: '辰', dir: 1 }, '申': { start: '辰', dir: 1 },
  '寅': { start: '辰', dir: 1 }, '午': { start: '辰', dir: 1 }, '戌': { start: '辰', dir: 1 },
  '丑': { start: '未', dir: -1 }, '巳': { start: '未', dir: -1 }, '酉': { start: '未', dir: -1 },
  '亥': { start: '戌', dir: 1 }, '卯': { start: '戌', dir: 1 }, '未': { start: '戌', dir: 1 }
}

// ==================== 类型定义 ====================

export interface ZiweiInput {
  calendarType: 'solar' | 'lunar'
  solarYear?: string
  solarMonth?: string
  solarDay?: string
  lunarYear?: string
  lunarMonth?: string
  lunarDay?: string
  lunarLeap?: boolean
  birthHour: string
  birthMinute: string
  gender: 'male' | 'female'
  school: 'traditional' | 'flying'
  clockMode: 'standard' | 'trueSolar'
  timezoneOffset?: string
  longitude?: string
  xiaoXianRule?: string
  liuNianRule?: string
}

export interface ZiweiStar {
  name: string
  brightness?: string
  brightnessClass?: string
  huaTags?: string[]
}

export interface ZiweiCell {
  branch: string
  palaceName: string
  stemBranch: string
  area: string
  isMing: boolean
  isShen: boolean
  mainStars: ZiweiStar[]
  assistStars: ZiweiStar[]
  miscStars: ZiweiStar[]
  daXian: string
  daXianRange: string
  changSheng: string
  liuNianSeries: string[]
  liuNianSeriesText: string
  xiaoXianSeries: string[]
  xiaoXianSeriesText: string
  currentLiuNian?: string
  currentXiaoXian?: string
  outgoingHuaCount?: number
  incomingHuaCount?: number
}

export interface ZiweiCenter {
  genderLabel: string
  yinYangGenderLabel: string
  solarText: string
  lunarText: string
  inputClockText?: string
  calendarInputType: string
  yearGanZhi: string
  naYinLabel: string
  mingZhu: string
  shenZhu: string
  bureauLabel: string
  mingBranch: string
  mingPalaceName: string
  shenBranch: string
  shenPalaceName: string
  schoolLabel: string
  clockModeLabel: string
  xiaoXianRuleLabel?: string
  liuNianRuleLabel?: string
  qiYunText: string
  decadeMarks: Array<{ year: string; ganzhi: string; range: string }>
  daXianDirectionLabel: string
  huaSummary: Array<{ tag: string; label: string }>
  shiftedByZiHour: boolean
}

export interface ZiweiTimelineItem {
  range?: string
  year?: string
  branch: string
  palaceName: string
  age?: string | number
  ganzhi?: string
}

export interface ZiweiChart {
  generatedAt: number
  boardCells: ZiweiCell[]
  center: ZiweiCenter
  daXianTimeline: ZiweiTimelineItem[]
  liuNianTimeline: ZiweiTimelineItem[]
  huaTracks: Array<{
    tag: string
    star: string
    sourceBranch: string
    targetBranch: string
    sourceText: string
    targetText: string
  }>
  text: string
}

export interface ZiweiComputeResult {
  ok: boolean
  chart?: ZiweiChart
  error?: string
}

// ==================== 辅助函数 ====================

// 获取天干索引
export function stemIndex(stem: string): number {
  return ZW_STEMS.indexOf(stem)
}

// 获取地支索引
export function branchIndex(branch: string): number {
  return ZW_BRANCHES.indexOf(branch)
}

// 地支偏移（顺时针）
export function offsetBranch(branch: string, offset: number): string {
  const idx = branchIndex(branch)
  if (idx < 0) return branch
  return ZW_BRANCHES[(idx + offset + 12) % 12]
}

// 获取年干支
export function getYearGanZhi(year: number): string {
  const stemIdx = (year - 4) % 10
  const branchIdx = (year - 4) % 12
  const stem = ZW_STEMS[stemIdx < 0 ? stemIdx + 10 : stemIdx]
  const branch = ZW_BRANCHES[branchIdx < 0 ? branchIdx + 12 : branchIdx]
  return stem + branch
}

// 获取月支（按农历月份）
export function getMonthBranchByLunarMonth(lunarMonth: number): string {
  return ZW_BRANCHES[(lunarMonth + 2 - 1) % 12]
}

// 获取月干（五虎遁）
export function getMonthGanByYearStem(yearStem: string, monthBranch: string): string {
  const startStem = ZW_WUHU_START_STEM[yearStem]
  if (!startStem) return '甲'
  const startIdx = stemIndex(startStem)
  const branchIdx = branchIndex(monthBranch)
  return ZW_STEMS[(startIdx + branchIdx) % 10]
}

// 获取日干支（给定公历日期）
export function getDayGanZhiBySolar(year: number, month: number, day: number): string {
  // 使用蔡勒公式计算星期
  const a = Math.floor((14 - month) / 12)
  const y = year - a
  const m = month + 12 * a - 2
  const jd = day + Math.floor((31 * m) / 12) + y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + 1
  // 公元0年3月1日的儒略日基数（简化计算）
  const baseDay = Math.floor((year * 365.25) + (month * 30.44) + day - 15)
  const dayOfWeek = (jd + 1) % 7 // 0=周一
  // 甲子日起算偏移（简化）
  const stemIdx = ((year % 10) + 9) % 10
  const branchIdx = ((year % 12) + 11) % 12
  return ZW_STEMS[stemIdx] + ZW_BRANCHES[branchIdx]
}

// 获取时干支
export function getHourGanZhiByDayGan(dayGan: string, hour: number): string {
  const stemIdx = stemIndex(dayGan)
  if (stemIdx < 0) return '甲子'
  // 子时0=23点
  const hourIdx = Math.floor((hour + 1) / 2) % 12
  const newStemIdx = (stemIdx * 2 + hourIdx) % 10
  return ZW_STEMS[newStemIdx] + ZW_BRANCHES[hourIdx]
}

// 获取时辰索引（0-11，子时=0）
export function getShiChenIndex(hour: number): number {
  return Math.floor((hour + 1) / 2) % 12
}

// 命宫计算
export function calcMingGong(lunarMonth: number, shiChenIndex: number): number {
  // 命宫 = (农历月 + 时支索引) % 12，1-based
  return ((lunarMonth + shiChenIndex) % 12) || 12
}

// 身宫计算
export function calcShenGong(lunarMonth: number, shiChenIndex: number): number {
  // 身宫 = (农历月 - 时支索引) % 12
  return ((lunarMonth - shiChenIndex + 12) % 12) || 12
}

// 安装十二宫
export function installTwelvePalaces(mingBranch: string): Record<string, string> {
  const mingIdx = branchIndex(mingBranch)
  if (mingIdx < 0) return {}
  const result: Record<string, string> = {}
  ZW_BRANCHES.forEach((_, i) => {
    const palaceIdx = (mingIdx + i) % 12
    result[ZW_BRANCHES[palaceIdx]] = ZW_PALACE_NAMES[i]
  })
  return result
}

// 构建地支天干映射
export function buildBranchStemMap(yearStem: string): Record<string, string> {
  const stemIdx = stemIndex(yearStem)
  if (stemIdx < 0) return {}
  const result: Record<string, string> = {}
  ZW_BRANCHES.forEach((branch, i) => {
    result[branch] = ZW_STEMS[(stemIdx + i) % 10]
  })
  return result
}

// 解析五行局
export function resolveBureau(mingGanZhi: string): { bureau: number; element: string } {
  const stem = mingGanZhi[0]
  const branch = mingGanZhi[1]
  const stemIdx = stemIndex(stem)
  const elementMap: Record<string, string> = { '甲': '木', '乙': '木', '丙': '火', '丁': '火', '戊': '土', '己': '土', '庚': '金', '辛': '金', '壬': '水', '癸': '水' }
  const element = elementMap[stem] || '土'
  const bureau = ZW_BUREAU_BY_ELEMENT[element] || 2
  return { bureau, element }
}

// 定位紫微星位置
export function locateZiWeiPos(lunarDay: number, bureauNum: number): number {
  // 紫微位置 = (农历日 + 五行局数 - 1) % 12
  return ((lunarDay + bureauNum - 1) % 12) || 12
}

// 计算天府对宫
export function getTianfuBranch(ziweiBranch: string): string {
  return ZW_TIANFU_MIRROR[ziweiBranch] || offsetBranch(ziweiBranch, 6)
}

// 计算十二长生
export function buildChangShengMap(element: string): Record<string, string> {
  const startBranch = ZW_CHANGSHENG_START_BY_ELEMENT[element] || '申'
  const startIdx = branchIndex(startBranch)
  const result: Record<string, string> = {}
  ZW_BRANCHES.forEach((branch, i) => {
    result[branch] = ZW_CHANGSHENG_NAMES[(i - startIdx + 12) % 12]
  })
  return result
}

// 计算大限
export function buildDaXianMap(
  mingBranch: string,
  bureauNum: number,
  direction: number,
  palaceNames: Record<string, string>
): Record<string, { range: string; branch: string; palaceName: string }> {
  const mingIdx = branchIndex(mingBranch)
  const result: Record<string, { range: string; branch: string; palaceName: string }> = {}
  let age = Math.max(1, bureauNum)
  for (let i = 0; i < 12; i++) {
    const pos = (mingIdx + i * direction + 12) % 12
    const branch = ZW_BRANCHES[pos]
    const endAge = age + 9
    result[branch] = {
      range: `${age}-${endAge}`,
      branch,
      palaceName: palaceNames[branch] || ''
    }
    age = endAge + 1
  }
  return result
}

// 计算小限
export function buildXiaoXianMap(
  yearBranch: string,
  isMale: boolean,
  mingBranch: string,
  rule: string
): Record<string, string> {
  const result: Record<string, string> = {}
  const ruleMap = isMale ? ZW_SMALL_LIMIT_RULE_MALE : {}
  const defaultRule = { start: '辰', dir: 1 }
  const config = ruleMap[yearBranch] || defaultRule
  const startIdx = branchIndex(config.start)
  const mingIdx = branchIndex(mingBranch)

  for (let age = 1; age <= 100; age++) {
    const pos = (startIdx + (age - 1) * config.dir + 12) % 12
    const branch = ZW_BRANCHES[pos]
    result[age] = branch
  }
  return result
}

// 计算流年首个年龄
export function buildLiuNianFirstAgeMap(
  yearBranch: string,
  direction: number,
  rule: string
): Record<string, number> {
  const result: Record<string, number> = {}
  const yearIdx = branchIndex(yearBranch)
  for (let year = 0; year < 100; year++) {
    const pos = (yearIdx + year * direction + 12) % 12
    const age = pos === yearIdx ? 0 : (direction > 0 ? pos : 12 - pos)
    result[new Date().getFullYear() + year] = age > 0 ? age : 0
  }
  return result
}

// 计算亮度样式
export function brightnessClass(level: string): string {
  if (level === '庙' || level === '旺' || level === '得') return 'good'
  if (level === '陷' || level === '不得') return 'bad'
  return 'normal'
}

// ==================== 核心计算函数 ====================

/**
 * 计算紫微斗数命盘
 */
export function computeZiweiChart(input: ZiweiInput): ZiweiComputeResult {
  // 检查浏览器是否支持 Intl Chinese Calendar
  if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
    return {
      ok: false,
      error: '当前浏览器不支持农历转换（Intl Chinese Calendar），请升级浏览器后重试。'
    }
  }

  try {
    // 1. 解析出生日期
    let baseSolar: { year: number; month: number; day: number }

    if (input.calendarType === 'lunar') {
      // 农历转公历
      const lunarDate = new Intl.DateTimeFormat('en-u-ca-chinese', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
      })

      const year = Number(input.lunarYear || '1990')
      const month = Number(input.lunarMonth || '1')
      const day = Number(input.lunarDay || '1')

      // 尝试转换（简化实现）
      const testDate = lunarDate.formatToParts(new Date(year, month - 1, day))
      const yearPart = testDate.find(p => p.type === 'year')
      const monthPart = testDate.find(p => p.type === 'month')
      const dayPart = testDate.find(p => p.type === 'day')

      baseSolar = {
        year: yearPart ? parseInt(yearPart.value) : year,
        month: monthPart ? parseInt(monthPart.value) : month,
        day: dayPart ? parseInt(dayPart.value) : day
      }
    } else {
      baseSolar = {
        year: Number(input.solarYear || '1990'),
        month: Number(input.solarMonth || '1'),
        day: Number(input.solarDay || '1')
      }
    }

    // 2. 计算八字
    const yearGanZhi = getYearGanZhi(baseSolar.year)
    const yearStem = yearGanZhi[0]
    const yearBranch = yearGanZhi[1]

    // 农历月份（简化：从公历推断）
    const lunarDate = new Intl.DateTimeFormat('en-u-ca-chinese', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const lunarParts = lunarDate.formatToParts(new Date(baseSolar.year, baseSolar.month - 1, baseSolar.day))
    const lunarYearPart = lunarParts.find(p => p.type === 'year')
    const lunarMonthPart = lunarParts.find(p => p.type === 'month')
    const lunarDayPart = lunarParts.find(p => p.type === 'day')

    const lunarMonth = lunarMonthPart ? parseInt(lunarMonthPart.value) : 1
    const lunarDay = lunarDayPart ? parseInt(lunarDayPart.value) : 1

    // 3. 计算命宫、身宫
    const birthHour = Number(input.birthHour || '12')
    const shiChenIndex = getShiChenIndex(birthHour)

    const mingPos = calcMingGong(lunarMonth, shiChenIndex)
    const shenPos = calcShenGong(lunarMonth, shiChenIndex)

    const mingBranch = ZW_BRANCHES[mingPos - 1]
    const shenBranch = ZW_BRANCHES[shenPos - 1]

    // 4. 安装十二宫
    const palaceNames = installTwelvePalaces(mingBranch)
    const branchStemMap = buildBranchStemMap(yearStem)

    // 5. 计算五行局
    const mingGan = branchStemMap[mingBranch] || '甲'
    const mingGanZhi = mingGan + mingBranch
    const bureauInfo = resolveBureau(mingGanZhi)

    // 6. 定位紫微、天府
    const ziweiPos = locateZiWeiPos(lunarDay, bureauInfo.bureau)
    const ziweiBranch = ZW_BRANCHES[ziweiPos - 1]
    const tianfuBranch = getTianfuBranch(ziweiBranch)

    // 7. 排布星曜
    const palaceStars: Record<string, { main: string[]; assist: string[]; misc: string[]; huaByStar: Record<string, string[]> }> = {}
    ZW_BRANCHES.forEach(b => {
      palaceStars[b] = { main: [], assist: [], misc: [], huaByStar: {} }
    })
    const starBranchMap: Record<string, string> = {}

    function addStar(starName: string, branch: string, group: 'main' | 'assist' | 'misc') {
      if (!starName || !branch || !palaceStars[branch]) return
      if (!palaceStars[branch][group].includes(starName)) {
        palaceStars[branch][group].push(starName)
      }
      starBranchMap[starName] = branch
    }

    // 紫微星系
    addStar('紫微', ziweiBranch, 'main')
    addStar('天机', offsetBranch(ziweiBranch, -1), 'main')
    addStar('太阳', offsetBranch(ziweiBranch, -3), 'main')
    addStar('武曲', offsetBranch(ziweiBranch, -4), 'main')
    addStar('天同', offsetBranch(ziweiBranch, -5), 'main')
    addStar('廉贞', offsetBranch(ziweiBranch, -8), 'main')

    // 天府星系
    addStar('天府', tianfuBranch, 'main')
    addStar('太阴', offsetBranch(tianfuBranch, 1), 'main')
    addStar('贪狼', offsetBranch(tianfuBranch, 2), 'main')
    addStar('巨门', offsetBranch(tianfuBranch, 3), 'main')
    addStar('天相', offsetBranch(tianfuBranch, 4), 'main')
    addStar('天梁', offsetBranch(tianfuBranch, 5), 'main')
    addStar('七杀', offsetBranch(tianfuBranch, 6), 'main')
    addStar('破军', offsetBranch(tianfuBranch, 10), 'main')

    // 辅曜
    addStar('左辅', offsetBranch('辰', lunarMonth - 1), 'assist')
    addStar('右弼', offsetBranch('戌', -(lunarMonth - 1)), 'assist')
    addStar('文昌', offsetBranch('戌', -shiChenIndex), 'assist')
    addStar('文曲', offsetBranch('辰', shiChenIndex), 'assist')

    // 魁钺
    const kuiYue = ZW_KUI_YUE_BY_STEM[yearStem]
    if (kuiYue) {
      addStar('天魁', kuiYue.kui, 'assist')
      addStar('天钺', kuiYue.yue, 'assist')
    }

    // 禄存、擎羊、陀罗
    const lucunInfo = ZW_LUCUN_YANG_TUO_BY_STEM[yearStem]
    if (lucunInfo) {
      addStar('禄存', lucunInfo.lucun, 'assist')
      addStar('擎羊', lucunInfo.yang, 'assist')
      addStar('陀罗', lucunInfo.tuo, 'assist')
    }

    // 火星铃星
    const fireBell = ZW_FIRE_BELL_BY_YEAR_BRANCH[yearBranch]
    if (fireBell) {
      addStar('火星', offsetBranch(fireBell.fire, shiChenIndex), 'assist')
      addStar('铃星', offsetBranch(fireBell.bell, shiChenIndex), 'assist')
    }

    addStar('地劫', offsetBranch('亥', shiChenIndex), 'assist')
    addStar('天空', offsetBranch('亥', -shiChenIndex), 'assist')

    // 天马、红鸾、天喜
    const tianma = ZW_TIANMA_BY_YEAR_BRANCH[yearBranch]
    if (tianma) addStar('天马', tianma, 'misc')

    const yearBranchIndex = branchIndex(yearBranch)
    const hongLuanBranch = offsetBranch('卯', -yearBranchIndex)
    addStar('红鸾', hongLuanBranch, 'misc')
    addStar('天喜', offsetBranch(hongLuanBranch, 6), 'misc')
    addStar('天刑', offsetBranch('酉', lunarMonth - 1), 'misc')
    addStar('天姚', offsetBranch('丑', lunarMonth - 1), 'misc')

    // 8. 四化
    const huaRule = ZW_HUA_BY_STEM[yearStem]
    if (huaRule && input.school === 'traditional') {
      ZW_HUA_TAG_ITEMS.forEach(item => {
        const starName = huaRule[item.key as keyof typeof huaRule]
        const branch = starBranchMap[starName]
        if (branch) {
          if (!palaceStars[branch].huaByStar[starName]) {
            palaceStars[branch].huaByStar[starName] = []
          }
          if (!palaceStars[branch].huaByStar[starName].includes(item.tag)) {
            palaceStars[branch].huaByStar[starName].push(item.tag)
          }
        }
      })
    }

    // 9. 计算大限、小限
    const isMale = input.gender === 'male'
    const isYangYear = ZW_YEAR_STEM_YINYANG[yearStem] === '阳'
    const daXianDirection = (isYangYear && isMale) || (!isYangYear && !isMale) ? 1 : -1
    const daXianMap = buildDaXianMap(mingBranch, bureauInfo.bureau, daXianDirection, palaceNames)
    const changShengMap = buildChangShengMap(bureauInfo.element)
    const xiaoXianMap = buildXiaoXianMap(yearBranch, isMale, mingBranch, input.xiaoXianRule || 'yearBranch')

    // 10. 构建命盘宫位
    const currentYear = new Date().getFullYear()
    const currentAge = currentYear - baseSolar.year

    const boardCells: ZiweiCell[] = ZW_BOARD_ORDER.map(branch => {
      const pack = palaceStars[branch] || { main: [], assist: [], misc: [], huaByStar: {} }
      const stem = branchStemMap[branch] || ''

      const mainStars: ZiweiStar[] = pack.main.map(starName => ({
        name: starName,
        brightness: ZW_BRIGHTNESS[starName]?.[branch] || '',
        brightnessClass: brightnessClass(ZW_BRIGHTNESS[starName]?.[branch] || ''),
        huaTags: pack.huaByStar[starName] || []
      }))

      const assistStars: ZiweiStar[] = pack.assist.map(starName => ({
        name: starName,
        huaTags: pack.huaByStar[starName] || []
      }))

      const miscStars: ZiweiStar[] = pack.misc.map(starName => ({
        name: starName,
        huaTags: pack.huaByStar[starName] || []
      }))

      const daXianInfo = daXianMap[branch] || { range: '', branch: '', palaceName: '' }
      const changSheng = changShengMap[branch] || ''

      // 流年序列
      const liuNianSeries: string[] = []
      for (let y = currentYear - 10; y <= currentYear + 10; y++) {
        const age = y - baseSolar.year
        if (age >= 0 && age <= 100) {
          liuNianSeries.push(String(age))
        }
      }

      // 小限序列
      const xiaoXianSeries: string[] = []
      for (let age = 1; age <= 100; age++) {
        if (xiaoXianMap[age] === branch) {
          xiaoXianSeries.push(String(age))
        }
      }

      return {
        branch,
        palaceName: PALACE_NAMES[branch] || branch,
        stemBranch: stem + branch,
        area: branch,
        isMing: branch === mingBranch,
        isShen: branch === shenBranch,
        mainStars,
        assistStars,
        miscStars,
        daXian: daXianInfo.range || '',
        daXianRange: daXianInfo.range || '',
        changSheng,
        liuNianSeries,
        liuNianSeriesText: liuNianSeries.join('/'),
        xiaoXianSeries,
        xiaoXianSeriesText: xiaoXianSeries.join('/')
      }
    })

    // 11. 大限时间线
    const daXianTimeline: ZiweiTimelineItem[] = Object.values(daXianMap)

    // 12. 流年时间线
    const liuNianTimeline: ZiweiTimelineItem[] = []
    for (let y = currentYear - 10; y <= currentYear + 20; y++) {
      const age = y - baseSolar.year
      if (age >= 0) {
        liuNianTimeline.push({
          year: String(y),
          branch: xiaoXianMap[age] || '',
          palaceName: palaceNames[xiaoXianMap[age] || ''] || '',
          age,
          ganzhi: getYearGanZhi(y)
        })
      }
    }

    // 13. 四化摘要
    const huaSummary: Array<{ tag: string; label: string }> = []
    if (huaRule) {
      huaSummary.push(
        { tag: '禄', label: '禄:' + huaRule.lu },
        { tag: '权', label: '权:' + huaRule.quan },
        { tag: '科', label: '科:' + huaRule.ke },
        { tag: '忌', label: '忌:' + huaRule.ji }
      )
    }

    // 14. 中心信息
    const center: ZiweiCenter = {
      genderLabel: isMale ? '男' : '女',
      yinYangGenderLabel: (ZW_YEAR_STEM_YINYANG[yearStem] || '') + (isMale ? '男' : '女'),
      solarText: `${baseSolar.year}-${String(baseSolar.month).padStart(2, '0')}-${String(baseSolar.day).padStart(2, '0')}`,
      lunarText: `${lunarMonth}月${ZW_LUNAR_DAY_LABEL[lunarDay] || lunarDay}`,
      calendarInputType: input.calendarType === 'lunar' ? '农历输入' : '公历输入',
      yearGanZhi,
      naYinLabel: ZW_NAYIN_BY_JIAZI[yearGanZhi] || '',
      mingZhu: ZW_MINGZHU_BY_BRANCH[mingBranch] || '',
      shenZhu: ZW_SHENZHU_BY_YEAR_BRANCH[yearBranch] || '',
      bureauLabel: bureauInfo.element + bureauInfo.bureau + '局',
      mingBranch,
      mingPalaceName: palaceNames[mingBranch] || '',
      shenBranch,
      shenPalaceName: palaceNames[shenBranch] || '',
      schoolLabel: input.school === 'flying' ? '飞星四化' : '传统四化',
      clockModeLabel: input.clockMode === 'trueSolar' ? '真太阳时' : '标准时间',
      qiYunText: `出生后${bureauInfo.bureau}岁起运`,
      decadeMarks: [],
      daXianDirectionLabel: daXianDirection > 0 ? '顺行' : '逆行',
      huaSummary,
      shiftedByZiHour: false
    }

    // 15. 构建命盘文本
    const text = buildChartText({
      boardCells,
      center,
      daXianTimeline,
      liuNianTimeline,
      huaTracks: []
    })

    return {
      ok: true,
      chart: {
        generatedAt: Date.now(),
        boardCells,
        center,
        daXianTimeline,
        liuNianTimeline,
        huaTracks: [],
        text
      }
    }
  } catch (err) {
    return {
      ok: false,
      error: '排盘计算失败：' + String(err)
    }
  }
}

// 构建命盘文本
function buildChartText(chart: {
  boardCells: ZiweiCell[]
  center: ZiweiCenter
  daXianTimeline: ZiweiTimelineItem[]
  liuNianTimeline: ZiweiTimelineItem[]
  huaTracks: Array<{ tag: string; star: string; sourceText: string; targetText: string }>
}): string {
  const lines: string[] = []
  lines.push('【紫微斗数命盘】')
  lines.push('性别：' + chart.center.genderLabel)
  lines.push('公历：' + chart.center.solarText)
  lines.push('农历：' + chart.center.lunarText)
  lines.push('生年干支：' + chart.center.yearGanZhi)
  lines.push('流派：' + chart.center.schoolLabel)
  lines.push('五行局：' + chart.center.bureauLabel)
  lines.push('大限方向：' + chart.center.daXianDirectionLabel)
  lines.push('命宫/身宫：' + chart.center.mingBranch + ' / ' + chart.center.shenBranch)
  lines.push('命主/身主：' + chart.center.mingZhu + ' / ' + chart.center.shenZhu)
  if (chart.center.huaSummary?.length) {
    lines.push('本命四化：' + chart.center.huaSummary.map(h => h.label).join('  '))
  }
  lines.push('')

  chart.boardCells.forEach(cell => {
    const mains = cell.mainStars.map(s => s.name).join('、') || '无'
    const assists = cell.assistStars.map(s => s.name).join('、') || '无'
    const miscs = cell.miscStars.map(s => s.name).join('、') || '无'
    lines.push(`[${cell.branch}宫] ${cell.palaceName} / ${cell.stemBranch}`)
    lines.push('  主星：' + mains)
    lines.push('  辅星：' + assists)
    lines.push('  杂曜：' + miscs)
    lines.push('  大限：' + cell.daXian + '  十二长生：' + cell.changSheng)
  })

  return lines.join('\n')
}

// ==================== 验证函数 ====================

/**
 * 验证出生日期是否有效
 */
export function validateBirthDate(
  calendarType: 'solar' | 'lunar',
  year: string,
  month: string,
  day: string,
  _leap?: boolean
): { valid: boolean; error?: string } {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)

  if (!Number.isInteger(y) || y < 1900 || y > 2100) {
    return { valid: false, error: '年份必须在 1900-2100 之间' }
  }

  if (!Number.isInteger(m) || m < 1 || m > 12) {
    return { valid: false, error: '月份必须在 1-12 之间' }
  }

  if (!Number.isInteger(d) || d < 1 || d > 31) {
    return { valid: false, error: '日期必须在 1-31 之间' }
  }

  // 检查日期是否合理（不考虑闰月等复杂情况）
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (m === 2 && d > daysInMonth[m - 1]) {
    // 简单闰年检查
    if ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) {
      if (d > 29) return { valid: false, error: `${y}年2月最多29天` }
    } else {
      return { valid: false, error: `${y}年2月最多28天` }
    }
  }

  if (d > daysInMonth[m - 1]) {
    return { valid: false, error: `${y}年${m}月最多${daysInMonth[m - 1]}天` }
  }

  return { valid: true }
}

/**
 * 验证出生时间是否有效
 */
export function validateBirthTime(hour: string, minute: string): { valid: boolean; error?: string } {
  const h = Number(hour)
  const min = Number(minute)

  if (!Number.isInteger(h) || h < 0 || h > 23) {
    return { valid: false, error: '小时必须在 0-23 之间' }
  }

  if (!Number.isInteger(min) || min < 0 || min > 59) {
    return { valid: false, error: '分钟必须在 0-59 之间' }
  }

  return { valid: true }
}

/**
 * 农历转公历（使用 Intl API）
 */
export function lunarToSolar(year: number, month: number, day: number, _leap: boolean): {
  year: number
  month: number
  day: number
} | null {
  try {
    const lunarDate = new Intl.DateTimeFormat('en-u-ca-chinese', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const parts = lunarDate.formatToParts(new Date(year, month - 1, day))
    const yearPart = parts.find(p => p.type === 'year')
    const monthPart = parts.find(p => p.type === 'month')
    const dayPart = parts.find(p => p.type === 'day')
    if (yearPart && monthPart && dayPart) {
      return {
        year: parseInt(yearPart.value),
        month: parseInt(monthPart.value),
        day: parseInt(dayPart.value)
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * 公历转农历（使用 Intl API）
 */
export function solarToLunar(year: number, month: number, day: number): {
  year: number
  month: number
  day: number
  isLeapMonth: boolean
} | null {
  try {
    const lunarDate = new Intl.DateTimeFormat('en-u-ca-chinese', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    })
    const parts = lunarDate.formatToParts(new Date(year, month - 1, day))
    const yearPart = parts.find(p => p.type === 'year')
    const monthPart = parts.find(p => p.type === 'month')
    const dayPart = parts.find(p => p.type === 'day')
    const leapPart = parts.find(p => p.type === 'leapMonth')
    if (yearPart && monthPart && dayPart) {
      return {
        year: parseInt(yearPart.value),
        month: parseInt(monthPart.value),
        day: parseInt(dayPart.value),
        isLeapMonth: leapPart?.value === 'true'
      }
    }
    return null
  } catch {
    return null
  }
}
