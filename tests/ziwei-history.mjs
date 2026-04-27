import { loadTsModule } from './helpers/load-ts-module.mjs'

const history = loadTsModule('src/features/ziwei/history.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`)
  }
}

const storageData = new Map()
const storage = {
  getItem(key) {
    return storageData.has(key) ? storageData.get(key) : null
  },
  setItem(key, value) {
    storageData.set(key, value)
  }
}

assertEqual(
  history.buildZiweiHistoryLabel({
    gender: 'male',
    solarYear: '1990',
    solarMonth: '06',
    solarDay: '15'
  }),
  '命例-男-1990-06-15',
  'history label must fallback to gender and solar date'
)

const record = history.createZiweiHistoryRecord(
  {
    profileName: '测试命例',
    calendarType: 'lunar',
    gender: 'female',
    clockMode: 'trueSolar',
    xiaoXianRule: 'mingStart',
    liuNianRule: 'followDaXian',
    school: 'flying',
    solarYear: '1990',
    solarMonth: '06',
    solarDay: '15'
  },
  { center: { yearGanZhi: '庚午', bureauLabel: '火六局', mingBranch: '子', shenBranch: '午' } },
  { now: () => 1000, random: () => 0.12345 }
)

assert(record, 'history record must be created when chart center exists')
assertEqual(record.id, 'zw-1000-12345', 'history id must be deterministic with injected random')
assertEqual(record.summary.bureau, '火六局', 'history summary must preserve center data')

history.saveZiweiHistoryRecords(storage, 'zw-key', [record, { nope: true }])
const loaded = history.loadZiweiHistoryRecords(storage, 'zw-key', 30)
assertEqual(loaded.length, 1, 'history loader must filter invalid records')
assertEqual(loaded[0].profileName, '测试命例', 'history loader must preserve stored records')

console.log('Ziwei history tests passed')
