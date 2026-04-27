import { loadTsModule } from './helpers/load-ts-module.mjs'

const presentation = loadTsModule('src/features/ziwei/presentation.ts')

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assertEqual(
  presentation.formatZiweiHistoryTime(Date.parse('2024-04-24T08:00:00+08:00')),
  '2024-04-24 08:00',
  'history time must format as yyyy-mm-dd hh:mm'
)
assertEqual(presentation.formatZiweiHistoryTime('bad'), '--', 'invalid history time must fallback')
assertEqual(presentation.formatZiweiDurationText(64000), '1分04秒', 'duration text must format as 分秒')
assertEqual(
  presentation.normalizeZiweiQaSuggestionText('身体锛健康'),
  '身体与健康',
  'QA suggestion text must repair mojibake around 身体与健康'
)
assert(presentation.isLikelyMojibakeZh('锛銆鍙'), 'mojibake detector must detect broken chinese text')

console.log('Ziwei presentation tests passed')
