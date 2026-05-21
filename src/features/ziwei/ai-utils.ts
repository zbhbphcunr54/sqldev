import { asArray, asNumber, asRecord, asString, type RecordLike } from '@/utils/type-guards'

// AI 分析结果中每颗星的最大化禄标签数量
const MAX_HUA_TAGS_PER_STAR = 4
// AI 分析结果中每项规则摘要的最多条目数
const MAX_RULE_SUMMARY_ITEMS = 3
// AI 分析结果中文字段的最大长度
const MAX_RULE_TEXT_LENGTH = 320
// AI 分析结果中每行的最大长度
const MAX_LINE_LENGTH = 160

export interface ZiweiAiPayloadOptions {
  profileName?: unknown
  ruleSummary?: unknown
  now?: () => number
}

export interface ParsedInvokeError {
  status: number
  detail: string
}

export function trimZiweiText(value: unknown, maxLen: unknown): string {
  const text = String(value == null ? '' : value)
  const limit = Number(maxLen || 0)
  if (!Number.isFinite(limit) || limit <= 0) return text.trim()
  if (text.length <= limit) return text.trim()
  return text.slice(0, limit).trim()
}

function mapStar(starValue: unknown, includeBrightness: boolean): RecordLike {
  const star = asRecord(starValue)
  const result: RecordLike = {
    name: asString(star.name),
    huaTags: asArray(star.huaTags).slice(0, MAX_HUA_TAGS_PER_STAR)
  }
  if (includeBrightness) result.brightness = asString(star.brightness)
  return result
}

function mapRuleSummary(ruleValue: unknown): RecordLike {
  const item = asRecord(ruleValue)
  return {
    key: asString(item.key),
    title: asString(item.title),
    level: asString(item.level),
    text: trimZiweiText(item.text, MAX_RULE_TEXT_LENGTH),
    plain: asArray(item.plain)
      .slice(0, MAX_RULE_SUMMARY_ITEMS)
      .map((line) => trimZiweiText(line, MAX_LINE_LENGTH)),
    evidence: asArray(item.evidence)
      .slice(0, MAX_RULE_SUMMARY_ITEMS)
      .map((line) => trimZiweiText(line, MAX_LINE_LENGTH))
  }
}

function mapPalaceCell(cellValue: unknown): RecordLike {
  const cell = asRecord(cellValue)
  const mainStars = asArray(cell.mainStars)
  const assistStars = asArray(cell.assistStars)
  const miscStars = asArray(cell.miscStars)

  return {
    branch: asString(cell.branch),
    palaceName: asString(cell.palaceName),
    area: asString(cell.area),
    stemBranch: asString(cell.stemBranch),
    isMing: Boolean(cell.isMing),
    isShen: Boolean(cell.isShen),
    mainStars: mainStars.map((s) => mapStar(s, true)),
    assistStars: assistStars.map((s) => mapStar(s, false)),
    miscStars: miscStars.map((s) => mapStar(s, false)),
    mainStarsText: trimZiweiText(cell.mainStarsText, 220),
    assistStarsText: trimZiweiText(cell.assistStarsText, 220),
    miscStarsText: trimZiweiText(cell.miscStarsText, 220),
    daXian: asString(cell.daXian),
    xiaoXian: asString(cell.xiaoXian),
    changSheng: asString(cell.changSheng),
    currentLiuNian: asNumber(cell.currentLiuNian),
    currentXiaoXian: asNumber(cell.currentXiaoXian),
    liuNianSeries: asArray(cell.liuNianSeries).slice(0, 12),
    xiaoXianSeries: asArray(cell.xiaoXianSeries).slice(0, 12),
    liuNianSeriesText: trimZiweiText(cell.liuNianSeriesText, 240),
    xiaoXianSeriesText: trimZiweiText(cell.xiaoXianSeriesText, 240),
    outgoingHuaCount: asNumber(cell.outgoingHuaCount),
    incomingHuaCount: asNumber(cell.incomingHuaCount)
  }
}

function mapHuaTrack(trackValue: unknown): RecordLike {
  const t = asRecord(trackValue)
  return {
    tag: asString(t.tag),
    star: asString(t.star),
    sourceBranch: asString(t.sourceBranch),
    sourceText: asString(t.sourceText),
    targetBranch: asString(t.targetBranch),
    targetText: asString(t.targetText)
  }
}

function buildCenterData(center: RecordLike): RecordLike {
  const result: RecordLike = {}
  const stringFields = [
    'genderLabel',
    'yinYangGenderLabel',
    'calendarInputType',
    'schoolLabel',
    'solarText',
    'inputClockText',
    'lunarText',
    'naYinLabel',
    'yearGanZhi',
    'bureauLabel',
    'mingBranch',
    'mingPalaceName',
    'shenBranch',
    'shenPalaceName',
    'ziweiBranch',
    'tianfuBranch',
    'monthLabel',
    'shichenLabel',
    'mingZhu',
    'shenZhu',
    'daXianDirectionLabel',
    'clockMode',
    'clockModeLabel',
    'timeCorrectionText',
    'timezoneOffset',
    'xiaoXianRuleLabel',
    'liuNianRuleLabel',
    'currentYearLabel',
    'currentYearGanZhiLabel',
    'currentAgeLabel',
    'currentDaXianLabel',
    'currentLiuNianPalaceLabel',
    'qiYunText',
    'school'
  ]
  const numFields = new Set([
    'longitude',
    'longitudeCorrectionMinutes',
    'equationOfTimeMinutes',
    'birthYearForAge',
    'birthMonthForAge',
    'birthDayForAge'
  ])

  for (const key of stringFields) {
    result[key] = numFields.has(key) ? asNumber(center[key]) : asString(center[key])
  }
  result.shiftedByZiHour = Boolean(center.shiftedByZiHour)
  result.nonJieqiPillars = asArray(center.nonJieqiPillars).slice(0, 4)
  result.jieqiPillars = asArray(center.jieqiPillars).slice(0, 4)
  result.decadeMarks = asArray(center.decadeMarks).slice(0, 8)
  result.huaSummary = asArray(center.huaSummary)
    .slice(0, 6)
    .map((itemValue) => asString(asRecord(itemValue).label))
  return result
}

function mapDaXianItem(itemValue: unknown): RecordLike {
  const item = asRecord(itemValue)
  return {
    range: asString(item.range),
    branch: asString(item.branch),
    palaceName: asString(item.palaceName)
  }
}

function mapLiuNianItem(itemValue: unknown): RecordLike {
  const item = asRecord(itemValue)
  return {
    year: asNumber(item.year),
    age: asNumber(item.age),
    ganzhi: asString(item.ganzhi),
    branch: asString(item.branch),
    palaceName: asString(item.palaceName)
  }
}

export function buildZiweiAiPayload(
  chartValue: unknown,
  options: ZiweiAiPayloadOptions = {}
): RecordLike {
  const chart = asRecord(chartValue)
  const center = asRecord(chart.center)

  return {
    payloadVersion: 'ziwei-ai-v2',
    generatedAt: asNumber(chart.generatedAt) || (options.now ? options.now() : Date.now()),
    profileName: trimZiweiText(options.profileName, 80),
    center: buildCenterData(center),
    daXianTimeline: asArray(chart.daXianTimeline).slice(0, 12).map(mapDaXianItem),
    liuNianTimeline: asArray(chart.liuNianTimeline).slice(0, 36).map(mapLiuNianItem),
    palaces: asArray(chart.boardCells).map(mapPalaceCell),
    huaTracks: asArray(chart.huaTracks).slice(0, 96).map(mapHuaTrack),
    ruleSummary: asArray(options.ruleSummary).slice(0, 8).map(mapRuleSummary),
    chartText: trimZiweiText(chart.text, 12000)
  }
}

function compactPalace(
  itemValue: unknown,
  mode: 'legacy' | 'compact' | 'lite' | 'analysis' | 'qa'
): RecordLike {
  const item = asRecord(itemValue)
  if (mode === 'legacy') {
    const palace = { ...item }
    palace.mainStars = asArray(palace.mainStars).slice(0, 6)
    palace.assistStars = asArray(palace.assistStars).slice(0, 8)
    palace.miscStars = asArray(palace.miscStars).slice(0, 8)
    palace.liuNianSeries = asArray(palace.liuNianSeries).slice(0, 4)
    palace.xiaoXianSeries = asArray(palace.xiaoXianSeries).slice(0, 4)
    palace.liuNianSeriesText = ''
    palace.xiaoXianSeriesText = ''
    return palace
  }

  if (mode === 'lite') {
    return {
      branch: asString(item.branch),
      palaceName: asString(item.palaceName),
      stemBranch: asString(item.stemBranch),
      mainStars: asArray(item.mainStars).slice(0, 2),
      assistStars: asArray(item.assistStars).slice(0, 2),
      miscStars: asArray(item.miscStars).slice(0, 2)
    }
  }

  if (mode === 'analysis') {
    return {
      branch: asString(item.branch),
      palaceName: asString(item.palaceName),
      stemBranch: asString(item.stemBranch),
      area: asString(item.area),
      changSheng: asString(item.changSheng),
      daXian: asString(item.daXian),
      xiaoXian: asString(item.xiaoXian),
      currentLiuNian: asNumber(item.currentLiuNian),
      liuNianSeries: asArray(item.liuNianSeries).slice(0, 6),
      mainStars: asArray(item.mainStars).slice(0, 4),
      assistStars: asArray(item.assistStars).slice(0, 4),
      miscStars: asArray(item.miscStars).slice(0, 4),
      outgoingHuaCount: asNumber(item.outgoingHuaCount),
      incomingHuaCount: asNumber(item.incomingHuaCount)
    }
  }

  if (mode === 'qa') {
    return {
      branch: asString(item.branch),
      palaceName: asString(item.palaceName),
      stemBranch: asString(item.stemBranch),
      changSheng: asString(item.changSheng),
      daXian: asString(item.daXian),
      xiaoXian: asString(item.xiaoXian),
      currentLiuNian: asNumber(item.currentLiuNian),
      liuNianSeries: asArray(item.liuNianSeries).slice(0, 6),
      mainStars: asArray(item.mainStars).slice(0, 4),
      assistStars: asArray(item.assistStars).slice(0, 4),
      miscStars: asArray(item.miscStars).slice(0, 4)
    }
  }

  return {
    branch: asString(item.branch),
    palaceName: asString(item.palaceName),
    stemBranch: asString(item.stemBranch),
    daXian: asString(item.daXian),
    xiaoXian: asString(item.xiaoXian),
    currentLiuNian: asNumber(item.currentLiuNian),
    mainStars: asArray(item.mainStars).slice(0, 4),
    assistStars: asArray(item.assistStars).slice(0, 4),
    miscStars: asArray(item.miscStars).slice(0, 4)
  }
}

export function buildZiweiAiPayloadLegacyCompact(payloadValue: unknown): RecordLike {
  const payload = { ...asRecord(payloadValue) }
  payload.payloadVersion = 'ziwei-ai-v2-compact'
  payload.chartText = ''
  payload.ruleSummary = asArray(payload.ruleSummary).slice(0, 4)
  payload.huaTracks = asArray(payload.huaTracks).slice(0, 48)
  payload.liuNianTimeline = asArray(payload.liuNianTimeline).slice(0, 12)
  payload.daXianTimeline = asArray(payload.daXianTimeline).slice(0, 8)
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'legacy'))
  return payload
}

export function buildZiweiAiPayloadCompact(payloadValue: unknown): RecordLike {
  const payload = { ...asRecord(payloadValue) }
  payload.payloadVersion = 'ziwei-ai-v2-compact-v2'
  payload.chartText = ''
  payload.ruleSummary = []
  payload.huaTracks = asArray(payload.huaTracks).slice(0, 20)
  payload.liuNianTimeline = asArray(payload.liuNianTimeline).slice(0, 8)
  payload.daXianTimeline = asArray(payload.daXianTimeline).slice(0, 6)
  payload.center = trimCenter(asRecord(payload.center))
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'compact'))
  return payload
}

function trimCenter(center: RecordLike): RecordLike {
  return {
    ...center,
    timeCorrectionText: '',
    longitude: 0,
    longitudeCorrectionMinutes: 0,
    equationOfTimeMinutes: 0,
    nonJieqiPillars: [],
    jieqiPillars: [],
    decadeMarks: []
  }
}

export function buildZiweiAiPayloadForAnalysis(payloadValue: unknown): RecordLike {
  const payload = { ...asRecord(payloadValue) }
  payload.payloadVersion = 'ziwei-ai-v2-analysis'
  payload.chartText = ''
  payload.ruleSummary = asArray(payload.ruleSummary).slice(0, 6)
  payload.huaTracks = asArray(payload.huaTracks).slice(0, 40)
  payload.liuNianTimeline = asArray(payload.liuNianTimeline).slice(0, 12)
  payload.daXianTimeline = asArray(payload.daXianTimeline).slice(0, 8)
  payload.center = trimCenter(asRecord(payload.center))
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'analysis'))
  return payload
}

export function buildZiweiAiPayloadForQa(payloadValue: unknown): RecordLike {
  const payload = { ...asRecord(payloadValue) }
  payload.payloadVersion = 'ziwei-ai-v2-qa'
  payload.chartText = ''
  payload.ruleSummary = asArray(payload.ruleSummary).slice(0, 4)
  payload.huaTracks = asArray(payload.huaTracks).slice(0, 20)
  payload.liuNianTimeline = asArray(payload.liuNianTimeline).slice(0, 8)
  payload.daXianTimeline = asArray(payload.daXianTimeline).slice(0, 6)
  payload.center = trimCenter(asRecord(payload.center))
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'qa'))
  return payload
}

export function buildZiweiAiPayloadLite(payloadValue: unknown): RecordLike {
  const payload = buildZiweiAiPayloadCompact(payloadValue)
  payload.payloadVersion = 'ziwei-ai-v2-lite-v2'
  payload.huaTracks = []
  payload.liuNianTimeline = []
  payload.daXianTimeline = []
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'lite'))
  return payload
}

export async function parseZiweiInvokeError(err: unknown): Promise<ParsedInvokeError> {
  let status = 0
  let detail = ''
  const errorRecord = asRecord(err)

  try {
    const ctx = asRecord(errorRecord.context)
    if (typeof ctx.status === 'number') status = ctx.status
    if (typeof ctx.clone === 'function') {
      const cloned = ctx.clone() as { text?: () => Promise<string> }
      const text = cloned.text ? await cloned.text() : ''
      if (text) {
        try {
          const parsed = JSON.parse(text) as RecordLike
          detail = asString(parsed.error || parsed.message || text)
        } catch (e) {
          console.warn('[ziwei:ai-utils] failed to parse error context JSON:', e)
          detail = asString(text)
        }
      }
    }
  } catch (e) {
    console.warn('[ziwei:ai-utils] error context extraction failed:', e)
  }

  if (!detail) {
    const message = errorRecord.message
    detail = asString(message || err)
  }

  return { status, detail }
}

export function isZiweiComputeResourceError(raw: unknown): boolean {
  const text = asString(raw).toLowerCase()
  if (!text) return false
  return (
    text.includes('compute resources') ||
    text.includes('not having enough compute resources') ||
    text.includes('out of memory') ||
    text.includes('memory limit') ||
    text.includes('resource exhausted')
  )
}

export function isZiweiAiRateLimitError(raw: unknown): boolean {
  const text = asString(raw).toLowerCase()
  if (!text) return false
  return (
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('速率限制') ||
    text.includes('请求频率') ||
    text.includes('"code":"1302"') ||
    text.includes("'code':'1302'")
  )
}

export function mapZiweiAiErrorMessage(raw: unknown): string {
  const code = asString(raw).trim().toLowerCase()
  if (!code) return 'AI 服务暂时不可用，请稍后重试。'
  if (code === 'rate_limited') return '当前请求较多，触发了服务端限流，请稍后再试。'
  if (code === 'ai_upstream_rate_limited') return 'AI 上游服务限流或配额不足，请稍后重试。'
  if (code.includes('429') || code.includes('rate limit')) return 'AI 请求过于频繁，请稍后重试。'
  if (code === 'forbidden_user') return '当前账号未开通紫微工具权限。'
  if (code === 'unauthorized') return '登录状态已失效，请重新登录后重试。'
  if (
    code === 'invalid_json' ||
    code === 'invalid_payload' ||
    code === 'invalid_chart_payload' ||
    code === 'chart_payload_too_small'
  ) {
    return '命盘数据不完整，请重新排盘后再试。'
  }
  if (code === 'invalid_question') return '请输入有效问题后再发送。'
  if (code === 'ai_request_timeout' || code === 'ai_upstream_timeout')
    return 'AI 思考超时，请稍后重试。'
  if (code === 'ai_upstream_not_found') return 'AI 服务配置异常，请联系管理员。'
  if (code === 'ai_upstream_auth_failed') return 'AI 服务鉴权失败，请检查 API Key、余额或模型权限。'
  if (code === 'ai_upstream_unavailable') return 'AI 上游服务暂时不可用，请稍后重试。'
  if (code === 'ai_upstream_bad_response') {
    return 'AI 返回异常，请检查 AI_BASE_URL 与模型配置。'
  }
  if (
    code === 'ai_response_invalid' ||
    code === 'ai_response_empty' ||
    code === 'ai_analysis_failed'
  ) {
    return 'AI 返回结果异常，请稍后重试。'
  }
  return 'AI 服务暂时不可用，请稍后重试。'
}
