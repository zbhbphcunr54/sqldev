type RecordLike = Record<string, unknown>

export interface ZiweiAiPayloadOptions {
  profileName?: unknown
  ruleSummary?: unknown
  now?: () => number
}

export interface ParsedInvokeError {
  status: number
  detail: string
}

function asRecord(value: unknown): RecordLike {
  return value && typeof value === 'object' ? (value as RecordLike) : {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asString(value: unknown): string {
  return String(value || '')
}

function asNumber(value: unknown): number {
  return Number(value || 0)
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
    huaTags: asArray(star.huaTags).slice(0, 4)
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
    text: trimZiweiText(item.text, 320),
    plain: asArray(item.plain)
      .slice(0, 3)
      .map((line) => trimZiweiText(line, 160)),
    evidence: asArray(item.evidence)
      .slice(0, 3)
      .map((line) => trimZiweiText(line, 160))
  }
}

export function buildZiweiAiPayload(
  chartValue: unknown,
  options: ZiweiAiPayloadOptions = {}
): RecordLike {
  const chart = asRecord(chartValue)
  const center = asRecord(chart.center)
  const boardCells = asArray(chart.boardCells)
  const palaces = boardCells.map((cellValue) => {
    const cell = asRecord(cellValue)
    const mainStars = asArray(cell.mainStars)
    const assistStars = asArray(cell.assistStars)
    const miscStars = asArray(cell.miscStars)
    const liuNianSeries = asArray(cell.liuNianSeries)
    const xiaoXianSeries = asArray(cell.xiaoXianSeries)

    return {
      branch: asString(cell.branch),
      palaceName: asString(cell.palaceName),
      area: asString(cell.area),
      stemBranch: asString(cell.stemBranch),
      isMing: Boolean(cell.isMing),
      isShen: Boolean(cell.isShen),
      mainStars: mainStars.map((star) => mapStar(star, true)),
      assistStars: assistStars.map((star) => mapStar(star, false)),
      miscStars: miscStars.map((star) => mapStar(star, false)),
      mainStarsText: trimZiweiText(cell.mainStarsText, 220),
      assistStarsText: trimZiweiText(cell.assistStarsText, 220),
      miscStarsText: trimZiweiText(cell.miscStarsText, 220),
      daXian: asString(cell.daXian),
      xiaoXian: asString(cell.xiaoXian),
      changSheng: asString(cell.changSheng),
      currentLiuNian: asNumber(cell.currentLiuNian),
      currentXiaoXian: asNumber(cell.currentXiaoXian),
      liuNianSeries: liuNianSeries.slice(0, 12),
      xiaoXianSeries: xiaoXianSeries.slice(0, 12),
      liuNianSeriesText: trimZiweiText(cell.liuNianSeriesText, 240),
      xiaoXianSeriesText: trimZiweiText(cell.xiaoXianSeriesText, 240),
      outgoingHuaCount: asNumber(cell.outgoingHuaCount),
      incomingHuaCount: asNumber(cell.incomingHuaCount)
    }
  })

  const huaTracks = asArray(chart.huaTracks)
    .slice(0, 96)
    .map((trackValue) => {
      const track = asRecord(trackValue)
      return {
        tag: asString(track.tag),
        star: asString(track.star),
        sourceBranch: asString(track.sourceBranch),
        sourceText: asString(track.sourceText),
        targetBranch: asString(track.targetBranch),
        targetText: asString(track.targetText)
      }
    })

  return {
    payloadVersion: 'ziwei-ai-v2',
    generatedAt: asNumber(chart.generatedAt) || (options.now ? options.now() : Date.now()),
    profileName: trimZiweiText(options.profileName, 80),
    center: {
      genderLabel: asString(center.genderLabel),
      yinYangGenderLabel: asString(center.yinYangGenderLabel),
      calendarInputType: asString(center.calendarInputType),
      schoolLabel: asString(center.schoolLabel),
      solarText: asString(center.solarText),
      inputClockText: asString(center.inputClockText),
      lunarText: asString(center.lunarText),
      naYinLabel: asString(center.naYinLabel),
      yearGanZhi: asString(center.yearGanZhi),
      bureauLabel: asString(center.bureauLabel),
      mingBranch: asString(center.mingBranch),
      mingPalaceName: asString(center.mingPalaceName),
      shenBranch: asString(center.shenBranch),
      shenPalaceName: asString(center.shenPalaceName),
      ziweiBranch: asString(center.ziweiBranch),
      tianfuBranch: asString(center.tianfuBranch),
      monthLabel: asString(center.monthLabel),
      shichenLabel: asString(center.shichenLabel),
      mingZhu: asString(center.mingZhu),
      shenZhu: asString(center.shenZhu),
      daXianDirectionLabel: asString(center.daXianDirectionLabel),
      clockMode: asString(center.clockMode),
      clockModeLabel: asString(center.clockModeLabel),
      timeCorrectionText: asString(center.timeCorrectionText),
      timezoneOffset: asString(center.timezoneOffset),
      longitude: asNumber(center.longitude),
      longitudeCorrectionMinutes: asNumber(center.longitudeCorrectionMinutes),
      equationOfTimeMinutes: asNumber(center.equationOfTimeMinutes),
      xiaoXianRuleLabel: asString(center.xiaoXianRuleLabel),
      liuNianRuleLabel: asString(center.liuNianRuleLabel),
      currentYearLabel: asString(center.currentYearLabel),
      currentYearGanZhiLabel: asString(center.currentYearGanZhiLabel),
      currentAgeLabel: asString(center.currentAgeLabel),
      currentDaXianLabel: asString(center.currentDaXianLabel),
      currentLiuNianPalaceLabel: asString(center.currentLiuNianPalaceLabel),
      qiYunText: asString(center.qiYunText),
      school: asString(center.school),
      shiftedByZiHour: Boolean(center.shiftedByZiHour),
      birthYearForAge: asNumber(center.birthYearForAge),
      birthMonthForAge: asNumber(center.birthMonthForAge),
      birthDayForAge: asNumber(center.birthDayForAge),
      nonJieqiPillars: asArray(center.nonJieqiPillars).slice(0, 4),
      jieqiPillars: asArray(center.jieqiPillars).slice(0, 4),
      decadeMarks: asArray(center.decadeMarks).slice(0, 8),
      huaSummary: asArray(center.huaSummary).map((itemValue) => {
        const item = asRecord(itemValue)
        return asString(item.label)
      })
    },
    daXianTimeline: asArray(chart.daXianTimeline)
      .slice(0, 12)
      .map((itemValue) => {
        const item = asRecord(itemValue)
        return {
          range: asString(item.range),
          branch: asString(item.branch),
          palaceName: asString(item.palaceName)
        }
      }),
    liuNianTimeline: asArray(chart.liuNianTimeline)
      .slice(0, 36)
      .map((itemValue) => {
        const item = asRecord(itemValue)
        return {
          year: asNumber(item.year),
          age: asNumber(item.age),
          ganzhi: asString(item.ganzhi),
          branch: asString(item.branch),
          palaceName: asString(item.palaceName)
        }
      }),
    palaces,
    huaTracks,
    ruleSummary: asArray(options.ruleSummary).slice(0, 8).map(mapRuleSummary),
    chartText: trimZiweiText(chart.text, 12000)
  }
}

function compactPalace(itemValue: unknown, mode: 'legacy' | 'compact' | 'lite'): RecordLike {
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
  const center = asRecord(payload.center)
  payload.center = {
    ...center,
    timeCorrectionText: '',
    longitude: 0,
    longitudeCorrectionMinutes: 0,
    equationOfTimeMinutes: 0,
    nonJieqiPillars: [],
    jieqiPillars: [],
    decadeMarks: []
  }
  payload.palaces = asArray(payload.palaces).map((item) => compactPalace(item, 'compact'))
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
        } catch {
          detail = asString(text)
        }
      }
    }
  } catch {
    // Edge SDK error contexts are best-effort only.
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
  if (code === 'invalid_json' || code === 'invalid_payload' || code === 'chart_payload_too_small') {
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
