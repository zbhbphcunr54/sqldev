<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useZiweiForm } from '@/composables/useZiweiForm'
import { useZiweiAI } from '@/composables/useZiweiAI'
import { useZiweiChart } from '@/composables/useZiweiChart'
import { UI_LABELS } from '@/features/ziwei/ui-constants'
import { getPalaceLevelClass, getHuaTagClass } from '@/features/ziwei/star-classifier'
import FormSelect from '@/components/common/FormSelect.vue'
import SharePosterModal from '../modals/SharePosterModal.vue'

/* ---------- 移动端 Tab 切换 ---------- */
const mobileTab = ref<'input' | 'chart' | 'analysis' | 'qa'>('input')
const aiReadingTab = ref<'analysis' | 'qa'>('analysis')
const showSharePoster = ref(false)
const mobileActivePalaceIndex = ref<number | null>(null)
const analysisScrollRef = ref<HTMLElement | null>(null)
const activeAnalysisCardIdx = ref(0)
const qaScrollRef = ref<HTMLElement | null>(null)
const activeQaCardIdx = ref(0)
const {
  calendarType,
  solarYear,
  solarMonth,
  solarDay,
  lunarYear,
  lunarMonth,
  lunarDay,
  birthHour,
  birthMinute,
  birthShiChen,
  gender,
  birthProvince,
  birthCity,
  profileName,
  school,
  showUserMenu,
  generating,
  status,
  chart,
  correctionText,
  shiChenCorrectionNotice,
  yearFormOptions,
  solarMonthOptions,
  solarDayOptions,
  solarHourOptions,
  minuteOptions,
  lunarMonthOptions,
  lunarDayOptions,
  birthShiChenOptions,
  provinceOptions,
  cityOptions,
  selectedLongitudeText,
  calendarTypeOptions,
  toggleUserMenu,
  closeUserMenu,
  clearChart: resetChart,
  handleGenerate: runGenerate
} = useZiweiForm()

const {
  aiLoading,
  aiError,
  aiAnalysisReady,
  aiStreamingText,
  aiResult,
  aiQuestionInput,
  aiQuestionLoading,
  aiQuestionStreaming,
  aiQuestionAnswer,
  aiQuestionError,
  lastAiQuestion,
  currentStep,
  aiButtonLabel,
  clearAiState,
  handleAiAnalysis: runAiAnalysis,
  handleAiQuestion: runAiQuestion
} = useZiweiAI(chart, profileName, gender, school)

const { palaceGrid, centerInfo, chartMeta } = useZiweiChart(chart, calendarType, solarYear, lunarYear)

const stepLabels = [UI_LABELS.STEP_1, UI_LABELS.STEP_2, UI_LABELS.STEP_3]
const analysisSectionIconClasses = [
  'zw-analysis-icon--star',
  'zw-analysis-icon--triangle',
  'zw-analysis-icon--diamond',
  'zw-analysis-icon--sun',
  'zw-analysis-icon--spark',
  'zw-analysis-icon--moon'
]
const analysisSectionColorClasses = [
  'zw-analysis-section-title--blue',
  'zw-analysis-section-title--orange',
  'zw-analysis-section-title--green',
  'zw-analysis-section-title--purple',
  'zw-analysis-section-title--red',
  'zw-analysis-section-title--gold'
]
const analysisCardToneClasses = [
  'zw-analysis-card--tone-blue',
  'zw-analysis-card--tone-orange',
  'zw-analysis-card--tone-green',
  'zw-analysis-card--tone-purple',
  'zw-analysis-card--tone-red',
  'zw-analysis-card--tone-gold'
]

function compactSummaryText(items: Array<{ label: string }>, limit = 2): string {
  if (!items.length) return '--'
  const visible = items.slice(0, limit).map((item) => item.label)
  const extra = items.length - visible.length
  return extra > 0 ? `${visible.join('、')} 等${items.length}项` : visible.join('、')
}

function compactTextList(items: string[], limit = 3): string {
  if (!items.length) return '无'
  const visible = items.slice(0, limit)
  return items.length > limit ? `${visible.join('、')} 等${items.length}项` : visible.join('、')
}

function formatMainStarText(stars: Array<{ name: string; level?: string }>): string {
  return compactTextList(
    stars.map((star) => (star.level ? `${star.name}[${star.level}]` : star.name))
  )
}

function formatStarNameText(stars: Array<{ name: string }>): string {
  return compactTextList(stars.map((star) => star.name))
}

function parseHuaPills(items: Array<{ tag: string; label: string }>): Array<{ text: string; tag: string }> {
  return items.map((item) => {
    const dashIdx = item.label.indexOf('—')
    const arrowIdx = item.label.indexOf('→')
    const starName = dashIdx >= 0 && arrowIdx > dashIdx ? item.label.slice(dashIdx + 1, arrowIdx) : ''
    return { text: starName ? `${starName}${item.tag}` : item.label, tag: item.tag }
  })
}

function formatBirthHuaText(items: Array<{ label: string }>): string {
  return compactTextList(items.map((item) => item.label), 3)
}

function formatTransitHuaText(items: Array<{ star: string; type: string }>): string {
  return compactTextList(items.map((item) => `${item.star}${item.type}`), 3)
}

function getAnalysisSectionIconClass(index: number): string {
  return analysisSectionIconClasses[index % analysisSectionIconClasses.length]
}

function getAnalysisSectionTitleClass(index: number): string {
  return analysisSectionColorClasses[index % analysisSectionColorClasses.length]
}

function getAnalysisSectionToneClass(index: number): string {
  return analysisCardToneClasses[index % analysisCardToneClasses.length]
}

type DisplayTextLine = {
  label: string
  body: string
}

function splitDisplayText(text: string): DisplayTextLine[] {
  const raw = String(text || '')
  if (!raw.trim()) return []

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^：:\n]{2,24})[：:]\s*(.+)$/)
      if (match) {
        const label = match[1].trim()
        const body = match[2].trim()
        if (label && body && !/[，。；！？,.!?]/.test(label)) {
          return { label, body }
        }
      }

      return {
        label: '',
        body: line
      }
    })
}

function normalizeQaAnswerText(text: string): string {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .trim()
}

function toQaCardTitle(rawTitle: string, index: number): string {
  const title = rawTitle
    .replace(/^#{1,6}\s*/, '')
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/[:：]$/, '')
    .trim()

  return title || `问答要点 ${index + 1}`
}

function compactQaText(text: string): string {
  return normalizeQaAnswerText(text)
    .replace(/[：:]/g, '')
    .replace(/[，。！？；、,.!?;()[\]{}【】「」"'`~\-—_]/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function hasMeaningfulQaBody(body: string, title = ''): boolean {
  const compactBody = compactQaText(body)
  if (!compactBody) return false

  const compactTitle = compactQaText(title)
  if (compactTitle && compactBody === compactTitle) return false

  return true
}

function isStandaloneQaLabel(text: string): boolean {
  const normalized = normalizeQaAnswerText(text).replace(/[：:]/g, '').trim()
  if (!normalized) return false

  return /^(核心结论|总体判断|整体判断|核心性格|命盘证据|事业|财运|感情|婚姻|健康|学业|人际|家庭|时机|建议|提醒|风险|方向|结论|总结|补充)$/.test(normalized)
}

function splitInlineQaSections(text: string): Array<{ title: string; body: string }> {
  const normalized = normalizeQaAnswerText(text)
  if (!normalized) return []

  const markers = [
    '核心结论',
    '总体判断',
    '整体判断',
    '核心性格',
    '命盘证据',
    '事业',
    '财运',
    '感情',
    '婚姻',
    '健康',
    '学业',
    '人际',
    '家庭',
    '时机',
    '建议',
    '提醒',
    '风险',
    '方向',
    '结论'
  ]
  const markerPattern = new RegExp(`(${markers.join('|')})[:：]`, 'g')
  const matches = Array.from(normalized.matchAll(markerPattern))
  if (matches.length < 2) return []

  return matches
    .map((match, index) => {
      const start = match.index ?? 0
      const end = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length
      const chunk = normalized.slice(start, end).trim()
      const separatorIndex = chunk.search(/[:：]/)
      if (separatorIndex <= 0) return null

      return {
        title: toQaCardTitle(chunk.slice(0, separatorIndex), index),
        body: chunk.slice(separatorIndex + 1).trim()
      }
    })
    .filter((item): item is { title: string; body: string } => Boolean(item?.body))
    .filter((item) => hasMeaningfulQaBody(item.body, item.title))
}

function parseQaBlockAsCards(block: string, index: number): Array<{ title: string; body: string }> {
  const inlineCards = splitInlineQaSections(block)
  if (inlineCards.length > 1) {
    return inlineCards
  }

  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const firstLine = lines[0] || ''
  const rest = lines.slice(1).join('\n').trim()
  const separatorIndex = firstLine.search(/[:：]/)
  const hasInlinePair = separatorIndex > 0

  if (hasInlinePair) {
    const title = toQaCardTitle(firstLine.slice(0, separatorIndex), index)
    const firstLineBody = firstLine.slice(separatorIndex + 1).trim()
    const body = [firstLineBody, rest].filter(Boolean).join('\n').trim()
    return hasMeaningfulQaBody(body, title)
      ? [{
          title,
          body
        }]
      : []
  }

  const hasStandaloneTitleHint =
    lines.length > 1 &&
    (
      firstLine.length <= 18 ||
      /建议|结论|提醒|重点|事业|财运|感情|健康|时间|原因|方向|命盘证据/.test(firstLine)
    )

  if (hasStandaloneTitleHint) {
    const title = toQaCardTitle(firstLine, index)
    return hasMeaningfulQaBody(rest, title)
      ? [{
          title,
          body: rest
        }]
      : []
  }

  if (lines.length === 1 && isStandaloneQaLabel(firstLine)) {
    return []
  }

  return hasMeaningfulQaBody(block)
    ? [{
        title: `问答要点 ${index + 1}`,
        body: block.trim()
      }]
    : []
}

function parseQaStreamingTailCard(block: string, index: number): { title: string; body: string } | null {
  const lines = block
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const firstLine = lines[0] || ''
  const rest = lines.slice(1).join('\n').trim()
  const separatorIndex = firstLine.search(/[:：]/)
  const hasInlinePair = separatorIndex > 0

  if (hasInlinePair) {
    const title = toQaCardTitle(firstLine.slice(0, separatorIndex), index)
    const firstLineBody = firstLine.slice(separatorIndex + 1).trim()
    const body = [firstLineBody, rest].filter(Boolean).join('\n').trim()
    return hasMeaningfulQaBody(body, title) ? { title, body } : null
  }

  const hasStandaloneTitleHint =
    lines.length > 1 &&
    (
      firstLine.length <= 18 ||
      /建议|结论|提醒|重点|事业|财运|感情|健康|时间|原因|方向|命盘证据/.test(firstLine)
    )

  if (hasStandaloneTitleHint) {
    const title = toQaCardTitle(firstLine, index)
    return hasMeaningfulQaBody(rest, title) ? { title, body: rest } : null
  }

  if (lines.length === 1 && isStandaloneQaLabel(firstLine)) {
    return null
  }

  return hasMeaningfulQaBody(block)
    ? {
        title: `问答要点 ${index + 1}`,
        body: block.trim()
      }
    : null
}

function splitQaAnswerCards(text: string, streaming = false): Array<{ title: string; body: string }> {
  const sections = splitQuestionBlocks(text)
  if (!sections.length) return []

  if (!streaming) {
    return sections
      .flatMap((block, index) => parseQaBlockAsCards(block, index))
      .filter((item) => hasMeaningfulQaBody(item.body, item.title))
      .filter((item) => !isGenericQaFallbackTitle(item.title))
  }

  const stableBlocks = sections.slice(0, -1)
  const stableCards = stableBlocks
    .flatMap((block, index) => parseQaBlockAsCards(block, index))
    .filter((item) => hasMeaningfulQaBody(item.body, item.title))

  const tailBlock = sections[sections.length - 1]
  const tailCard = tailBlock ? parseQaStreamingTailCard(tailBlock, stableCards.length) : null

  return (tailCard ? [...stableCards, tailCard] : stableCards)
    .filter((item) => !isGenericQaFallbackTitle(item.title))
}

function splitQuestionBlocks(text: string): string[] {
  const normalized = normalizeQaAnswerText(text)
  if (!normalized) return []
  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
}

function isGenericQaFallbackTitle(title: string): boolean {
  return /^问答要点\s*\d+$/.test(normalizeQaAnswerText(title))
}

const qaAnswerCards = computed(() => splitQaAnswerCards(aiQuestionAnswer.value, aiQuestionStreaming))

function isQaLeadTitle(title: string): boolean {
  const normalized = normalizeQaAnswerText(title).replace(/[：:\s]/g, '')
  return /^(问题判断|核心判断|核心结论|总体判断|整体判断|结论|总结)$/.test(normalized)
}

const qaLeadCard = computed(() => {
  const cards = qaAnswerCards.value
  if (!cards.length) return null

  const leadCandidates = cards.filter((card) => isQaLeadTitle(card.title))
  if (!leadCandidates.length) return cards[0]

  const mergedBodies = leadCandidates
    .map((card) => card.body.trim())
    .filter(Boolean)
    .filter((body, idx, list) => list.indexOf(body) === idx)

  return {
    title: leadCandidates[0].title,
    body: mergedBodies.join('\n\n').trim()
  }
})

const qaFollowCards = computed(() => {
  const cards = qaAnswerCards.value
  if (!cards.length) return []

  const hasExplicitLead = cards.some((card) => isQaLeadTitle(card.title))
  if (hasExplicitLead) {
    return cards.filter((card) => !isQaLeadTitle(card.title))
  }

  return cards.slice(1)
})
const hasYearFocus = computed(() => {
  const summary = aiResult.value?.yearFocus?.summary?.trim()
  return Boolean(summary)
})
const hasNextActions = computed(() => (aiResult.value?.nextActions?.length ?? 0) > 0)
const showDeferredAnalysisCards = computed(() => Boolean(aiResult.value) && !aiLoading.value)
const analysisDisclaimer = computed(
  () => aiResult.value?.disclaimer?.trim() || UI_LABELS.AI_DISCLAIMER
)

function hasItems(items?: string[]): boolean {
  return Array.isArray(items) && items.length > 0
}

function shouldSpanFullWidth(index: number, total: number): boolean {
  return total % 2 === 1 && index === total - 1
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

const mobilePalaceCells = computed(() => palaceGrid.value.filter(isPresent))

const activeMobilePalace = computed(() => {
  if (mobileActivePalaceIndex.value === null) return null
  return mobilePalaceCells.value[mobileActivePalaceIndex.value] ?? null
})

const mobileChartHighlights = computed(() => [
  { label: '命主', value: centerInfo.value?.mingZhu || '--' },
  { label: '身主', value: centerInfo.value?.shenZhu || '--' },
  { label: '五行局', value: centerInfo.value?.bureau || '--' },
  { label: '当前大限', value: centerInfo.value?.currentDaXianLabel || '--' },
  { label: '流年', value: centerInfo.value?.currentYearGanZhiLabel || '--' },
  { label: '虚岁', value: centerInfo.value?.age ? `${centerInfo.value.age}岁` : '--' }
])

const mobileChartHuaFacts = computed(() => [
  { label: '生年四化', value: compactSummaryText(centerInfo.value?.huaSummary || [], 3) },
  { label: '大限四化', value: compactSummaryText(centerInfo.value?.daxianHuaSummary || [], 3) },
  { label: '流年四化', value: compactSummaryText(centerInfo.value?.liunianHuaSummary || [], 3) }
])

const qaSuggestions = [
  '我的事业运势如何？',
  '今年适合跳槽吗？',
  '感情方面有什么建议？',
  '我的财运怎么样？'
]

const mobileCenterLiunian = computed(() => [
  { label: '当前大限', value: centerInfo.value?.currentDaXianLabel || '--' },
  { label: '流年干支', value: centerInfo.value?.currentYearGanZhiLabel || '--' },
  { label: '流年命宫', value: centerInfo.value?.currentLiuNianPalaceLabel || '--' },
  { label: '虚岁', value: centerInfo.value?.age ? `${centerInfo.value.age}岁` : '--' }
])

const mobileCenterBasicInfo = computed(() => [
  { label: '性别', value: centerInfo.value?.gender ? `${centerInfo.value.gender}命` : '--' },
  { label: '农历', value: centerInfo.value?.lunar || '--' },
  { label: '公历', value: centerInfo.value?.solarText || '--' },
  { label: '时辰', value: centerInfo.value?.shichenLabel || '--' },
  { label: '出生地', value: (birthProvince.value && birthCity.value) ? `${birthProvince.value} ${birthCity.value}` : '--' }
])

const mobileChartYaosu = computed(() => [
  { label: '命主', value: centerInfo.value?.mingZhu || '--', colorClass: 'zw-yaosu-k--accent' },
  { label: '身主', value: centerInfo.value?.shenZhu || '--', colorClass: 'zw-yaosu-k--accent' },
  { label: '五行局', value: centerInfo.value?.bureau || '--', colorClass: 'zw-yaosu-k--major' },
  { label: '命宫', value: centerInfo.value?.mingBranch
    ? `${centerInfo.value.mingBranch}${centerInfo.value.mingPalaceName ? '（' + centerInfo.value.mingPalaceName + '）' : ''}`
    : '--', colorClass: 'zw-yaosu-k--hua' },
  { label: '身宫', value: centerInfo.value?.shenBranch
    ? `${centerInfo.value.shenBranch}${centerInfo.value.shenPalaceName ? '（' + centerInfo.value.shenPalaceName + '）' : ''}`
    : '--', colorClass: 'zw-yaosu-k--hua' },
  { label: '起运', value: centerInfo.value?.qiYunText || '--', colorClass: 'zw-yaosu-k--liunian' },
  { label: '大限', value: centerInfo.value?.daXianDirectionLabel || '--', colorClass: 'zw-yaosu-k--liunian' }
])

const mobileAnalysisEntries = computed(() => {
  const entries: Array<{
    id: string
    title: string
    summary: string
    kind: 'section' | 'yearFocus' | 'actions'
    indexLabel: string
    iconClass: string
    titleClass: string
    toneClass: string
    evidence?: string[]
    advice?: string[]
    opportunities?: string[]
    risks?: string[]
    actions?: string[]
  }> = []

  aiResult.value?.sections.forEach((section, idx) => {
    entries.push({
      id: `section-${idx}`,
      title: section.title,
      summary: section.summary,
      kind: 'section',
      indexLabel: `0${idx + 1}`,
      iconClass: getAnalysisSectionIconClass(idx),
      titleClass: getAnalysisSectionTitleClass(idx),
      toneClass: getAnalysisSectionToneClass(idx),
      evidence: section.evidence,
      advice: section.advice
    })
  })

  if (hasYearFocus.value) {
    entries.push({
      id: 'year-focus',
      title: '当前阶段重点',
      summary: aiResult.value?.yearFocus?.summary || '',
      kind: 'yearFocus',
      indexLabel: 'YR',
      iconClass: 'zw-analysis-icon--moon',
      titleClass: 'zw-analysis-section-title--purple',
      toneClass: 'zw-analysis-card--tone-purple',
      opportunities: aiResult.value?.yearFocus?.opportunities,
      risks: aiResult.value?.yearFocus?.risks
    })
  }

  if (hasNextActions.value) {
    entries.push({
      id: 'next-actions',
      title: '接下来怎么做',
      summary: '',
      kind: 'actions',
      indexLabel: 'DO',
      iconClass: 'zw-analysis-icon--spark',
      titleClass: 'zw-analysis-section-title--green',
      toneClass: 'zw-analysis-card--tone-green',
      actions: aiResult.value?.nextActions
    })
  }

  return entries
})

const mobileQaFlowBlocks = computed(() => {
  const blocks: Array<{
    id: string
    title: string
    body: string
    indexLabel: string
    toneClass: string
    titleClass: string
    iconClass: string
  }> = []

  if (qaLeadCard.value) {
    blocks.push({
      id: 'qa-lead',
      title: qaLeadCard.value.title || '问题判断',
      body: qaLeadCard.value.body,
      indexLabel: 'A1',
      toneClass: 'zw-analysis-card--tone-blue',
      titleClass: 'zw-analysis-section-title--blue',
      iconClass: 'zw-analysis-icon--chat'
    })
  }

  qaFollowCards.value.forEach((card, idx) => {
    const offset = idx + (qaLeadCard.value ? 2 : 1)
    blocks.push({
      id: `qa-follow-${idx}`,
      title: card.title,
      body: card.body,
      indexLabel: `A${offset}`,
      toneClass: getAnalysisSectionToneClass(idx + 2),
      titleClass: getAnalysisSectionTitleClass(idx + 2),
      iconClass: getAnalysisSectionIconClass(idx + 2)
    })
  })

  if (!qaLeadCard.value && aiQuestionStreaming.value && aiQuestionAnswer.value) {
    blocks.push({
      id: 'qa-stream',
      title: '问题判断',
      body: aiQuestionAnswer.value,
      indexLabel: 'A1',
      toneClass: 'zw-analysis-card--tone-blue',
      titleClass: 'zw-analysis-section-title--blue',
      iconClass: 'zw-analysis-icon--chat'
    })
  }

  return blocks
})

const analysisNavTags = computed(() => {
  const tags: Array<{ id: string; label: string }> = []
  if (aiResult.value?.overview) tags.push({ id: 'overview', label: '总体结论' })
  mobileAnalysisEntries.value.forEach(e => {
    tags.push({ id: e.id, label: e.title.length > 4 ? e.title.slice(0, 4) : e.title })
  })
  return tags
})

const qaNavTags = computed(() =>
  mobileQaFlowBlocks.value.map(b => ({
    id: b.id,
    label: b.title.length > 4 ? b.title.slice(0, 4) : b.title
  }))
)

function scrollToAnalysisCard(idx: number): void {
  const container = analysisScrollRef.value
  if (!container) return
  const card = container.children[idx] as HTMLElement
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  activeAnalysisCardIdx.value = idx
}

function onAnalysisScroll(): void {
  const container = analysisScrollRef.value
  if (!container || !container.children.length) return
  const scrollLeft = container.scrollLeft
  const cardWidth = (container.children[0] as HTMLElement)?.offsetWidth || 1
  activeAnalysisCardIdx.value = Math.round(scrollLeft / (cardWidth + 8))
}

function scrollToQaCard(idx: number): void {
  const container = qaScrollRef.value
  if (!container) return
  const card = container.children[idx] as HTMLElement
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  activeQaCardIdx.value = idx
}

function onQaScroll(): void {
  const container = qaScrollRef.value
  if (!container || !container.children.length) return
  const scrollLeft = container.scrollLeft
  const cardWidth = (container.children[0] as HTMLElement)?.offsetWidth || 1
  activeQaCardIdx.value = Math.round(scrollLeft / (cardWidth + 8))
}

watch(
  () => mobilePalaceCells.value.length,
  (length) => {
    if (mobileActivePalaceIndex.value !== null && mobileActivePalaceIndex.value >= length) {
      mobileActivePalaceIndex.value = null
    }
  }
)

watch(
  () => mobileTab.value,
  (tab) => {
    if (tab !== 'chart') {
      mobileActivePalaceIndex.value = null
    }
  }
)

function openMobilePalace(index: number): void {
  mobileActivePalaceIndex.value = index
}

function closeMobilePalace(): void {
  mobileActivePalaceIndex.value = null
}

function openMobilePalaceByBranch(branch: string): void {
  const idx = mobilePalaceCells.value.findIndex(c => c.branch === branch)
  if (idx >= 0) openMobilePalace(idx)
}

function handleClearChart(): void {
  resetChart()
  clearAiState()
  mobileTab.value = 'chart'
}

async function handleGenerate(): Promise<void> {
  await runGenerate()
  if (chart.value) {
    mobileTab.value = 'chart'
  }
}

function showChartView(): void {
  mobileTab.value = 'chart'
}

function showAnalysisView(): void {
  mobileTab.value = 'analysis'
  aiReadingTab.value = 'analysis'
}

function showQaView(): void {
  mobileTab.value = 'qa'
  aiReadingTab.value = 'qa'
}

async function handleAiAnalysis(): Promise<void> {
  if (!chart.value) return
  mobileTab.value = 'analysis'
  aiReadingTab.value = 'analysis'
  await runAiAnalysis()
}

async function handleAiQuestion(): Promise<void> {
  mobileTab.value = 'qa'
  aiReadingTab.value = 'qa'
  await runAiQuestion()
}

</script>

<template>
  <div class="flex flex-col min-h-full min-h-dvh bg-bg text-text">
    <!-- 椤堕儴瀵艰埅鏍?-->
    <header
      class="flex items-center justify-between shrink-0 px-6 ziwei-header bg-panel"
    >
      <div class="flex items-center gap-3">
        <div class="hidden lg:flex items-center justify-center w-10 h-10 rounded-lg bg-accentBg text-accent">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" />
            <path
              d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22"
              stroke="currentColor"
              stroke-width="2"
            />
            <path
              d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12"
              stroke="currentColor"
              stroke-width="2"
            />
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
          </svg>
        </div>
        <div class="flex flex-col gap-0.5">
          <h1 class="text-base font-semibold text-text">{{ UI_LABELS.PAGE_TITLE }}</h1>
          <span class="text-xs text-subtle">{{ UI_LABELS.PAGE_SUBTITLE }}</span>
        </div>
      </div>
      <div class="hidden lg:flex items-center gap-2">
        <div class="relative">
          <button
            class="flex items-center justify-center w-9 h-9 rounded-md bg-transparent text-subtle hover:text-text transition-apple"
            aria-label="用户菜单"
            @click="toggleUserMenu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="6" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
          <Transition name="fade">
            <div
              v-if="showUserMenu"
              class="absolute top-full mt-2 right-0 w-60 bg-panel border border-border rounded-lg z-[100] overflow-hidden"
              style="box-shadow: 0 8px 24px var(--color-overlay)"
              @click.stop
            >
              <div class="flex items-center gap-3 px-4 py-3.5">
                <div
                  class="flex items-center justify-center w-10 h-10 rounded-full bg-accentBg text-accent"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2" />
                    <path
                      d="M4 20C4 16.6863 7.58172 14 12 14C16.4183 14 20 16.6863 20 20"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-sm font-medium text-text">{{ UI_LABELS.USER_NAME }}</span>
                  <span class="text-xs text-subtle">{{ UI_LABELS.USER_EMAIL }}</span>
                </div>
              </div>
              <div class="h-px bg-border"></div>
              <button
                class="flex items-center gap-2.5 w-full px-4 py-2.5 bg-transparent border-none text-sm text-text text-left cursor-pointer hover:bg-accentBg/50 transition-colors duration-150"
                tabindex="0"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M16 17L21 12L16 7M21 12H9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span>{{ UI_LABELS.MENU_LOGOUT }}</span>
              </button>
            </div>
          </Transition>
          <div v-if="showUserMenu" class="fixed inset-0 z-[99]" @click="closeUserMenu"></div>
        </div>
      </div>
    </header>

    <!-- 绉诲姩绔?Tab 鏍?-->
    <nav class="zw-mobile-tab-bar lg:hidden">
      <button
        class="zw-mobile-tab-btn"
        :class="{ 'zw-mobile-tab-btn--active': mobileTab === 'input' }"
        @click="mobileTab = 'input'"
      >
        输入
      </button>
      <button
        class="zw-mobile-tab-btn"
        :class="{ 'zw-mobile-tab-btn--active': mobileTab === 'chart' }"
        @click="mobileTab = 'chart'"
      >
        命盘
      </button>
      <button
        class="zw-mobile-tab-btn"
        :class="{ 'zw-mobile-tab-btn--active': mobileTab === 'analysis' }"
        @click="showAnalysisView"
      >
        AI解读
      </button>
      <button
        class="zw-mobile-tab-btn"
        :class="{ 'zw-mobile-tab-btn--active': mobileTab === 'qa' }"
        @click="showQaView"
      >
        问答
      </button>
    </nav>

    <!-- 主内容区 -->
    <main class="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr] overflow-hidden zw-main-grid">
      <!-- 左栏：输入面板 -->
      <aside
        class="flex-col p-4 bg-panel lg:border-r lg:border-border overflow-y-auto"
        :class="mobileTab === 'input' ? 'flex' : 'hidden lg:flex'"
      >
        <div class="zw-action-row mb-3">
          <button class="btn-primary zw-generate-btn" :disabled="generating" @click="handleGenerate">
            {{ UI_LABELS.BTN_GENERATE }}
          </button>
          <button
            class="ziwei-btn-outline zw-clear-btn"
            :disabled="!chart && !aiResult"
            @click="handleClearChart"
          >
            清除
          </button>
          <button
            class="ziwei-btn-outline zw-share-btn gap-1 text-xs"
            @click="showSharePoster = true"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <rect x="8" y="14" width="8" height="8" rx="1" stroke="currentColor" stroke-width="2" />
              <path d="M16 10V18M16 18L12 14M16 18L20 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M8 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H16C17.1046 20 18 19.1046 18 18V16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
            {{ UI_LABELS.BTN_SHARE }}
          </button>
        </div>

        <!-- 姝ラ鎸囧紩 -->
        <div class="zw-step-card zw-step-section flex items-center justify-between p-3 bg-bg rounded-lg mb-4">
          <template v-for="(label, idx) in stepLabels" :key="'step-' + idx">
            <div class="zw-step-item flex flex-col items-center gap-1">
              <span
                class="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold transition-all duration-200"
                :class="{
                  'bg-accentBg text-accent': currentStep === idx + 1,
                  'bg-successBg text-success': currentStep > idx + 1,
                  'bg-transparent border border-muted text-subtle': currentStep < idx + 1
                }"
                >{{ idx + 1 }}</span
              >
              <span
                class="zw-step-label text-[10px] text-center"
                :class="currentStep >= idx + 1 ? 'text-text' : 'text-subtle'"
                >{{ label }}</span
              >
            </div>
            <div v-if="idx < 2" class="zw-step-divider flex-1 h-px mx-1 mb-4 bg-border"></div>
          </template>
        </div>

        <!-- 出生信息表单 -->
        <div class="zw-form-body flex flex-col gap-3 flex-1">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_PROFILE }}</label>
            <input
              v-model="profileName"
              type="text"
              :placeholder="UI_LABELS.PLACEHOLDER_PROFILE"
              class="input-control"
            />
            <span class="text-[10px] text-subtle">{{ UI_LABELS.HINT_PROFILE }}</span>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_CALENDAR }}</label>
            <FormSelect v-model="calendarType" :options="calendarTypeOptions" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{
              calendarType === 'solar' ? UI_LABELS.LABEL_SOLAR_YEAR : UI_LABELS.LABEL_LUNAR_YEAR
            }}</label>
            <FormSelect
              v-if="calendarType === 'solar'"
              v-model="solarYear"
              :options="yearFormOptions"
            />
            <FormSelect v-else v-model="lunarYear" :options="yearFormOptions" />
          </div>

          <div class="zw-form-grid-two grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{
                calendarType === 'solar' ? UI_LABELS.LABEL_MONTH : UI_LABELS.LABEL_LUNAR_MONTH
              }}</label>
              <FormSelect
                v-if="calendarType === 'solar'"
                v-model="solarMonth"
                :options="solarMonthOptions"
              />
              <FormSelect v-else v-model="lunarMonth" :options="lunarMonthOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{
                calendarType === 'solar' ? UI_LABELS.LABEL_DAY : UI_LABELS.LABEL_LUNAR_DAY
              }}</label>
              <FormSelect
                v-if="calendarType === 'solar'"
                v-model="solarDay"
                :options="solarDayOptions"
              />
              <FormSelect v-else v-model="lunarDay" :options="lunarDayOptions" />
            </div>
          </div>

          <div v-if="calendarType === 'solar'" class="zw-form-grid-two grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_BIRTH_HOUR }}</label>
              <FormSelect v-model="birthHour" :options="solarHourOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_BIRTH_MINUTE }}</label>
              <FormSelect v-model="birthMinute" :options="minuteOptions" />
            </div>
          </div>

          <div v-else class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_BIRTH_HOUR }}</label>
            <FormSelect v-model="birthShiChen" :options="birthShiChenOptions" />
          </div>

          <div class="zw-form-grid-two grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_PROVINCE }}</label>
              <FormSelect v-model="birthProvince" :options="provinceOptions" />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_CITY }}</label>
              <FormSelect v-model="birthCity" :options="cityOptions" />
            </div>
          </div>

          <div class="rounded-md border border-border bg-bg px-3 py-2 text-[11px] text-subtle">
            <p>{{ UI_LABELS.LABEL_LONGITUDE }}：{{ selectedLongitudeText }}</p>
            <p class="mt-1 text-link">{{ UI_LABELS.HINT_TRUE_SOLAR }}</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-subtle">{{ UI_LABELS.LABEL_GENDER }}</label>
            <div class="zw-gender-group flex gap-2">
              <label
                class="zw-gender-option flex items-center gap-2 px-4 py-2 bg-bg border rounded-md text-sm cursor-pointer transition-all duration-150"
                :class="
                  gender === 'male'
                    ? 'border-accent bg-accentBg text-accent'
                    : 'border-border text-text'
                "
                tabindex="0"
                role="radio"
                aria-checked="true"
                @keydown.enter.prevent="gender = 'male'"
                @keydown.space.prevent="gender = 'male'"
              >
                <input v-model="gender" type="radio" value="male" class="hidden" />
                <span
                  class="w-4 h-4 rounded-full border-2 transition-all duration-150"
                  :class="gender === 'male' ? 'border-accent bg-accent' : 'border-border'"
                  :style="gender === 'male' ? { boxShadow: 'inset 0 0 0 3px var(--color-bg)' } : {}"
                ></span>
                <span>{{ UI_LABELS.LABEL_MALE }}</span>
              </label>
              <label
                class="zw-gender-option flex items-center gap-2 px-4 py-2 bg-bg border rounded-md text-sm cursor-pointer transition-all duration-150"
                :class="
                  gender === 'female'
                    ? 'border-accent bg-accentBg text-accent'
                    : 'border-border text-text'
                "
                tabindex="0"
                role="radio"
                aria-checked="false"
                @keydown.enter.prevent="gender = 'female'"
                @keydown.space.prevent="gender = 'female'"
              >
                <input v-model="gender" type="radio" value="female" class="hidden" />
                <span
                  class="w-4 h-4 rounded-full border-2 transition-all duration-150"
                  :class="gender === 'female' ? 'border-accent bg-accent' : 'border-border'"
                  :style="
                    gender === 'female' ? { boxShadow: 'inset 0 0 0 3px var(--color-bg)' } : {}
                  "
                ></span>
                <span>{{ UI_LABELS.LABEL_FEMALE }}</span>
              </label>
            </div>
          </div>
        </div>

        <Transition name="slide-fade">
          <div
            v-if="status.text"
            class="mt-4 p-3 rounded-md text-xs"
            :class="status.type === 'success' ? 'bg-successBg text-success' : 'bg-dangerBg text-danger'"
          >
            {{ status.text }}
          </div>
        </Transition>
        <div
          v-if="shiChenCorrectionNotice"
          class="mt-3 rounded-md border border-border bg-panel2 px-3 py-2 text-[11px] text-warning"
        >
          {{ shiChenCorrectionNotice }}
        </div>
        <p
          v-else-if="correctionText"
          class="mt-3 rounded-md border border-border bg-bg px-3 py-2 text-[11px] text-subtle"
        >
          {{ correctionText }}
        </p>
      </aside>

      <!-- 中栏：命盘主区域 -->
      <main
        class="flex-col items-stretch p-4 bg-bg overflow-hidden zw-center-panel"
        :class="mobileTab !== 'input' ? 'flex' : 'hidden lg:flex'"
      >
        <div
          v-if="!chart"
          class="flex flex-col items-center justify-center gap-4 flex-1 text-center"
        >
          <div class="text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path
                d="M12 2C12 2 14 6 14 12C14 18 12 22 12 22"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M2 12C2 12 6 14 12 14C18 14 22 12 22 12"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>
          <h3 class="text-lg text-text">{{ UI_LABELS.EMPTY_TITLE }}</h3>
          <p class="text-sm text-subtle leading-relaxed whitespace-pre-line">
            {{ UI_LABELS.EMPTY_DESC }}
          </p>
        </div>

        <div v-else class="zw-main-stage">
          <div class="zw-main-head">
            <div class="zw-main-head-copy">
              <h2 class="text-base font-semibold text-text">
                {{ mobileTab === 'analysis' || mobileTab === 'qa' ? UI_LABELS.AI_TITLE : UI_LABELS.CHART_TITLE }}
              </h2>
              <span class="text-sm text-subtle">
                {{ mobileTab === 'analysis' || mobileTab === 'qa' ? '阅读模式' : chartMeta }}
              </span>
            </div>
            <div class="zw-view-switch hidden lg:inline-flex">
              <button
                type="button"
                class="zw-view-switch-btn"
                :class="{ 'zw-view-switch-btn--active': mobileTab === 'chart' }"
                @click="showChartView"
              >
                命盘
              </button>
              <button
                type="button"
                class="zw-view-switch-btn"
                :class="{ 'zw-view-switch-btn--active': mobileTab === 'analysis' || (mobileTab !== 'chart' && mobileTab !== 'qa' && aiReadingTab === 'analysis') }"
                :disabled="!chart"
                @click="showAnalysisView"
              >
                AI 解读
              </button>
              <button
                type="button"
                class="zw-view-switch-btn"
                :class="{ 'zw-view-switch-btn--active': mobileTab === 'qa' || (mobileTab !== 'chart' && mobileTab !== 'analysis' && aiReadingTab === 'qa') }"
                :disabled="!chart"
                @click="showQaView"
              >
                问答
              </button>
            </div>
          </div>

          <p
            v-if="mobileTab === 'chart' && centerInfo?.timeCorrectionText"
            class="zw-chart-stage-note text-xs text-subtle"
          >
            {{ centerInfo.timeCorrectionText }}
          </p>
          <div v-if="mobileTab === 'analysis' || mobileTab === 'qa'" class="zw-analysis-stage lg:flex">
            <div
              v-if="aiError"
              class="p-2.5 bg-dangerBg border border-danger/30 rounded-md text-xs text-danger"
              role="alert"
            >
              {{ aiError }}
            </div>

            <!-- AI 解读内容 -->
            <template v-if="mobileTab === 'analysis'">
              <section v-if="aiResult || aiLoading" class="zw-analysis-panel zw-analysis-panel--analysis">
                <div class="zw-analysis-panel-head hidden lg:flex">
                  <div class="zw-analysis-panel-title">
                    <!--<span class="zw-analysis-panel-kicker">深度解读</-- span> -->
                    <h3 class="text-sm font-semibold text-text">AI 解读</h3>
                  </div>
                   <!--<span class="zw-analysis-panel-chip">结构化阅读模式</--span> -->
                </div>

                <div class="zw-analysis-panel-body">
                  <div v-if="aiLoading && !aiResult" class="zw-analysis-stream-card hidden lg:block">
                    <div class="zw-analysis-card-head">
                      <h3 class="text-sm font-semibold text-text">AI 正在解读</h3>
                      <span class="text-[11px] text-accent">AI思考中</span>
                    </div>
                    <div class="zw-analysis-badge-row">
                      <span class="zw-analysis-badge zw-analysis-badge--blue">结构化输出</span>
                      <span class="zw-analysis-badge zw-analysis-badge--purple">结论优先</span>
                      <span class="zw-analysis-badge zw-analysis-badge--green">逐步展开</span>
                    </div>
                    <p class="zw-analysis-card-text">
                      {{ aiStreamingText || 'AI 正在整理命盘结构，请稍候...' }}
                    </p>
                  </div>

                  <div v-if="aiResult || aiLoading" class="zw-analysis-result-wrap">
                    <div class="zw-mobile-hscroll lg:hidden">
                      <div ref="analysisScrollRef" class="zw-mobile-hscroll-track" @scroll="onAnalysisScroll">
                        <article
                          v-if="aiLoading && !aiResult"
                          class="zw-analysis-card zw-hscroll-card zw-analysis-card--hero"
                        >
                          <div class="zw-analysis-card-head">
                            <h3 class="text-sm font-semibold text-text">总体结论</h3>
                            <span class="text-[11px] text-accent">AI思考中</span>
                          </div>
                          <div class="zw-analysis-card-text zw-analysis-card-text--hero zw-analysis-card-text--stream">
                            <template
                              v-for="(line, lineIdx) in splitDisplayText(aiStreamingText || 'AI 正在整理命盘结构，请稍候...')"
                              :key="`mobile-analysis-stream-${lineIdx}`"
                            >
                              <p class="zw-analysis-text-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </div>
                        </article>
                        <article
                          v-if="aiResult?.overview"
                          class="zw-analysis-card zw-hscroll-card zw-analysis-card--hero"
                        >
                          <div class="zw-analysis-card-head">
                            <h3 class="text-sm font-semibold text-text">总体结论</h3>
                          </div>
                          <div class="zw-analysis-card-text zw-analysis-card-text--hero">
                            <template v-for="(line, lineIdx) in splitDisplayText(aiResult.overview)" :key="`overview-mobile-${lineIdx}`">
                              <p class="zw-analysis-text-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </div>
                        </article>

                        <article
                          v-for="entry in mobileAnalysisEntries"
                          :key="`mobile-flow-${entry.id}`"
                          class="zw-analysis-card zw-hscroll-card"
                          :class="entry.toneClass"
                        >
                          <div class="zw-analysis-card-head">
                            <h4 class="zw-analysis-section-title" :class="entry.titleClass">
                              <span class="zw-analysis-section-icon" :class="entry.iconClass"></span>
                              <span>{{ entry.title }}</span>
                            </h4>
                            <span class="zw-analysis-section-index">{{ entry.indexLabel }}</span>
                          </div>
                          <div v-if="entry.summary" class="zw-analysis-card-text zw-analysis-card-text--subtle">
                            <template
                              v-for="(line, lineIdx) in splitDisplayText(entry.summary)"
                              :key="`${entry.id}-summary-mobile-${lineIdx}`"
                            >
                              <p class="zw-analysis-text-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </div>
                          <div
                            v-if="hasItems(entry.evidence) || hasItems(entry.opportunities) || hasItems(entry.risks)"
                            class="zw-analysis-meta-grid"
                          >
                            <section v-if="hasItems(entry.evidence)" class="zw-analysis-meta-block">
                              <h5 class="zw-analysis-meta-title zw-analysis-meta-title--evidence">命盘依据</h5>
                              <ul class="zw-analysis-meta-list">
                                <li v-for="(item, itemIdx) in entry.evidence" :key="`${entry.id}-ev-${itemIdx}`">
                                  <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`${entry.id}-ev-${itemIdx}-${lineIdx}`">
                                    <p class="zw-analysis-list-line">
                                      <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                      <span>{{ line.body }}</span>
                                    </p>
                                  </template>
                                </li>
                              </ul>
                            </section>
                            <section v-if="hasItems(entry.opportunities)" class="zw-analysis-meta-block">
                              <h5 class="zw-analysis-meta-title zw-analysis-meta-title--opportunities">可把握机会</h5>
                              <ul class="zw-analysis-meta-list">
                                <li v-for="(item, itemIdx) in entry.opportunities" :key="`${entry.id}-opp-${itemIdx}`">
                                  <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`${entry.id}-opp-${itemIdx}-${lineIdx}`">
                                    <p class="zw-analysis-list-line">
                                      <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                      <span>{{ line.body }}</span>
                                    </p>
                                  </template>
                                </li>
                              </ul>
                            </section>
                            <section v-if="hasItems(entry.risks)" class="zw-analysis-meta-block">
                              <h5 class="zw-analysis-meta-title zw-analysis-meta-title--risks">需要留意</h5>
                              <ul class="zw-analysis-meta-list">
                                <li v-for="(item, itemIdx) in entry.risks" :key="`${entry.id}-risk-${itemIdx}`">
                                  <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`${entry.id}-risk-${itemIdx}-${lineIdx}`">
                                    <p class="zw-analysis-list-line">
                                      <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                      <span>{{ line.body }}</span>
                                    </p>
                                  </template>
                                </li>
                              </ul>
                            </section>
                          </div>
                          <div v-if="hasItems(entry.actions)" class="zw-analysis-meta-grid">
                            <section class="zw-analysis-meta-block">
                              <h5 class="zw-analysis-meta-title zw-analysis-meta-title--advice">接下来怎么做</h5>
                              <div class="zw-analysis-card-text zw-analysis-card-text--subtle" style="line-height: 1.8">
                                <p v-for="(item, itemIdx) in entry.actions" :key="`${entry.id}-act-${itemIdx}`" class="zw-analysis-list-line">
                                  · {{ item }}
                                </p>
                              </div>
                            </section>
                          </div>
                        </article>
                      </div>
                      <div v-if="analysisNavTags.length > 1" class="zw-mobile-hscroll-tags">
                        <button
                          v-for="(tag, idx) in analysisNavTags"
                          :key="tag.id"
                          class="zw-mobile-hscroll-tag"
                          :class="{ 'zw-mobile-hscroll-tag--active': activeAnalysisCardIdx === idx }"
                          @click="scrollToAnalysisCard(idx)"
                        >{{ tag.label }}</button>
                      </div>
                    </div>

                    <div v-if="aiResult" class="zw-analysis-desktop-grid">
                      <article v-if="aiResult.overview" class="zw-analysis-card zw-analysis-card--overview zw-analysis-card--hero">
                        <div class="zw-analysis-card-head">
                          <h3 class="text-sm font-semibold text-text">总体结论</h3>
                          <span class="text-[11px]" :class="aiLoading ? 'text-accent' : 'text-subtle'">
                            {{ aiLoading ? 'AI思考中' : 'AI 思考完成' }}
                          </span>
                        </div>
                        <div class="zw-analysis-badge-row">
                          <span class="zw-analysis-badge zw-analysis-badge--blue">主结论</span>
                          <span class="zw-analysis-badge zw-analysis-badge--purple">阶段判断</span>
                          <span class="zw-analysis-badge zw-analysis-badge--gold">行动导向</span>
                        </div>
                        <div class="zw-analysis-card-text zw-analysis-card-text--hero">
                          <template v-for="(line, lineIdx) in splitDisplayText(aiResult.overview)" :key="`overview-${lineIdx}`">
                            <p class="zw-analysis-text-line">
                              <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                              <span>{{ line.body }}</span>
                            </p>
                          </template>
                        </div>
                      </article>

                      <article
                        v-for="(section, idx) in aiResult.sections"
                        :key="`${section.title}-${idx}`"
                        class="zw-analysis-card zw-analysis-card--insight"
                        :class="[
                          getAnalysisSectionToneClass(idx),
                          { 'zw-analysis-card--span-full': shouldSpanFullWidth(idx, aiResult.sections.length) }
                        ]"
                      >
                        <div class="zw-analysis-card-head">
                          <h4 class="zw-analysis-section-title" :class="getAnalysisSectionTitleClass(idx)">
                            <span class="zw-analysis-section-icon" :class="getAnalysisSectionIconClass(idx)"></span>
                            <span>{{ section.title }}</span>
                          </h4>
                          <span class="zw-analysis-section-index">0{{ idx + 1 }}</span>
                        </div>
                        <div class="zw-analysis-card-text zw-analysis-card-text--subtle">
                          <template
                            v-for="(line, lineIdx) in splitDisplayText(section.summary)"
                            :key="`${section.title}-summary-${lineIdx}`"
                          >
                            <p class="zw-analysis-text-line">
                              <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                              <span>{{ line.body }}</span>
                            </p>
                          </template>
                        </div>
                        <div
                          v-if="hasItems(section.evidence) || hasItems(section.advice)"
                          class="zw-analysis-meta-grid"
                        >
                          <section v-if="hasItems(section.evidence)" class="zw-analysis-meta-block">
                            <h5 class="zw-analysis-meta-title zw-analysis-meta-title--evidence">命盘依据</h5>
                            <ul class="zw-analysis-meta-list">
                              <li
                                v-for="(item, itemIdx) in section.evidence"
                                :key="`${section.title}-evidence-${itemIdx}`"
                              >
                                <template
                                  v-for="(line, lineIdx) in splitDisplayText(item)"
                                  :key="`${section.title}-evidence-${itemIdx}-${lineIdx}`"
                                >
                                  <p class="zw-analysis-list-line">
                                    <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                    <span>{{ line.body }}</span>
                                  </p>
                                </template>
                              </li>
                            </ul>
                          </section>
                          <section v-if="hasItems(section.advice)" class="zw-analysis-meta-block">
                            <h5 class="zw-analysis-meta-title zw-analysis-meta-title--advice">行动建议</h5>
                            <ul class="zw-analysis-meta-list">
                              <li
                                v-for="(item, itemIdx) in section.advice"
                                :key="`${section.title}-advice-${itemIdx}`"
                              >
                                <template
                                  v-for="(line, lineIdx) in splitDisplayText(item)"
                                  :key="`${section.title}-advice-${itemIdx}-${lineIdx}`"
                                >
                                  <p class="zw-analysis-list-line">
                                    <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                    <span>{{ line.body }}</span>
                                  </p>
                                </template>
                              </li>
                            </ul>
                          </section>
                        </div>
                      </article>

                      <article
                        v-if="showDeferredAnalysisCards && hasYearFocus"
                        class="zw-analysis-card zw-analysis-card--overview zw-analysis-card--focus"
                      >
                        <div class="zw-analysis-card-head">
                          <h4 class="zw-analysis-section-title zw-analysis-section-title--purple">
                            <span class="zw-analysis-section-icon zw-analysis-icon--moon"></span>
                            <span>当前阶段重点</span>
                          </h4>
                          <span class="zw-analysis-section-index">YR</span>
                        </div>
                        <div class="zw-analysis-card-text zw-analysis-card-text--subtle zw-analysis-card-text--feature">
                          <template
                            v-for="(line, lineIdx) in splitDisplayText(aiResult.yearFocus?.summary || '')"
                            :key="`year-focus-${lineIdx}`"
                          >
                            <p class="zw-analysis-text-line">
                              <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                              <span>{{ line.body }}</span>
                            </p>
                          </template>
                        </div>
                        <div class="zw-analysis-meta-grid">
                          <section v-if="hasItems(aiResult.yearFocus?.opportunities)" class="zw-analysis-meta-block">
                            <h5 class="zw-analysis-meta-title zw-analysis-meta-title--opportunities">可把握机会</h5>
                            <ul class="zw-analysis-meta-list">
                              <li
                                v-for="(item, itemIdx) in aiResult.yearFocus?.opportunities"
                                :key="`year-opportunity-${itemIdx}`"
                              >
                                <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`year-opportunity-${itemIdx}-${lineIdx}`">
                                  <p class="zw-analysis-list-line">
                                    <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                    <span>{{ line.body }}</span>
                                  </p>
                                </template>
                              </li>
                            </ul>
                          </section>
                          <section v-if="hasItems(aiResult.yearFocus?.risks)" class="zw-analysis-meta-block">
                            <h5 class="zw-analysis-meta-title zw-analysis-meta-title--risks">需留意风险</h5>
                            <ul class="zw-analysis-meta-list">
                              <li
                                v-for="(item, itemIdx) in aiResult.yearFocus?.risks"
                                :key="`year-risk-${itemIdx}`"
                              >
                                <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`year-risk-${itemIdx}-${lineIdx}`">
                                  <p class="zw-analysis-list-line">
                                    <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                    <span>{{ line.body }}</span>
                                  </p>
                                </template>
                              </li>
                            </ul>
                          </section>
                        </div>
                      </article>

                      <article
                        v-if="showDeferredAnalysisCards && hasNextActions"
                        class="zw-analysis-card zw-analysis-card--overview zw-analysis-card--actions"
                      >
                        <div class="zw-analysis-card-head">
                          <h4 class="zw-analysis-section-title zw-analysis-section-title--green">
                            <span class="zw-analysis-section-icon zw-analysis-icon--spark"></span>
                            <span>接下来怎么做</span>
                          </h4>
                          <span class="zw-analysis-section-index">DO</span>
                        </div>
                        <ol class="zw-analysis-meta-list zw-analysis-meta-list--ordered">
                          <li
                            v-for="(item, itemIdx) in aiResult.nextActions"
                            :key="`next-action-${itemIdx}`"
                            class="zw-analysis-action-item"
                          >
                            <template v-for="(line, lineIdx) in splitDisplayText(item)" :key="`next-action-${itemIdx}-${lineIdx}`">
                              <p class="zw-analysis-list-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </li>
                        </ol>
                      </article>
                    </div>
                  </div>
                </div>
              </section>

              <section
                v-else
                class="zw-analysis-empty zw-analysis-empty--full"
              >
                <div class="text-muted">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 3C7.02944 3 3 6.58172 3 11C3 13.0808 3.89941 14.9757 5.38463 16.4117C5.17118 17.4794 4.73212 18.6407 4 20C5.70683 19.7164 7.11718 19.2844 8.23549 18.7362C9.41518 19.185 10.677 19.4167 12 19.4167C16.9706 19.4167 21 15.835 21 11.4167C21 6.99839 16.9706 3 12 3Z"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <h3 class="text-sm font-semibold text-text">AI 解读还未生成</h3>
                <button
                  type="button"
                  class="ziwei-btn-outline"
                  :disabled="!chart || aiLoading"
                  @click="handleAiAnalysis"
                >
                  {{ aiButtonLabel }}
                </button>
              </section>
            </template>

            <!-- 问答内容 -->
            <template v-if="mobileTab === 'qa'">
              <section class="zw-analysis-panel zw-analysis-panel--qa lg:flex">
                <div class="zw-analysis-panel-head hidden lg:flex">
                  <div class="zw-analysis-panel-title">
                    <h3 class="text-sm font-semibold text-text">问答</h3>
                  </div>
                  <span class="zw-analysis-panel-chip zw-analysis-panel-chip--ghost">{{ lastAiQuestion || '等待提问' }}</span>
                </div>

                <div class="zw-analysis-panel-body">
                  <div class="zw-qa-compose-card hidden lg:block">
                    <div class="zw-qa-compose-head">
                      <span class="zw-analysis-badge zw-analysis-badge--blue">
                        {{ aiAnalysisReady ? '可继续追问' : '可直接基于命盘提问' }}
                      </span>
                    </div>

                    <div class="zw-qa-compose-row">
                      <input
                        v-model="aiQuestionInput"
                        type="text"
                        :placeholder="UI_LABELS.PLACEHOLDER_AI_QUESTION"
                        :disabled="!chart || aiQuestionLoading"
                        class="input-control flex-1"
                        @keydown.enter="handleAiQuestion"
                      />
                      <button
                        class="zw-qa-send-btn"
                        :disabled="!chart || !aiQuestionInput.trim() || aiQuestionLoading"
                        aria-label="发送问题"
                        @click="handleAiQuestion"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" class="mx-auto">
                          <path
                            d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    </div>

                    <div v-if="aiQuestionLoading" class="text-xs text-subtle">
                      {{ UI_LABELS.HINT_AI_QA_LOADING }}
                    </div>

                    <div
                      v-if="aiQuestionError"
                      class="p-2.5 bg-dangerBg border border-danger/30 rounded-md text-xs text-danger"
                      role="alert"
                    >
                      {{ aiQuestionError }}
                    </div>

                    <p class="text-[11px] text-subtle">
                      {{ aiAnalysisReady ? UI_LABELS.HINT_AI_QA_READY : UI_LABELS.HINT_AI_QA_NOT_READY }}
                    </p>
                  </div>

                  <div class="zw-mobile-qa-simple lg:hidden">
                    <div class="zw-mqas-conversation">
                      <!-- 空状态：引导卡片 -->
                      <div v-if="!mobileQaFlowBlocks.length && !lastAiQuestion" class="zw-mqas-welcome">
                        <div class="zw-mqas-welcome-head">
                          <span class="zw-mqas-avatar zw-mqas-avatar--ai">AI</span>
                          <span class="zw-mqas-welcome-title">可以问我任何关于命盘的问题</span>
                        </div>
                        <div class="zw-mqas-suggestions">
                          <p class="zw-mqas-suggestions-label">💡 试试问：</p>
                          <button
                            v-for="suggestion in qaSuggestions"
                            :key="suggestion"
                            class="zw-mqas-suggestion"
                            @click="aiQuestionInput = suggestion"
                          >{{ suggestion }}</button>
                        </div>
                      </div>

                      <!-- 有回答时：对话流 -->
                      <template v-if="mobileQaFlowBlocks.length">
                        <article
                          v-for="block in mobileQaFlowBlocks"
                          :key="block.id"
                          class="zw-mqas-message zw-mqas-message--ai"
                        >
                          <div class="zw-mqas-message-head">
                            <span class="zw-mqas-avatar zw-mqas-avatar--ai">AI</span>
                            <span class="zw-mqas-message-title" :class="block.titleClass">{{ block.title }}</span>
                          </div>
                          <div class="zw-mqas-message-body">
                            <template v-for="(line, lineIdx) in splitDisplayText(block.body)" :key="`${block.id}-${lineIdx}`">
                              <p class="zw-analysis-text-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </div>
                        </article>
                      </template>

                      <!-- 用户问题气泡 -->
                      <div v-if="lastAiQuestion" class="zw-mqas-message zw-mqas-message--user">
                        <div class="zw-mqas-message-head">
                          <span class="zw-mqas-avatar zw-mqas-avatar--user">我</span>
                          <span class="zw-mqas-message-title">我的问题</span>
                        </div>
                        <div class="zw-mqas-message-body">
                          <p>{{ lastAiQuestion }}</p>
                        </div>
                      </div>
                    </div>

                    <!-- 错误提示 -->
                    <div
                      v-if="aiQuestionError"
                      class="p-2.5 bg-dangerBg border border-danger/30 rounded-md text-xs text-danger"
                      role="alert"
                    >
                      {{ aiQuestionError }}
                    </div>

                    <!-- 输入区域 -->
                    <div class="zw-mqas-input-row">
                      <input
                        v-model="aiQuestionInput"
                        type="text"
                        :placeholder="UI_LABELS.PLACEHOLDER_AI_QUESTION"
                        :disabled="!chart || aiQuestionLoading"
                        class="zw-mqas-input"
                        @keydown.enter="handleAiQuestion"
                      />
                      <button
                        class="zw-mqas-btn"
                        :disabled="!chart || !aiQuestionInput.trim() || aiQuestionLoading"
                        @click="handleAiQuestion"
                      >提问</button>
                    </div>
                  </div>

                  <template v-if="lastAiQuestion || qaAnswerCards.length">
                    <div class="hidden lg:block">
                      <article
                        v-if="qaLeadCard"
                        class="zw-analysis-card zw-analysis-card--qa zw-analysis-card--qa-lead zw-analysis-card--tone-blue"
                      >
                        <div class="zw-analysis-card-head">
                          <h4
                            class="zw-analysis-section-title zw-analysis-section-title--qa zw-analysis-section-title--blue"
                          >
                            <span class="zw-analysis-section-icon zw-analysis-icon--chat"></span>
                            <span>问题判断</span>
                          </h4>
                          <span class="zw-analysis-section-index">A1</span>
                        </div>
                        <div class="zw-analysis-badge-row zw-analysis-badge-row--compact">
                          <span class="zw-analysis-badge zw-analysis-badge--blue">先给答案</span>
                          <span class="zw-analysis-badge zw-analysis-badge--purple">再给依据</span>
                          <span class="zw-analysis-badge zw-analysis-badge--green">最后给提醒</span>
                        </div>
                        <div class="zw-analysis-card-text zw-analysis-card-text--subtle zw-analysis-card-text--lead">
                          <template v-for="(line, lineIdx) in splitDisplayText(qaLeadCard.body)" :key="`qa-lead-${lineIdx}`">
                            <p class="zw-analysis-text-line">
                              <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                              <span>{{ line.body }}</span>
                            </p>
                          </template>
                        </div>
                      </article>

                      <div v-if="qaFollowCards.length" class="zw-qa-follow-grid">
                        <article
                          v-for="(card, qaIdx) in qaFollowCards"
                          :key="`qa-follow-${qaIdx}`"
                          class="zw-analysis-card zw-analysis-card--qa"
                          :class="[
                            getAnalysisSectionToneClass(qaIdx + (aiResult?.sections.length ?? 0) + 2),
                            { 'zw-analysis-card--span-full': shouldSpanFullWidth(qaIdx, qaFollowCards.length) }
                          ]"
                        >
                          <div class="zw-analysis-card-head">
                            <h4
                              class="zw-analysis-section-title zw-analysis-section-title--qa"
                              :class="getAnalysisSectionTitleClass(qaIdx + (aiResult?.sections.length ?? 0) + 2)"
                            >
                              <span
                                class="zw-analysis-section-icon"
                                :class="getAnalysisSectionIconClass(qaIdx + (aiResult?.sections.length ?? 0) + 2)"
                              ></span>
                              <span>{{ card.title }}</span>
                            </h4>
                            <span class="zw-analysis-section-index">A{{ qaIdx + 2 }}</span>
                          </div>
                          <div class="zw-analysis-card-text zw-analysis-card-text--subtle">
                            <template v-for="(line, lineIdx) in splitDisplayText(card.body)" :key="`qa-follow-${qaIdx}-${lineIdx}`">
                              <p class="zw-analysis-text-line">
                                <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                                <span>{{ line.body }}</span>
                              </p>
                            </template>
                          </div>
                        </article>
                      </div>

                      <article
                        v-else-if="aiQuestionStreaming && aiQuestionAnswer && !qaLeadCard"
                        class="zw-analysis-card zw-analysis-card--qa zw-analysis-card--tone-blue"
                      >
                        <div class="zw-analysis-card-head">
                          <h4
                            class="zw-analysis-section-title zw-analysis-section-title--qa"
                            :class="getAnalysisSectionTitleClass((aiResult?.sections.length ?? 0) + 1)"
                          >
                            <span
                              class="zw-analysis-section-icon"
                              :class="getAnalysisSectionIconClass((aiResult?.sections.length ?? 0) + 1)"
                            ></span>
                            <span>问题判断</span>
                          </h4>
                          <span class="zw-analysis-section-index">A1</span>
                        </div>
                        <div class="zw-analysis-badge-row zw-analysis-badge-row--compact">
                          <span class="zw-analysis-badge zw-analysis-badge--blue">先给答案</span>
                          <span class="zw-analysis-badge zw-analysis-badge--green">再给证据</span>
                        </div>
                        <div class="zw-analysis-card-text zw-analysis-card-text--subtle">
                          <template v-for="(line, lineIdx) in splitDisplayText(aiQuestionAnswer)" :key="`qa-stream-${lineIdx}`">
                            <p class="zw-analysis-text-line">
                              <span v-if="line.label" class="zw-analysis-inline-label">{{ line.label }}：</span>
                              <span>{{ line.body }}</span>
                            </p>
                          </template>
                        </div>
                      </article>
                    </div>
                  </template>

                </div>
              </section>
            </template>

            <p v-if="mobileTab !== 'qa'" class="zw-analysis-disclaimer">
              {{ analysisDisclaimer }}
            </p>
          </div>

          <div v-else class="zw-chart-stage">
            <div class="zw-mobile-chart-layout lg:hidden">
              <div class="zw-mobile-sanfang-grid">
                <template v-for="(cell, index) in palaceGrid" :key="'m-' + index">
                  <div v-if="index === 5" class="zw-mobile-center-panel">
                    <div class="zw-mc-center-name">{{ profileName || '当前命盘' }}</div>
                    <div class="zw-mc-center-meta">{{ chartMeta }}</div>
                    <div class="zw-mc-center-info-list">
                      <div v-for="item in mobileCenterBasicInfo" :key="item.label" class="zw-mc-info-row">
                        <span class="zw-mc-info-k">{{ item.label }}</span>
                        <span class="zw-mc-info-v">{{ item.value }}</span>
                      </div>
                    </div>
                    <div class="zw-mc-center-divider"></div>
                    <div class="zw-mc-center-stats">
                      <div v-for="item in mobileCenterLiunian" :key="item.label" class="zw-mc-stat">
                        <span class="zw-mc-stat-v">{{ item.value }}</span>
                        <span class="zw-mc-stat-l">{{ item.label }}</span>
                      </div>
                    </div>
                  </div>
                  <template v-else-if="!cell" />
                  <button
                    v-else
                    type="button"
                    class="zw-mobile-cell"
                    :class="{
                      'zw-mobile-cell--ming': cell.isMing,
                      'zw-mobile-cell--shen': cell.isShen,
                      'zw-mobile-cell--daxian': cell.isCurrentDaXian
                    }"
                    @click="openMobilePalaceByBranch(cell.branch)"
                  >
                    <span v-if="cell.isMing" class="zw-mc-badge zw-mc-badge--ming">命</span>
                    <span v-else-if="cell.isShen" class="zw-mc-badge zw-mc-badge--shen">身</span>
                    <span v-else-if="cell.isCurrentDaXian" class="zw-mc-badge zw-mc-badge--daxian">限</span>
                    <div class="zw-mc-pn">{{ cell.palace }}</div>
                    <div class="zw-mc-gz">{{ cell.ganzhi }}</div>
                    <div class="zw-mc-stars">
                      <span
                        v-for="star in cell.mainStars"
                        :key="star.name"
                        class="zw-mc-star"
                        :class="star.level ? getPalaceLevelClass(star.level) : ''"
                      >{{ star.name }}<sup v-if="star.level">{{ star.level }}</sup></span>
                    </div>
                    <div v-if="cell.luckyStars.length || cell.evilStars.length" class="zw-mc-aux">{{ [...cell.luckyStars, ...cell.evilStars].map(s => s.name).join('·') }}</div>
                    <div v-if="cell.birthHuaStars.length" class="zw-mc-hua-tags">
                      <span
                        v-for="h in cell.birthHuaStars"
                        :key="h.label"
                        class="zw-mc-ht"
                        :class="getHuaTagClass(h.tag)"
                      >{{ h.tag }}</span>
                    </div>
                  </button>
                </template>
              </div>
              <div class="zw-mc-legend">
                <span class="zw-mc-legend-item"><i class="zw-mc-legend-dot level-miao" /><span>庙</span></span>
                <span class="zw-mc-legend-item"><i class="zw-mc-legend-dot level-wang" /><span>旺</span></span>
                <span class="zw-mc-legend-item"><i class="zw-mc-legend-dot level-de" /><span>得</span></span>
                <span class="zw-mc-legend-item"><i class="zw-mc-legend-dot level-xian" /><span>陷</span></span>
              </div>
              <div v-if="centerInfo" class="zw-mc-yaosu-card">
                <div class="zw-mc-yaosu-title">命 盘 要 素</div>
                <div class="zw-mc-yaosu-grid">
                  <div v-for="item in mobileChartYaosu" :key="item.label" class="zw-mc-yaosu-item">
                    <span class="zw-mc-yaosu-k" :class="item.colorClass">{{ item.label }}</span>
                    <span class="zw-mc-yaosu-v">{{ item.value }}</span>
                  </div>
                </div>
              </div>
              <div v-if="centerInfo" class="zw-mc-hua-section">
                <div class="zw-mc-hua-section-title">三 层 四 化</div>
                <div class="zw-mc-hua-section-row">
                  <span class="zw-mc-hua-icon zw-mc-hua-icon--birth">生</span>
                  <div class="zw-mc-hua-pills">
                    <span
                      v-for="pill in parseHuaPills(centerInfo.huaSummary)"
                      :key="'b-' + pill.text"
                      class="zw-mc-hua-pill"
                      :class="getHuaTagClass(pill.tag)"
                    >{{ pill.text }}</span>
                  </div>
                </div>
                <div class="zw-mc-hua-section-row">
                  <span class="zw-mc-hua-icon zw-mc-hua-icon--dx">限</span>
                  <div class="zw-mc-hua-pills">
                    <span
                      v-for="pill in parseHuaPills(centerInfo.daxianHuaSummary)"
                      :key="'d-' + pill.text"
                      class="zw-mc-hua-pill"
                      :class="getHuaTagClass(pill.tag)"
                    >{{ pill.text }}</span>
                  </div>
                </div>
                <div class="zw-mc-hua-section-row">
                  <span class="zw-mc-hua-icon zw-mc-hua-icon--ln">年</span>
                  <div class="zw-mc-hua-pills">
                    <span
                      v-for="pill in parseHuaPills(centerInfo.liunianHuaSummary)"
                      :key="'l-' + pill.text"
                      class="zw-mc-hua-pill"
                      :class="getHuaTagClass(pill.tag)"
                    >{{ pill.text }}</span>
                  </div>
                </div>
              </div>
              <p v-if="centerInfo?.timeCorrectionText" class="zw-mobile-chart-note">
                {{ centerInfo.timeCorrectionText }}
              </p>
            </div>

            <div class="hidden lg:grid zw-chart-desktop-layout">
            <div class="zw-summary-card">
              <div v-if="centerInfo" class="zw-summary-board">
                <section class="zw-summary-panel">
                  <h3 class="zw-panel-title">基本信息</h3>
                  <div class="zw-panel-list">
                    <div class="zw-kv"><span class="zw-k">姓名</span><span class="zw-v">{{ profileName || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">性别</span><span class="zw-v">{{ centerInfo.gender || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">农历</span><span class="zw-v">{{ centerInfo.lunar || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">公历</span><span class="zw-v">{{ centerInfo.solarText || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">出生时辰</span><span class="zw-v">{{ centerInfo.shichenLabel || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">出生地</span><span class="zw-v">{{ birthProvince }} {{ birthCity }}</span></div>
                    <div class="zw-kv"><span class="zw-k">经度</span><span class="zw-v">{{ selectedLongitudeText }}</span></div>
                  </div>
                </section>

                <section class="zw-summary-panel">
                  <h3 class="zw-panel-title">命盘要素</h3>
                  <div class="zw-panel-list">
                    <div class="zw-kv"><span class="zw-k">五行局</span><span class="zw-v">{{ centerInfo.bureau || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">命主星</span><span class="zw-v">{{ centerInfo.mingZhu || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">身主星</span><span class="zw-v">{{ centerInfo.shenZhu || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">命宫地支</span><span class="zw-v">{{ centerInfo.mingBranch || '--' }}{{ centerInfo.mingPalaceName ? '（' + centerInfo.mingPalaceName + '）' : '' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">身宫地支</span><span class="zw-v">{{ centerInfo.shenBranch || '--' }}{{ centerInfo.shenPalaceName ? '（' + centerInfo.shenPalaceName + '）' : '' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">起运岁数</span><span class="zw-v">{{ centerInfo.qiYunText || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">大限顺逆</span><span class="zw-v">{{ centerInfo.daXianDirectionLabel || '--' }}</span></div>
                  </div>
                </section>

                <section class="zw-summary-panel">
                  <h3 class="zw-panel-title">三层四化</h3>
                  <div class="zw-panel-list zw-panel-list--dense">
                    <div class="zw-kv zw-kv--stack">
                      <span class="zw-k">生年四化</span>
                      <span class="zw-v">{{ compactSummaryText(centerInfo.huaSummary) }}</span>
                    </div>
                    <div class="zw-kv zw-kv--stack">
                      <span class="zw-k">大限四化</span>
                      <span class="zw-v">{{ compactSummaryText(centerInfo.daxianHuaSummary) }}</span>
                    </div>
                    <div class="zw-kv zw-kv--stack">
                      <span class="zw-k">流年四化</span>
                      <span class="zw-v">{{ compactSummaryText(centerInfo.liunianHuaSummary) }}</span>
                    </div>
                  </div>
                </section>

                <section class="zw-summary-panel">
                  <h3 class="zw-panel-title">流年信息</h3>
                  <div class="zw-panel-list">
                    <div class="zw-kv"><span class="zw-k">流年干支</span><span class="zw-v">{{ centerInfo.currentYearGanZhiLabel || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">流年命宫</span><span class="zw-v">{{ centerInfo.currentLiuNianPalaceLabel || '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">虚岁</span><span class="zw-v">{{ centerInfo.age ? centerInfo.age + '岁' : '--' }}</span></div>
                    <div class="zw-kv"><span class="zw-k">当前大限</span><span class="zw-v">{{ centerInfo.currentDaXianLabel || '--' }}</span></div>
                  </div>
                </section>
              </div>
            </div>

            <div class="zw-palace-ring">
              <template v-for="(cell, index) in palaceGrid" :key="'pc-' + index">
                <div
                  v-if="cell"
                  class="zw-card"
                  :class="{
                    'zw-card--ming': cell.isMing,
                    'zw-card--shen': cell.isShen,
                    'zw-card--daxian': cell.isCurrentDaXian
                  }"
                >
                  <div class="zw-card-head">
                    <div class="zw-card-title">
                      <span class="zw-palace-name">{{ cell.palace }}</span>
                      <span v-if="cell.isMing" class="zw-tag zw-tag--ming">命</span>
                      <span v-if="cell.isShen" class="zw-tag zw-tag--shen">身</span>
                      <span v-if="cell.isCurrentDaXian" class="zw-tag zw-tag--daxian">限</span>
                    </div>
                    <span class="zw-ganzhi">{{ cell.ganzhi }}</span>
                  </div>

                  <div class="zw-stars-main">
                    <div class="zw-star-primary">
                      <span class="zw-star-primary-k">主星</span>
                      <span class="zw-star-primary-v">{{ formatMainStarText(cell.mainStars) }}</span>
                    </div>
                    <div v-if="!cell.mainStars.length" class="zw-card-empty">
                      无主星
                    </div>
                  </div>

                  <div class="zw-card-info-grid">
                    <div class="zw-card-info-item"><span class="zw-card-info-k">地支</span><span class="zw-card-info-v">{{ cell.branch }}</span></div>
                    <div class="zw-card-info-item"><span class="zw-card-info-k">长生</span><span class="zw-card-info-v">{{ cell.changSheng || '--' }}</span></div>
                    <div class="zw-card-info-item"><span class="zw-card-info-k">大限</span><span class="zw-card-info-v">{{ cell.daXianAge || '--' }}</span></div>
                    <div class="zw-card-info-item"><span class="zw-card-info-k">流年</span><span class="zw-card-info-v">{{ cell.liuNianPalaceName || '--' }}</span></div>
                  </div>

                  <div class="zw-card-lines">
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">吉</span>
                      <span class="zw-card-line-v">{{ formatStarNameText(cell.luckyStars) }}</span>
                    </div>
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">煞</span>
                      <span class="zw-card-line-v">{{ formatStarNameText(cell.evilStars) }}</span>
                    </div>
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">辅</span>
                      <span class="zw-card-line-v">{{ formatStarNameText(cell.miscStars) }}</span>
                    </div>
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">生</span>
                      <span class="zw-card-line-v">{{ formatBirthHuaText(cell.birthHuaStars) }}</span>
                    </div>
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">限</span>
                      <span class="zw-card-line-v">{{ formatTransitHuaText(cell.daxianSiHua) }}</span>
                    </div>
                    <div class="zw-card-line">
                      <span class="zw-card-line-k">年</span>
                      <span class="zw-card-line-v">{{ formatTransitHuaText(cell.liunianSiHua) }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </div>
            </div>

            <div
              v-if="activeMobilePalace"
              class="zw-mobile-sheet-backdrop lg:hidden"
              @click="closeMobilePalace"
            >
              <section class="zw-mobile-sheet" @click.stop>
                <div class="zw-mobile-sheet-handle"></div>
                <div class="zw-mobile-sheet-head">
                  <div>
                    <p class="zw-mobile-kicker">宫位详情</p>
                    <h3 class="zw-mobile-sheet-title">{{ activeMobilePalace.palace }}</h3>
                  </div>
                  <button type="button" class="zw-mobile-sheet-close" @click="closeMobilePalace">
                    关闭
                  </button>
                </div>

                <div class="zw-mobile-sheet-scroll">
                  <div class="zw-mobile-sheet-tags">
                    <span class="zw-mobile-sheet-chip">{{ activeMobilePalace.ganzhi }}</span>
                    <span v-if="activeMobilePalace.isMing" class="zw-tag zw-tag--ming">命宫</span>
                    <span v-if="activeMobilePalace.isShen" class="zw-tag zw-tag--shen">身宫</span>
                    <span v-if="activeMobilePalace.isCurrentDaXian" class="zw-tag zw-tag--daxian">当前大限</span>
                  </div>

                  <section class="zw-mobile-detail-block">
                    <h4 class="zw-mobile-detail-title zw-mobile-detail-title--stars">主星</h4>
                    <p class="zw-mobile-detail-text">{{ formatMainStarText(activeMobilePalace.mainStars) }}</p>
                  </section>

                  <section class="zw-mobile-detail-block">
                    <h4 class="zw-mobile-detail-title zw-mobile-detail-title--basic">基础信息</h4>
                    <div class="zw-mobile-detail-grid">
                      <div class="zw-mobile-detail-item"><span class="zw-mdi-label--branch">地支</span><strong>{{ activeMobilePalace.branch }}</strong></div>
                      <div class="zw-mobile-detail-item"><span class="zw-mdi-label--changsheng">长生</span><strong>{{ activeMobilePalace.changSheng || '--' }}</strong></div>
                      <div class="zw-mobile-detail-item"><span class="zw-mdi-label--daxian">大限</span><strong>{{ activeMobilePalace.daXianAge || '--' }}</strong></div>
                      <div class="zw-mobile-detail-item"><span class="zw-mdi-label--liunian">流年</span><strong>{{ activeMobilePalace.liuNianPalaceName || '--' }}</strong></div>
                    </div>
                  </section>

                  <section class="zw-mobile-detail-block">
                    <h4 class="zw-mobile-detail-title zw-mobile-detail-title--hua">辅佐与四化</h4>
                    <div class="zw-mobile-detail-list">
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--lucky">吉曜</span><p>{{ formatStarNameText(activeMobilePalace.luckyStars) }}</p></div>
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--evil">煞曜</span><p>{{ formatStarNameText(activeMobilePalace.evilStars) }}</p></div>
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--misc">杂曜</span><p>{{ formatStarNameText(activeMobilePalace.miscStars) }}</p></div>
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--birth-hua">生年四化</span><p>{{ formatBirthHuaText(activeMobilePalace.birthHuaStars) }}</p></div>
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--dx-hua">大限四化</span><p>{{ formatTransitHuaText(activeMobilePalace.daxianSiHua) }}</p></div>
                      <div class="zw-mobile-detail-row"><span class="zw-mdr-label--ln-hua">流年四化</span><p>{{ formatTransitHuaText(activeMobilePalace.liunianSiHua) }}</p></div>
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

    </main>

    <SharePosterModal
      :visible="showSharePoster"
      :profile-name="profileName"
      :chart-meta="chartMeta"
      :correction-text="correctionText"
      :highlights="mobileChartHighlights"
      :hua-facts="mobileChartHuaFacts"
      :chart-ready="Boolean(chart)"
      :ai-analysis-ready="aiAnalysisReady"
      :ai-result="aiResult"
      @close="showSharePoster = false"
    />
  </div>
</template>

<style scoped>
/* 紫微专用描边按钮，使用柔和的边框色和文字色，避免强对比 */
.ziwei-btn-outline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  font-weight: 500;
  background: transparent;
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.ziwei-btn-outline:hover:not(:disabled) {
  border-color: var(--color-border-hover);
  background: var(--color-panel-2);
}

.ziwei-btn-outline:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ziwei-btn-outline:focus-visible {
  box-shadow: var(--shadow-focus-ring);
}

.zw-action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  align-items: center;
}

.zw-generate-btn,
.zw-clear-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  height: 34px;
  padding: 0 12px;
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.zw-generate-btn {
  gap: 0;
  box-shadow: var(--shadow-button);
}

.zw-step-card,
.zw-step-item,
.zw-form-grid-two,
.zw-gender-group {
  min-width: 0;
}

.zw-step-item {
  flex: 0 0 auto;
}

.zw-step-label {
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.zw-gender-option {
  flex: 1 1 0;
  min-width: 0;
}

/* 标题栏高度与全局分割线对齐（56px header + 12px gap = 68px） */
.ziwei-header {
  height: calc(var(--header-height) + 12px);
}

/* prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* ============================================
   Modern Ziwei Chart 鈥?Card-based Layout
   Apple HIG inspired, glassmorphism cards
   ============================================ */

/* --- Summary Card --- */
.zw-main-stage {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding-bottom: 3px;
}

.zw-main-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 0;
}

.zw-main-head-copy {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.zw-view-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
}

.zw-view-switch-btn {
  min-height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-subtle);
  font: 500 var(--text-xs) / 1 var(--font-body);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-apple);
}

.zw-view-switch-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-panel-2);
}

.zw-view-switch-btn--active {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.zw-view-switch-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zw-chart-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.zw-chart-stage-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 0;
}

.zw-chart-stage-note {
  margin: 0;
  line-height: 1.35;
  font-family: var(--font-body);
}

.zw-analysis-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 8px;
  min-height: 0;
  height: 100%;
  align-content: start;
  box-sizing: border-box;
  padding-bottom: 3px;
}

.zw-analysis-split {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
}

.zw-analysis-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
  padding: 14px;
  border-radius: calc(var(--radius-lg) + 6px);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, white), color-mix(in srgb, var(--color-panel) 99%, white));
  border: 1px solid color-mix(in srgb, var(--color-border) 76%, white);
  box-shadow:
    0 24px 56px rgba(29, 39, 67, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.zw-analysis-panel--qa {
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.zw-analysis-panel--analysis {
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, white), color-mix(in srgb, var(--color-panel) 99%, white));
}

.zw-analysis-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 2px 2px;
}

.zw-analysis-panel-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.zw-analysis-panel-kicker {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 3px 9px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-accent-bg) 92%, white);
  color: var(--color-accent);
  font: 700 10px / 1 var(--font-body);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.zw-analysis-panel-chip {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  max-width: 280px;
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, var(--color-panel) 84%, white);
  border: 1px solid color-mix(in srgb, var(--color-border) 72%, white);
  color: var(--color-text-subtle);
  font: 500 11px / 1.2 var(--font-body);
  box-shadow: none;
}

.zw-analysis-panel-chip--ghost {
  background: color-mix(in srgb, var(--color-panel) 88%, var(--color-panel-2));
}

.zw-analysis-panel-body {
  min-height: 0;
  overflow-y: auto;
  padding-top: 2px;
  padding-right: 4px;
}

.zw-analysis-panel-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 16px;
  border: 1px dashed color-mix(in srgb, var(--color-border) 88%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-panel) 86%, transparent);
}

.zw-analysis-stream-card,
.zw-analysis-card,
.zw-analysis-empty {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  font-family: var(--font-body);
  box-sizing: border-box;
  max-width: 100%;
}

.zw-analysis-stream-card,
.zw-analysis-empty {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
}

.zw-analysis-stream-card {
  position: relative;
  overflow: hidden;
}

.zw-analysis-stream-card::before,
.zw-analysis-card--hero::before,
.zw-analysis-card--focus::before,
.zw-analysis-card--actions::before,
.zw-analysis-card--qa::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), transparent 30%);
}

.zw-analysis-result-wrap {
  min-height: 0;
}

.zw-analysis-desktop-grid {
  display: none;
  min-height: 0;
}

.zw-analysis-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  width: 100%;
  min-width: 0;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(8px);
  transition:
    transform var(--duration-normal) var(--ease-apple),
    box-shadow var(--duration-normal) var(--ease-apple),
    border-color var(--duration-normal) var(--ease-apple);
}

.zw-analysis-card:hover {
  transform: translateY(-1px);
  box-shadow:
    0 14px 30px rgba(30, 39, 64, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.zw-analysis-card--overview {
  grid-column: 1 / -1;
}

.zw-analysis-card--span-full {
  grid-column: 1 / -1;
}

.zw-analysis-card--qa {
  background: color-mix(in srgb, var(--color-panel) 82%, var(--color-panel-2));
}

.zw-analysis-card--qa-lead {
  margin-bottom: 8px;
}

.zw-analysis-card--hero {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.995), color-mix(in srgb, var(--color-panel) 95%, white));
  border-color: color-mix(in srgb, var(--color-accent) 14%, var(--color-border));
  box-shadow:
    0 18px 42px color-mix(in srgb, var(--color-accent-bg) 24%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
}

.zw-analysis-card--focus {
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, white), var(--color-panel));
  border-color: color-mix(in srgb, var(--color-liunian) 14%, var(--color-border));
}

.zw-analysis-card--actions {
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, white), var(--color-panel));
  border-color: color-mix(in srgb, var(--color-success) 14%, var(--color-border));
}

.zw-analysis-card--insight {
  min-height: 226px;
}

.zw-analysis-card--qa-detail {
  min-height: 172px;
}

.zw-analysis-card--question {
  background: color-mix(in srgb, var(--color-panel) 72%, var(--color-accent-bg));
}

.zw-analysis-question-text {
  margin: 0;
  font: 600 var(--text-base) / 1.6 var(--font-body);
  color: var(--color-text);
  letter-spacing: 0.01em;
}

.zw-analysis-empty--full {
  min-height: 0;
}

.zw-qa-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.zw-qa-compose-card {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-accent-border) 58%, var(--color-border));
  border-radius: var(--radius-lg);
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, var(--color-accent-bg)), var(--color-panel));
  box-shadow: var(--shadow-sm);
}

.zw-qa-compose-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.zw-qa-compose-head p {
  margin: 0;
}

.zw-qa-compose-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.zw-qa-send-btn {
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  border: none;
  border-radius: 10px;
  background: var(--color-accent);
  color: var(--color-btn-primary-text);
  cursor: pointer;
  transition: background var(--duration-fast) var(--ease-apple), transform var(--duration-fast) var(--ease-apple);
}

.zw-qa-send-btn:hover {
  background: var(--color-brand);
  transform: translateY(-1px);
}

.zw-qa-send-btn:disabled {
  transform: none;
}

.zw-analysis-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.zw-analysis-section-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font: 600 var(--text-sm) / 1.3 var(--font-body);
  color: var(--color-text);
}

.zw-analysis-section-title--qa {
  width: fit-content;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.zw-analysis-badge-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.zw-analysis-badge-row--compact {
  gap: 6px;
}

.zw-analysis-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 9px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.zw-analysis-badge--blue {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent-bg) 88%, transparent);
}

.zw-analysis-badge--orange {
  color: var(--color-major-star);
  background: color-mix(in srgb, var(--color-major-star) 16%, transparent);
}

.zw-analysis-badge--green {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success-bg) 88%, transparent);
}

.zw-analysis-badge--purple {
  color: var(--color-liunian);
  background: color-mix(in srgb, var(--color-liunian) 16%, transparent);
}

.zw-analysis-badge--red {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger-bg) 88%, transparent);
}

.zw-analysis-badge--gold {
  color: var(--color-hua-lu);
  background: color-mix(in srgb, var(--color-hua-lu) 18%, transparent);
}

.zw-analysis-card--tone-blue {
  border-color: color-mix(in srgb, var(--color-accent-border) 45%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, var(--color-accent-bg)), var(--color-panel));
}

.zw-analysis-card--tone-orange {
  border-color: color-mix(in srgb, var(--color-major-star) 16%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, color-mix(in srgb, var(--color-major-star) 4%, transparent)), var(--color-panel));
}

.zw-analysis-card--tone-green {
  border-color: color-mix(in srgb, var(--color-success) 16%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, var(--color-success-bg)), var(--color-panel));
}

.zw-analysis-card--tone-purple {
  border-color: color-mix(in srgb, var(--color-liunian) 16%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, color-mix(in srgb, var(--color-liunian) 4%, transparent)), var(--color-panel));
}

.zw-analysis-card--tone-red {
  border-color: color-mix(in srgb, var(--color-danger) 16%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, var(--color-danger-bg)), var(--color-panel));
}

.zw-analysis-card--tone-gold {
  border-color: color-mix(in srgb, var(--color-hua-lu) 16%, var(--color-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 96%, color-mix(in srgb, var(--color-hua-lu) 4%, transparent)), var(--color-panel));
}

.zw-analysis-section-title--blue {
  color: var(--color-accent);
}

.zw-analysis-section-title--orange {
  color: var(--color-major-star);
}

.zw-analysis-section-title--green {
  color: var(--color-success);
}

.zw-analysis-section-title--purple {
  color: var(--color-liunian);
}

.zw-analysis-section-title--red {
  color: var(--color-danger);
}

.zw-analysis-section-title--gold {
  color: var(--color-hua-lu);
}

.zw-analysis-section-icon {
  width: 14px;
  height: 14px;
  display: inline-block;
  flex-shrink: 0;
  background-color: currentColor;
}

.zw-analysis-icon--star {
  clip-path: polygon(50% 0%, 61% 36%, 98% 36%, 68% 58%, 79% 95%, 50% 72%, 21% 95%, 32% 58%, 2% 36%, 39% 36%);
}

.zw-analysis-icon--triangle {
  clip-path: polygon(50% 6%, 94% 88%, 6% 88%);
}

.zw-analysis-icon--diamond {
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
}

.zw-analysis-icon--sun {
  clip-path: polygon(50% 0%, 60% 24%, 86% 14%, 76% 40%, 100% 50%, 76% 60%, 86% 86%, 60% 76%, 50% 100%, 40% 76%, 14% 86%, 24% 60%, 0% 50%, 24% 40%, 14% 14%, 40% 24%);
}

.zw-analysis-icon--spark {
  clip-path: polygon(48% 0%, 58% 34%, 86% 18%, 68% 48%, 100% 52%, 66% 64%, 80% 100%, 48% 76%, 18% 100%, 30% 64%, 0% 52%, 28% 48%, 12% 18%, 40% 34%);
}

.zw-analysis-icon--moon {
  clip-path: polygon(58% 4%, 42% 10%, 28% 22%, 20% 38%, 20% 56%, 28% 72%, 42% 84%, 58% 90%, 48% 78%, 42% 64%, 40% 50%, 42% 36%, 48% 22%);
}

.zw-analysis-icon--chat {
  clip-path: polygon(8% 12%, 92% 12%, 92% 68%, 58% 68%, 40% 88%, 42% 68%, 8% 68%);
}

.zw-analysis-section-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent-bg) 94%, white), rgba(255, 255, 255, 0.78));
  border: 1px solid color-mix(in srgb, var(--color-accent) 12%, transparent);
  color: var(--color-accent);
  font: 600 10px / 1 var(--font-body);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.zw-analysis-card-text {
  margin: 0;
  font: 500 var(--text-sm) / 1.75 var(--font-body);
  color: var(--color-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.zw-analysis-text-line,
.zw-analysis-list-line {
  margin: 0;
}

.zw-analysis-text-line + .zw-analysis-text-line,
.zw-analysis-list-line + .zw-analysis-list-line {
  margin-top: 4px;
}

.zw-analysis-inline-label {
  color: var(--color-accent);
  font-weight: 700;
}

.zw-analysis-card-text--subtle {
  color: var(--color-text-subtle);
}

.zw-analysis-card-text--hero {
  font-size: 14px;
  line-height: 1.9;
  color: var(--color-text);
}

.zw-analysis-card-text--feature {
  font-size: 13px;
  line-height: 1.84;
}

.zw-analysis-card-text--lead {
  font-size: 13px;
  line-height: 1.84;
  color: color-mix(in srgb, var(--color-text) 88%, var(--color-accent));
}

.zw-analysis-meta-grid {
  display: grid;
  gap: 8px;
}

.zw-analysis-meta-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
}

.zw-analysis-meta-title {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  background: color-mix(in srgb, var(--color-panel-2) 82%, transparent);
}

.zw-analysis-meta-title--evidence {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent-bg) 88%, transparent);
}

.zw-analysis-meta-title--advice {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success-bg) 88%, transparent);
}

.zw-analysis-meta-title--opportunities {
  color: var(--color-hua-lu);
  background: color-mix(in srgb, var(--color-success-bg) 72%, transparent);
}

.zw-analysis-meta-title--risks {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger-bg) 88%, transparent);
}

.zw-analysis-meta-list {
  margin: 0;
  padding: 0 0 0 16px;
  font-size: var(--text-xs);
  line-height: 1.62;
  color: var(--color-text-subtle);
  font-family: var(--font-body);
}

.zw-analysis-meta-list--ordered {
  padding-left: 18px;
}

.zw-analysis-action-item::marker {
  color: var(--color-accent);
  font-weight: 700;
}

.zw-analysis-disclaimer {
  margin: 0;
  display: flex;
  align-items: center;
  min-height: 34px;
  padding: 6px 11px;
  margin-bottom: 1px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-accent-border);
  background: var(--color-accent-bg);
  color: var(--color-text);
  font: 500 11px / 1.2 var(--font-body);
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
  white-space: nowrap;
  overflow: visible;
  flex-shrink: 0;
}

.zw-summary-card {
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  font-family: var(--font-body);
}

.zw-chart-desktop-layout {
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
  height: 100%;
}

.zw-summary-board {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.zw-summary-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 10px 14px;
  background: var(--color-panel-2);
  border-right: 1px solid color-mix(in srgb, var(--color-border) 80%, transparent);
}

.zw-summary-panel:last-child {
  border-right: none;
}

.zw-panel-title {
  margin: 0;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.25;
}

.zw-summary-panel:nth-child(1) .zw-panel-title {
  color: var(--color-accent);
}

.zw-summary-panel:nth-child(1) .zw-k {
  color: var(--color-accent);
}

.zw-summary-panel:nth-child(2) .zw-panel-title {
  color: var(--color-major-star);
}

.zw-summary-panel:nth-child(2) .zw-k {
  color: var(--color-major-star);
}

.zw-summary-panel:nth-child(3) .zw-panel-title {
  color: var(--color-hua-lu);
}

.zw-summary-panel:nth-child(3) .zw-k {
  color: var(--color-hua-quan);
}

.zw-summary-panel:nth-child(4) .zw-panel-title {
  color: var(--color-liunian);
}

.zw-summary-panel:nth-child(4) .zw-k {
  color: var(--color-liunian);
}

.zw-panel-list {
  display: grid;
  grid-template-columns: 1fr;
  gap: 5px;
}

.zw-panel-list--dense {
  grid-template-columns: 1fr;
  gap: 6px;
}

.zw-kv {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: start;
  gap: 6px;
  font-size: var(--text-xs);
  line-height: 1.4;
  font-family: var(--font-body);
  min-width: 0;
}

.zw-k {
  color: var(--color-text-muted);
  flex-shrink: 0;
  line-height: 1.4;
}

.zw-v {
  color: var(--color-text);
  font-weight: 500;
  min-width: 0;
  font-family: var(--font-body);
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.zw-kv--stack {
  grid-template-columns: 52px minmax(0, 1fr);
}

/* --- Palace Card Ring (3-col grid) --- */
.zw-palace-ring {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  align-items: stretch;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  grid-template-rows: repeat(3, minmax(0, 1fr));
}

/* --- Single Palace Card --- */
.zw-card {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition:
    box-shadow var(--duration-normal) var(--ease-apple),
    border-color var(--duration-normal) var(--ease-apple),
    transform var(--duration-fast) var(--ease-apple);
  height: 100%;
  min-height: 0;
  overflow: hidden;
  font-family: var(--font-body);
}

.zw-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}

.zw-card--ming {
  border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
  background: color-mix(in srgb, var(--color-danger) 3%, var(--color-panel));
}

.zw-card--shen {
  border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
  background: color-mix(in srgb, var(--color-accent) 3%, var(--color-panel));
}

.zw-card--daxian {
  background: var(--color-daxian-active-bg);
  border-color: color-mix(in srgb, var(--color-hua-lu) 40%, var(--color-border));
}

/* Card Head */
.zw-card-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.zw-card-title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-wrap: wrap;
}

.zw-palace-name {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
  font-family: var(--font-body);
  line-height: 1.2;
}

.zw-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  line-height: 14px;
  font-family: var(--font-body);
}

.zw-tag--ming {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 14%, transparent);
}

.zw-tag--shen {
  color: var(--color-accent);
  background: var(--color-accent-bg);
}

.zw-tag--daxian {
  color: var(--color-hua-lu);
  background: color-mix(in srgb, var(--color-hua-lu) 14%, transparent);
}

.zw-ganzhi {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  font-family: var(--font-body);
  flex-shrink: 0;
  line-height: 1.2;
}

.zw-stars-main {
  min-width: 0;
}

.zw-star-primary {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 6px;
  min-width: 0;
}

.zw-star-primary-k {
  color: var(--color-major-star);
  font-size: 11px;
  font-weight: 600;
  font-family: var(--font-body);
  line-height: 1.35;
}

.zw-star-primary-v {
  min-width: 0;
  font-size: 11px;
  color: var(--color-major-star);
  font-weight: 600;
  font-family: var(--font-body);
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.zw-hua-pill {
  font-size: var(--text-xs);
  padding: 0 4px;
  border-radius: var(--radius-xs);
  margin-left: 2px;
  font-weight: 600;
  font-family: var(--font-body);
}

.zw-level {
  font-size: var(--text-xs);
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
  font-family: var(--font-body);
}

.zw-star-more,
.zw-card-empty {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
  line-height: 1.3;
  font-family: var(--font-body);
}

.zw-card-info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px 8px;
  padding-top: 4px;
  border-top: 1px solid color-mix(in srgb, var(--color-border) 72%, transparent);
}

.zw-card-info-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 4px;
  min-width: 0;
  font-size: 10px;
  font-family: var(--font-body);
  line-height: 1.3;
}

.zw-card-info-k {
  font-weight: 600;
}

.zw-card-info-item:nth-child(1) .zw-card-info-k {
  color: var(--color-accent);
}

.zw-card-info-item:nth-child(2) .zw-card-info-k {
  color: var(--color-success);
}

.zw-card-info-item:nth-child(3) .zw-card-info-k {
  color: var(--color-daxian);
}

.zw-card-info-item:nth-child(4) .zw-card-info-k {
  color: var(--color-liunian);
}

.zw-card-info-v {
  color: var(--color-text);
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.zw-card-lines {
  display: grid;
  gap: 3px;
  padding-top: 4px;
  border-top: 1px dashed color-mix(in srgb, var(--color-border) 66%, transparent);
}

.zw-card-line {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 4px;
  align-items: start;
  min-width: 0;
  font-size: 10px;
  line-height: 1.3;
  font-family: var(--font-body);
}

.zw-card-line-k {
  color: var(--color-text-muted);
  font-weight: 600;
}

.zw-card-line:nth-child(1) .zw-card-line-k {
  color: var(--color-success);
}

.zw-card-line:nth-child(2) .zw-card-line-k {
  color: var(--color-danger);
}

.zw-card-line:nth-child(3) .zw-card-line-k {
  color: var(--color-link);
}

.zw-card-line:nth-child(4) .zw-card-line-k {
  color: var(--color-hua-quan);
}

.zw-card-line:nth-child(5) .zw-card-line-k {
  color: var(--color-daxian);
}

.zw-card-line:nth-child(6) .zw-card-line-k {
  color: var(--color-liunian);
}

.zw-card-line-v {
  color: var(--color-text);
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

/* --- Timeline Section --- */
.zw-timeline-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: var(--color-border);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.zw-timeline-row {
  display: flex;
  background: var(--color-panel);
}

.zw-timeline-label {
  width: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-panel-2);
}

.zw-timeline-track {
  display: flex;
  flex: 1;
  overflow-x: auto;
}

.zw-timeline-item {
  flex: 1;
  min-width: 56px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-left: 1px solid var(--color-border);
}

.zw-tl-range {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text);
}

.zw-tl-branch {
  font-size: 10px;
  color: var(--color-text-muted);
  font-family: var(--font-body);
  margin-top: 2px;
}

.text-major-star {
  color: var(--color-major-star);
}

.text-link {
  color: var(--color-link);
}

.liunian-text {
  color: var(--color-liunian);
}

.hua-tag {
  color: var(--color-text);
}

.hua-lu {
  background: color-mix(in srgb, var(--color-hua-lu) 24%, transparent);
}

.hua-quan {
  background: color-mix(in srgb, var(--color-hua-quan) 24%, transparent);
}

.hua-ke {
  background: color-mix(in srgb, var(--color-hua-ke) 24%, transparent);
}

.hua-ji {
  background: color-mix(in srgb, var(--color-hua-ji) 24%, transparent);
}

/* Loading dot animation */
.loading-dot {
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

/* Nav button borders via color-mix 鈥?removed (old 4脳4 grid) */

/* Star level backgrounds via color-mix */
.level-miao {
  background: color-mix(in srgb, var(--color-page-success-alt) 20%, transparent);
  color: var(--color-page-success-alt);
}
.level-wang {
  background: color-mix(in srgb, var(--color-star-wang) 20%, transparent);
  color: var(--color-star-wang);
}
.level-de-li {
  background: color-mix(in srgb, var(--color-star-de-li) 20%, transparent);
  color: var(--color-star-de-li);
}
.level-li {
  background: color-mix(in srgb, var(--color-star-de-li) 20%, transparent);
  color: var(--color-star-de-li);
}
.level-ping {
  background: color-mix(in srgb, var(--color-star-ping) 20%, transparent);
  color: var(--color-star-ping);
}
.level-xian {
  background: color-mix(in srgb, var(--color-star-xian) 20%, transparent);
  color: var(--color-star-xian);
}

/* Vue transition classes */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
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

/* 移动端 Tab 栏 - 玻璃态浮动药丸 */
.zw-mobile-tab-bar {
  display: none;
  gap: 3px;
  margin: 4px 12px 8px;
  padding: 2px;
  background: var(--color-panel);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.zw-mobile-tab-btn {
  flex: 1;
  padding: 5px 0;
  min-height: 36px;
  font-size: 11px;
  font-weight: 500;
  font-family: var(--font-body);
  color: var(--color-text-muted);
  border: 1px solid transparent;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-apple);
}

.zw-mobile-tab-btn--active {
  background: var(--color-accent-bg);
  color: var(--color-text);
  border-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--color-accent) 8%, transparent);
}

@media (max-width: 1023px) {
  /* 解除滚动阻塞 */
  .zw-main-grid {
    overflow: hidden;
    min-height: 0;
    flex: 1;
  }

  .zw-center-panel {
    overflow-y: auto;
    padding: 0 12px 12px;
  }

  .zw-main-stage {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
    flex: 1;
  }

  /* D 对齐：隐藏命盘/AI 标题栏 */
  .zw-main-head {
    display: none;
  }

  /* D 对齐：header 简化 — 仅标题+副标题 */
  .ziwei-header {
    height: auto !important;
    padding: calc(env(safe-area-inset-top, 12px) + 6px) 16px 10px;
    padding-left: 16px;
  }

  .ziwei-header h1 {
    font-size: 18px;
    letter-spacing: 2px;
  }

  .ziwei-header .text-xs {
    display: block;
    font-size: 9px;
    letter-spacing: 2px;
    margin-top: 1px;
  }

  /* D 对齐：隐藏时间校正注释 */
  .zw-chart-stage-note {
    display: none;
  }

  /* D 对齐：紧凑空状态 */
  .zw-analysis-empty--full {
    gap: 8px;
    padding: 16px;
  }

  .zw-analysis-empty--full > .text-muted {
    display: none;
  }

  /* tab bar 触控 */
  .zw-mobile-tab-bar {
    display: flex;
  }

  .zw-mobile-tab-btn {
    min-height: 36px;
    font-size: 12px;
  }

  /* D 对齐：输入面板 12px 内距 */
  .zw-main-grid > aside {
    padding: 0 12px 12px;
  }

  /* 移动端输入面板：排盘+清除同行 + 控件缩小 */
  .zw-action-row {
    grid-template-columns: 1fr 1fr;
  }

  .zw-generate-btn {
    min-height: 40px;
    height: 40px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 1px;
    border-radius: var(--radius-lg);
  }

  .zw-clear-btn {
    min-height: 36px;
    height: 36px;
    font-size: 12px;
    border-radius: 12px;
  }

  .zw-form-body :deep(.input-control),
  .zw-form-body :deep(.form-select-trigger) {
    min-height: 36px;
    padding: 7px 10px;
    font-size: 13px;
  }

  .zw-share-row,
  .zw-step-section {
    display: none;
  }

  .zw-form-body {
    gap: 8px;
  }

  /* view-switch 触控 */
  .zw-view-switch-btn {
    min-height: 36px;
    font-size: 13px;
    flex: 1;
  }

  .zw-view-switch {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    padding: 3px;
    gap: 3px;
  }

  /* 摘要卡 2 列 */
  .zw-summary-board {
    grid-template-columns: repeat(2, 1fr);
  }

  /* 平板端：宫位卡片 2 列 */
  .zw-main-head,
  .zw-main-head-copy {
    flex-direction: column;
    align-items: flex-start;
  }

  .zw-main-head {
    gap: 8px;
  }

  .zw-main-head-copy {
    width: 100%;
    gap: 4px;
  }

  .zw-main-head-copy > span {
    font-size: 12px;
    line-height: 1.35;
  }

  .zw-chart-stage {
    grid-template-rows: auto minmax(0, 1fr);
    height: auto;
  }

  .zw-palace-ring {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(6, minmax(96px, auto));
    height: auto;
  }

  .zw-analysis-stage {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 0;
    flex: 1;
  }

  .zw-analysis-split {
    grid-template-rows: auto auto;
  }

  .zw-analysis-panel {
    grid-template-rows: auto auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
    flex: 1;
    min-height: 0;
  }

  .zw-analysis-panel--qa {
    align-self: stretch;
  }

  .zw-analysis-panel-body {
    overflow-y: visible;
    padding-right: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .zw-analysis-panel-head {
    display: none;
  }

  .zw-analysis-stream-card {
    display: none;
  }

  .zw-analysis-result-wrap {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1;
  }

  .zw-analysis-card-text,
  .zw-analysis-card-text--hero,
  .zw-analysis-card-text--feature,
  .zw-analysis-card-text--lead {
    font-size: 13px;
    line-height: 1.75;
  }

  .zw-analysis-meta-title {
    font-size: 12px;
  }

  .zw-analysis-meta-list {
    font-size: 13px;
    line-height: 1.62;
  }

  .zw-analysis-panel-chip {
    width: fit-content;
    max-width: 100%;
    justify-content: flex-start;
    white-space: normal;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .zw-mobile-chart-layout {
    display: grid;
    gap: 10px;
  }

  .zw-mobile-sanfang-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(4, minmax(0, 1fr));
    gap: 2px;
  }

  .zw-mobile-center-panel {
    grid-column: 2 / 4;
    grid-row: 2 / 4;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 8px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--color-accent-bg) 48%, var(--color-panel)), var(--color-panel));
    border: 1px solid color-mix(in srgb, var(--color-accent) 15%, var(--color-border));
    border-radius: var(--radius-lg);
    overflow-y: auto;
    position: relative;
  }

  .zw-mobile-center-panel::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent);
  }

  .zw-mc-center-name {
    font: 700 14px/1.2 var(--font-body);
    color: var(--color-text);
    word-break: keep-all;
  }

  .zw-mc-center-meta {
    font-size: 9px;
    color: var(--color-text-muted);
    margin-bottom: 2px;
    word-break: keep-all;
  }

  .zw-mc-center-info-list {
    display: grid;
    gap: 2px;
  }

  .zw-mc-info-row {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 3px;
    align-items: baseline;
    font-size: 8px;
    line-height: 1.4;
  }

  .zw-mc-info-k {
    color: var(--color-text-muted);
    font-weight: 600;
    word-break: keep-all;
    white-space: nowrap;
  }

  .zw-mc-info-v {
    color: var(--color-text);
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: keep-all;
  }

  .zw-mc-center-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3px;
  }

  .zw-mc-stat {
    text-align: center;
  }

  .zw-mc-stat-v {
    display: block;
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.3;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }

  .zw-mc-stat-l {
    display: block;
    font-size: 7px;
    color: var(--color-text-muted);
    line-height: 1.2;
    word-break: keep-all;
  }

  .zw-mc-center-divider {
    height: 1px;
    background: color-mix(in srgb, var(--color-border) 60%, transparent);
    margin: 2px 0;
  }

  .zw-mc-center-hua {
    display: grid;
    gap: 3px;
  }

  .zw-mc-hua-row {
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 4px;
    align-items: start;
    font-size: 9px;
    line-height: 1.4;
  }

  .zw-mc-hua-label {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .zw-mc-hua-value {
    color: var(--color-text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .zw-mobile-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 5px 4px;
    min-height: 72px;
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-body);
    transition:
      border-color var(--duration-fast) var(--ease-apple),
      box-shadow var(--duration-fast) var(--ease-apple);
  }

  .zw-mobile-cell::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-border) 40%, transparent), transparent);
  }

  .zw-mobile-cell:active {
    transform: scale(0.97);
  }

  .zw-mobile-cell--ming {
    border-color: color-mix(in srgb, var(--color-danger) 40%, var(--color-border));
    background: color-mix(in srgb, var(--color-danger) 3%, var(--color-panel));
  }

  .zw-mobile-cell--shen {
    border-color: color-mix(in srgb, var(--color-accent) 30%, var(--color-border));
    background: color-mix(in srgb, var(--color-accent) 3%, var(--color-panel));
  }

  .zw-mobile-cell--daxian {
    border-color: color-mix(in srgb, var(--color-hua-lu) 40%, var(--color-border));
    background: var(--color-daxian-active-bg);
  }

  .zw-mc-badge {
    position: absolute;
    top: 2px;
    right: 3px;
    font-size: 7px;
    padding: 1px 4px;
    border-radius: 5px;
    font-weight: 600;
    line-height: 1.3;
  }

  .zw-mc-badge--ming {
    background: color-mix(in srgb, var(--color-danger) 14%, transparent);
    color: var(--color-danger);
  }

  .zw-mc-badge--shen {
    background: var(--color-accent-bg);
    color: var(--color-accent);
  }

  .zw-mc-badge--daxian {
    background: color-mix(in srgb, var(--color-hua-lu) 14%, transparent);
    color: var(--color-hua-lu);
  }

  .zw-mc-pn {
    font-size: 10px;
    font-weight: 600;
    color: var(--color-text);
    line-height: 1.2;
  }

  .zw-mc-gz {
    font-size: 7px;
    color: var(--color-text-muted);
    margin-bottom: 1px;
  }

  .zw-mc-stars {
    display: flex;
    flex-wrap: wrap;
    gap: 1px 3px;
  }

  .zw-mc-star {
    font-size: 8.5px;
    font-weight: 600;
    line-height: 1.3;
  }

  .zw-mc-star sup {
    font-size: 6px;
    font-weight: 400;
    margin-left: 0.5px;
    opacity: 0.7;
  }

  .zw-mc-hua-tags {
    display: flex;
    gap: 2px;
    margin-top: 1px;
  }

  .zw-mc-ht {
    font-size: 6px;
    padding: 1px 3px;
    border-radius: 2px;
    font-weight: 600;
  }

  .zw-mc-aux {
    font-size: 7px;
    color: var(--color-text-muted);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .zw-mc-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 10px;
    padding: 6px 2px;
    font-size: 8px;
    color: var(--color-text-muted);
  }

  .zw-mc-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .zw-mc-legend-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .zw-mc-legend-dot.level-miao { background: var(--color-hua-lu); }
  .zw-mc-legend-dot.level-wang { background: var(--color-hua-quan); }
  .zw-mc-legend-dot.level-de { background: var(--color-accent); }
  .zw-mc-legend-dot.level-xian { background: var(--color-hua-ji); }

  .zw-mc-yaosu-card {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 12px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .zw-mc-yaosu-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-border) 60%, transparent), transparent);
  }

  .zw-mc-yaosu-title {
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 2px;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .zw-mc-yaosu-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .zw-mc-yaosu-item {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 4px;
    align-items: start;
    font-size: 10px;
    line-height: 1.4;
  }

  .zw-mc-yaosu-k {
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .zw-yaosu-k--accent { color: var(--color-accent); }
  .zw-yaosu-k--major { color: var(--color-major-star); }
  .zw-yaosu-k--hua { color: var(--color-hua-lu); }
  .zw-yaosu-k--liunian { color: var(--color-liunian); }

  .zw-mc-yaosu-v {
    color: var(--color-text);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .zw-mc-hua-section {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 12px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .zw-mc-hua-section::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-border) 60%, transparent), transparent);
  }

  .zw-mc-hua-section-title {
    font-size: 10px;
    color: var(--color-text-muted);
    letter-spacing: 2px;
    margin-bottom: 8px;
    font-weight: 500;
  }

  .zw-mc-hua-section-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 0;
  }

  .zw-mc-hua-section-row:not(:last-child) {
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 40%, transparent);
  }

  .zw-mc-hua-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .zw-mc-hua-icon--birth {
    background: color-mix(in srgb, var(--color-hua-lu) 12%, transparent);
    color: var(--color-hua-lu);
  }

  .zw-mc-hua-icon--dx {
    background: var(--color-accent-bg);
    color: var(--color-accent);
  }

  .zw-mc-hua-icon--ln {
    background: color-mix(in srgb, var(--color-liunian) 12%, transparent);
    color: var(--color-liunian);
  }

  .zw-mc-hua-pills {
    display: flex;
    gap: 3px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
  }

  .zw-mc-hua-pill {
    font-size: 10px;
    padding: 3px 7px;
    border-radius: 6px;
    font-weight: 500;
    border: 1px solid transparent;
  }

  .zw-mc-hua-pill.hua-tag.hua-lu {
    color: var(--color-hua-lu);
    background: color-mix(in srgb, var(--color-hua-lu) 6%, transparent);
    border-color: color-mix(in srgb, var(--color-hua-lu) 14%, transparent);
  }

  .zw-mc-hua-pill.hua-tag.hua-quan {
    color: var(--color-hua-quan);
    background: color-mix(in srgb, var(--color-hua-quan) 6%, transparent);
    border-color: color-mix(in srgb, var(--color-hua-quan) 14%, transparent);
  }

  .zw-mc-hua-pill.hua-tag.hua-ke {
    color: var(--color-hua-ke);
    background: color-mix(in srgb, var(--color-hua-ke) 6%, transparent);
    border-color: color-mix(in srgb, var(--color-hua-ke) 14%, transparent);
  }

  .zw-mc-hua-pill.hua-tag.hua-ji {
    color: var(--color-hua-ji);
    background: color-mix(in srgb, var(--color-hua-ji) 6%, transparent);
    border-color: color-mix(in srgb, var(--color-hua-ji) 12%, transparent);
  }

  .zw-mobile-sheet-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .zw-mobile-kicker {
    margin: 0 0 4px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-accent);
  }

  .zw-mobile-sheet-title {
    margin: 0;
    font: 600 16px/1.35 var(--font-body);
    color: var(--color-text);
  }

  .zw-mobile-chart-note {
    margin: 0;
    padding: 10px 12px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--color-accent-bg) 62%, white);
    font-size: 12px;
    line-height: 1.55;
    color: var(--color-text);
  }

  .zw-mobile-sheet-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .zw-mobile-detail-text,
  .zw-mobile-detail-row p {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .zw-mobile-sheet-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    display: flex;
    align-items: flex-end;
    justify-content: stretch;
    padding: 16px 12px calc(12px + env(safe-area-inset-bottom, 0px));
    background: rgba(12, 18, 30, 0.32);
    backdrop-filter: blur(6px);
  }

  .zw-mobile-sheet {
    width: 100%;
    max-height: min(82vh, 720px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 12px;
    padding: 12px 14px 14px;
    border-radius: 22px 22px 18px 18px;
    border: 1px solid color-mix(in srgb, var(--color-border) 88%, white);
    background:
      radial-gradient(circle at top center, color-mix(in srgb, var(--color-accent-bg) 50%, transparent), transparent 44%),
      linear-gradient(180deg, color-mix(in srgb, var(--color-panel) 98%, white), var(--color-panel));
    box-shadow: 0 -8px 34px rgba(14, 24, 43, 0.16);
  }

  .zw-mobile-sheet-handle {
    width: 42px;
    height: 4px;
    margin: 0 auto;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-border) 74%, var(--color-subtle));
  }

  .zw-mobile-sheet-close {
    flex-shrink: 0;
    border: none;
    border-radius: 999px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--color-accent-bg) 76%, white);
    font-size: 12px;
    font-weight: 600;
    color: var(--color-accent);
    cursor: pointer;
  }

  .zw-mobile-sheet-scroll {
    min-height: 0;
    overflow-y: auto;
    display: grid;
    gap: 12px;
    padding-right: 2px;
  }

  .zw-mobile-sheet-chip {
    display: inline-flex;
    align-items: center;
    padding: 5px 10px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-panel-2) 92%, white);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
    color: var(--color-text);
  }

  .zw-mobile-detail-block {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid color-mix(in srgb, var(--color-border) 78%, white);
    border-radius: 16px;
    background: color-mix(in srgb, var(--color-panel) 94%, white);
  }

  .zw-mobile-detail-title {
    margin: 0;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-body);
    line-height: 1.2;
    color: var(--color-accent);
  }

  .zw-mobile-detail-title--stars {
    color: var(--color-major-star);
  }

  .zw-mobile-detail-title--basic {
    color: var(--color-accent);
  }

  .zw-mobile-detail-title--hua {
    color: var(--color-hua-lu);
  }

  .zw-mobile-detail-text {
    font-size: 13px;
    font-family: var(--font-body);
    line-height: 1.6;
    color: var(--color-text);
  }

  .zw-mobile-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .zw-mobile-detail-item {
    display: grid;
    gap: 4px;
    padding: 10px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--color-bg) 60%, white);
  }

  .zw-mobile-detail-item span,
  .zw-mobile-detail-row span {
    font-size: 13px;
    font-family: var(--font-body);
    line-height: 1.45;
    color: var(--color-subtle);
  }

  .zw-mobile-detail-item strong {
    font-size: 13px;
    font-family: var(--font-body);
    font-weight: 400;
    line-height: 1.45;
    color: var(--color-text);
  }

  .zw-mobile-detail-list {
    display: grid;
    gap: 8px;
  }

  .zw-mobile-detail-row {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    gap: 8px;
    align-items: start;
  }

  .zw-mobile-detail-row p {
    font-family: var(--font-body);
    font-size: 13px;
    line-height: 1.5;
  }

  .zw-mobile-detail-row .zw-mdr-label--lucky { color: var(--color-hua-lu); }
  .zw-mobile-detail-row .zw-mdr-label--evil { color: var(--color-hua-ji); }
  .zw-mobile-detail-row .zw-mdr-label--misc { color: var(--color-text-muted); }
  .zw-mobile-detail-row .zw-mdr-label--birth-hua { color: var(--color-hua-quan); }
  .zw-mobile-detail-row .zw-mdr-label--dx-hua { color: var(--color-accent); }
  .zw-mobile-detail-row .zw-mdr-label--ln-hua { color: var(--color-liunian); }

  .zw-mobile-detail-item .zw-mdi-label--branch { color: var(--color-accent); }
  .zw-mobile-detail-item .zw-mdi-label--changsheng { color: var(--color-major-star); }
  .zw-mobile-detail-item .zw-mdi-label--daxian { color: var(--color-hua-lu); }
  .zw-mobile-detail-item .zw-mdi-label--liunian { color: var(--color-liunian); }

  .zw-mobile-analysis-flow,
  .zw-mobile-analysis-stream {
    display: grid;
    gap: 8px;
  }

  .zw-mobile-hscroll {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    flex: 1;
  }

  .zw-mobile-hscroll-track {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    scrollbar-width: none;
    min-height: 200px;
  }

  .zw-mobile-hscroll-track::-webkit-scrollbar { display: none; }

  .zw-hscroll-card {
    width: 100%;
    min-height: auto;
  }

  .zw-hscroll-card.zw-mqas-card {
    min-height: auto;
  }

  .zw-mobile-hscroll-tags {
    display: none;
  }

  .zw-mobile-hscroll-tag {
    flex-shrink: 0;
    padding: 6px 12px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    background: var(--color-panel);
    color: var(--color-text-muted);
    font-size: 11px;
    font-weight: 500;
    font-family: var(--font-body);
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-apple);
    white-space: nowrap;
  }

  .zw-mobile-hscroll-tag--active {
    background: var(--color-accent-bg);
    color: var(--color-accent);
    border-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
  }

  /* 移动端 QA 简洁布局 — 匹配 D 方案 */
  .zw-mobile-qa-simple {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .zw-mqas-conversation {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: none;
    width: 100%;
  }

  .zw-mqas-conversation::-webkit-scrollbar { display: none; }

  /* 欢迎卡片 */
  .zw-mqas-welcome {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .zw-mqas-welcome-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }

  .zw-mqas-welcome-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .zw-mqas-suggestions {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .zw-mqas-suggestions-label {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: 0;
  }

  .zw-mqas-suggestion {
    display: block;
    width: 100%;
    padding: 8px 10px;
    background: var(--color-panel-2);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    font-size: 12px;
    color: var(--color-text);
    text-align: left;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-apple);
    box-sizing: border-box;
  }

  .zw-mqas-suggestion:hover {
    background: var(--color-accent-bg);
    border-color: color-mix(in srgb, var(--color-accent) 30%, transparent);
  }

  /* 对话消息 */
  .zw-mqas-message {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 12px;
    width: 100%;
    box-sizing: border-box;
  }

  .zw-mqas-message--ai {
    border-left: 3px solid var(--color-accent);
  }

  .zw-mqas-message--user {
    border-left: 3px solid var(--color-success);
    order: -1;
  }

  .zw-mqas-message--loading {
    display: none;
  }

  .zw-mqas-message-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }

  .zw-mqas-avatar {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .zw-mqas-avatar--ai {
    background: linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 80%, var(--color-text)));
    color: var(--color-panel);
  }

  .zw-mqas-avatar--user {
    background: linear-gradient(135deg, var(--color-success), color-mix(in srgb, var(--color-success) 80%, var(--color-text)));
    color: var(--color-panel);
  }

  .zw-mqas-message-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--color-text);
  }

  .zw-mqas-message-body {
    font-size: 12px;
    line-height: 1.7;
    color: var(--color-text);
  }

  .zw-mqas-message-body p {
    margin: 0;
  }

  /* 打字动画 */
  .zw-mqas-typing {
    display: flex;
    gap: 4px;
    padding: 4px 0;
  }

  .zw-mqas-typing span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-text-muted);
    animation: zw-mqas-typing 1.4s infinite;
  }

  .zw-mqas-typing span:nth-child(2) { animation-delay: 0.2s; }
  .zw-mqas-typing span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes zw-mqas-typing {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  .zw-mqas-input-row {
    display: flex;
    gap: 6px;
    padding-top: 4px;
    flex-shrink: 0;
    width: 100%;
  }

  .zw-mqas-input {
    flex: 1;
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-panel);
    color: var(--color-text);
    font-size: 13px;
    font-family: var(--font-body);
    outline: none;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    min-height: 34px;
    box-sizing: border-box;
  }

  .zw-mqas-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 80%, var(--color-text)));
    color: var(--color-panel);
    font-size: 12px;
    font-weight: 500;
    font-family: var(--font-body);
    cursor: pointer;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--color-accent) 20%, transparent);
    flex-shrink: 0;
    min-height: 34px;
    box-sizing: border-box;
  }

  .zw-mqas-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .zw-mqas-card {
    background: var(--color-panel);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 12px;
    border-left: 2px solid var(--color-accent);
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .zw-mqas-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-border) 40%, transparent), transparent);
  }

  .zw-mqas-card--lead {
    border-left-color: var(--color-hua-lu);
  }

  .zw-mqas-card-title {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--color-accent);
  }

  .zw-mqas-card-title--lead {
    color: var(--color-hua-lu);
  }

  .zw-mqas-card-text {
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.7;
  }

  .zw-mobile-flow-hero {
    padding: 16px;
  }

  .zw-mobile-analysis-stream .zw-mobile-flow-hero {
    max-height: min(58vh, 520px);
  }

  .zw-analysis-card-text--stream {
    max-height: min(42vh, 380px);
    overflow-y: auto;
    padding-right: 2px;
  }

  .zw-mobile-flow-card {
    min-height: auto;
  }

  .zw-analysis-card-head {
    align-items: flex-start;
    gap: 8px;
  }

  .zw-analysis-section-title {
    flex: 1 1 auto;
    min-width: 0;
  }

  .zw-analysis-section-title span:last-child {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  .zw-analysis-section-index {
    flex-shrink: 0;
  }

  .zw-analysis-card--insight,
  .zw-analysis-card--qa-detail {
    min-height: auto;
  }

  .zw-analysis-disclaimer {
    min-height: auto;
    padding: 8px;
    background: none;
    border: none;
    text-align: center;
    font-size: 10px;
    color: var(--color-text-muted);
    box-shadow: none;
    white-space: normal;
    line-height: 1.4;
  }

  .zw-summary-panel {
    padding: 10px 12px;
  }

  .zw-panel-list,
  .zw-panel-list--dense {
    gap: 7px;
  }

  .zw-kv {
    grid-template-columns: 52px minmax(0, 1fr);
    gap: 5px;
  }

  .zw-kv--stack {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .zw-card-info-grid {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .zw-card-info-item {
    grid-template-columns: 34px minmax(0, 1fr);
  }

  .zw-card-lines {
    gap: 4px;
  }

  .zw-card-line {
    grid-template-columns: 18px minmax(0, 1fr);
  }

  .zw-qa-card-grid {
    grid-template-columns: 1fr;
  }

  .zw-qa-compose-head,
  .zw-qa-compose-row {
    flex-direction: column;
    align-items: stretch;
  }

  .zw-qa-compose-card {
    display: none;
  }

  .zw-qa-send-btn {
    width: 100%;
    min-height: 44px;
    height: 44px;
  }
}

@media (min-width: 1024px) {
  .zw-chart-stage {
    grid-template-rows: minmax(0, 1fr);
  }

  .zw-analysis-desktop-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
    min-height: 0;
  }

  .zw-palace-ring {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    grid-template-rows: repeat(3, minmax(0, 1fr));
    height: 100%;
  }

  .zw-chart-desktop-layout {
    overflow: hidden;
  }
}

@media (max-width: 600px) {
  /* 手机端 */
  .zw-action-row {
    grid-template-columns: 1fr 1fr;
  }

  .zw-step-card {
    padding: 10px;
  }

  .zw-step-item {
    max-width: 68px;
  }

  .zw-step-label {
    font-size: 9px;
  }

  .zw-step-divider {
    margin-left: 6px;
    margin-right: 6px;
  }

  .zw-form-grid-two {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }

  .zw-gender-group {
    flex-direction: row;
  }

  .zw-gender-option {
    justify-content: flex-start;
  }

  .zw-generate-btn,
  .zw-clear-btn {
    padding: 0 10px;
  }

  .zw-palace-ring {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
    grid-template-rows: repeat(6, minmax(92px, auto));
  }
  .zw-card {
    padding: 7px 8px 6px;
  }
  .zw-palace-name {
    font-size: var(--text-xs);
  }
  .zw-summary-board {
    grid-template-columns: 1fr;
  }

  .zw-view-switch-btn {
    min-height: 34px;
    font-size: 12px;
    padding: 0 6px;
  }

  .zw-analysis-stream-card,
  .zw-analysis-card,
  .zw-analysis-empty {
    padding: 12px;
  }

  .zw-analysis-panel {
    padding: 8px;
    background: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  .zw-analysis-card-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .zw-analysis-section-index {
    align-self: flex-start;
  }

  .zw-analysis-panel-chip {
    font-size: 10px;
    padding: 5px 8px;
  }

  .zw-analysis-badge {
    font-size: 10px;
    padding: 4px 8px;
  }

  .zw-summary-panel {
    padding: 9px 10px;
  }

  .zw-kv,
  .zw-kv--stack {
    grid-template-columns: 48px minmax(0, 1fr);
  }

  .zw-card-info-item {
    grid-template-columns: 30px minmax(0, 1fr);
  }

  /* 手机端间距 */
  .zw-main-stage {
    gap: 6px;
  }

  .zw-analysis-card {
    border-radius: 14px;
    overflow: visible;
  }

  .zw-center-panel {
    padding: 0 12px 12px;
  }

  .zw-mobile-sheet,
  .zw-mobile-flow-hero,
  .zw-mobile-flow-card {
    border-radius: 16px;
  }

  .zw-mobile-flow-hero {
    padding: 12px;
  }

  .zw-mobile-cell {
    min-height: 64px;
    padding: 4px 3px;
  }

  .zw-mc-pn {
    font-size: 9px;
  }

  .zw-mc-star {
    font-size: 8px;
  }

  .zw-mc-center-name {
    font-size: 13px;
  }

  .zw-mc-center-stats {
    gap: 3px;
  }

  .zw-mc-stat-v {
    font-size: 10px;
  }

  .zw-mc-hua-row {
    grid-template-columns: 44px minmax(0, 1fr);
    font-size: 8px;
  }

  .zw-mobile-detail-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .zw-mobile-detail-row {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .zw-mobile-sheet-backdrop {
    padding-left: 8px;
    padding-right: 8px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
  }

  .zw-mobile-sheet {
    padding: 10px 12px 12px;
  }
}
</style>

