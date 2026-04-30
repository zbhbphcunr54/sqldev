import { loadTsModule } from './helpers/load-ts-module.mjs'

const ziwei = loadTsModule('src/features/ziwei/ai-utils.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

const chart = {
  generatedAt: 123456,
  text: 'A'.repeat(13050),
  center: {
    genderLabel: '男',
    schoolLabel: '传统四化',
    longitude: 121.47,
    huaSummary: [{ label: '禄入命宫' }],
    nonJieqiPillars: ['甲子', '乙丑', '丙寅', '丁卯', '戊辰'],
    decadeMarks: ['1994', '2004', '2014']
  },
  boardCells: [
    {
      branch: '子',
      palaceName: '命宫',
      area: '下方',
      stemBranch: '甲子',
      isMing: true,
      mainStars: [{ name: '紫微', brightness: '庙', huaTags: ['科', '禄', '权', '忌', 'extra'] }],
      assistStars: [{ name: '左辅', huaTags: ['科'] }],
      miscStars: [{ name: '天魁', huaTags: [] }],
      mainStarsText: '主星'.repeat(100),
      liuNianSeries: [1, 2, 3, 4, 5, 6],
      xiaoXianSeries: [1, 2, 3],
      outgoingHuaCount: 2,
      incomingHuaCount: 1
    }
  ],
  huaTracks: new Array(120).fill(0).map((_, index) => ({
    tag: `tag-${index}`,
    star: `star-${index}`,
    sourceBranch: '子',
    sourceText: '命宫',
    targetBranch: '午',
    targetText: '迁移宫'
  })),
  daXianTimeline: [{ range: '3-12', branch: '子', palaceName: '命宫' }],
  liuNianTimeline: [{ year: 2026, age: 37, ganzhi: '丙午', branch: '午', palaceName: '迁移宫' }]
}

const ruleSummary = [
  { key: 'career', title: '事业', level: 'high', text: '事业走势'.repeat(80), plain: ['a'.repeat(180)], evidence: ['b'.repeat(180)] }
]

const payload = ziwei.buildZiweiAiPayload(chart, {
  profileName: '测试命例'.repeat(20),
  ruleSummary,
  now: () => 999
})

assertEqual(payload.payloadVersion, 'ziwei-ai-v2', 'base payload version must match')
assertEqual(payload.generatedAt, 123456, 'existing generatedAt must be preserved')
assertEqual(payload.profileName.length, 80, 'profile name must be trimmed to 80 chars')
assertEqual(payload.chartText.length, 12000, 'chart text must be trimmed to 12000 chars')
assertEqual(payload.huaTracks.length, 96, 'hua tracks must be capped at 96')
assertEqual(payload.palaces[0].mainStars[0].huaTags.length, 4, 'star hua tags must be capped at 4')
assertEqual(payload.ruleSummary[0].plain[0].length, 160, 'rule summary plain text must be trimmed')

const legacyCompact = ziwei.buildZiweiAiPayloadLegacyCompact(payload)
assertEqual(legacyCompact.payloadVersion, 'ziwei-ai-v2-compact', 'legacy compact payload version must match')
assertEqual(legacyCompact.chartText, '', 'legacy compact payload must omit chart text')
assertEqual(legacyCompact.ruleSummary.length, 1, 'legacy compact retains limited rule summary')

const compact = ziwei.buildZiweiAiPayloadCompact(payload)
assertEqual(compact.payloadVersion, 'ziwei-ai-v2-compact-v2', 'compact payload version must match')
assertEqual(compact.center.longitude, 0, 'compact payload must strip longitude detail')
assertEqual(compact.palaces[0].mainStars.length, 1, 'compact payload keeps reduced main stars set')

const lite = ziwei.buildZiweiAiPayloadLite(payload)
assertEqual(lite.payloadVersion, 'ziwei-ai-v2-lite-v2', 'lite payload version must match')
assertEqual(lite.huaTracks.length, 0, 'lite payload must omit hua tracks')

assert(ziwei.isZiweiComputeResourceError('not having enough compute resources'), 'compute resource keyword must match')
assert(ziwei.isZiweiAiRateLimitError('{"code":"1302"}'), 'rate limit code must match')
assertEqual(
  ziwei.mapZiweiAiErrorMessage('ai_upstream_auth_failed'),
  'AI 服务鉴权失败，请检查 API Key、余额或模型权限。',
  'error code must map to user message'
)
assertEqual(
  ziwei.mapZiweiAiErrorMessage('invalid_chart_payload'),
  '命盘数据不完整，请重新排盘后再试。',
  'invalid chart payload must map to a safe user message'
)

const parsed = await ziwei.parseZiweiInvokeError({
  context: {
    status: 502,
    clone() {
      return {
        async text() {
          return JSON.stringify({ error: 'ai_upstream_bad_response' })
        }
      }
    }
  }
})

assertEqual(parsed.status, 502, 'parsed invoke error status must be extracted')
assertEqual(parsed.detail, 'ai_upstream_bad_response', 'parsed invoke error detail must be extracted')
assertEqual(ziwei.trimZiweiText('abcdef', 3), 'abc', 'trim helper must trim and slice text')

console.log('Ziwei AI utils tests passed')
