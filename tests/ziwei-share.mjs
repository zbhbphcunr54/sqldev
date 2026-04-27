import { loadTsModule } from './helpers/load-ts-module.mjs'

const share = loadTsModule('src/features/ziwei/share.ts')

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assertEqual(
  share.buildZiweiShareLink({ origin: 'https://example.com', pathname: '/sqldev/' }),
  'https://example.com/sqldev/?ziwei_share=1#/workbench/ziwei',
  'share link must target the ziwei workbench route'
)

const spec = share.createZiweiSharePosterSpec('https://example.com/a'.repeat(10))
assertEqual(spec.posterWidth, 1200, 'poster width must match design')
assertEqual(spec.featureCards.length, 4, 'poster must include four feature cards')
assert(spec.shareLinkDisplay.endsWith('...'), 'long share link must be truncated for display')

console.log('Ziwei share tests passed')
