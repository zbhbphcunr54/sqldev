import { loadTsModule } from './helpers/load-ts-module.mjs'

const ziwei = loadTsModule('src/features/ziwei/compute.ts')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

const baseDate = new Date(2026, 0, 15, 12, 0, 0, 0)
const standard = ziwei.applyTrueSolarTime(baseDate, 120, 'standard')
assertEqual(Math.round(standard.totalCorrectionMinutes), 0, 'standard mode must not apply correction')
assertEqual(standard.shiChenChanged, false, 'standard mode should preserve shi chen for 120E')

const corrected = ziwei.applyTrueSolarTime(new Date(2026, 5, 15, 2, 40, 0, 0), 75.9, 'trueSolar')
assert(corrected.totalCorrectionMinutes < -170, 'west city should have obvious negative correction')
assertEqual(corrected.shiChenBefore, '丑时', 'before correction shi chen must match input')
assert(corrected.shiChenAfter === '子时' || corrected.shiChenAfter === '亥时', 'after correction should change shi chen')

const chartResult = ziwei.computeZiweiChart({
  calendarType: 'solar',
  solarYear: '1990',
  solarMonth: '06',
  solarDay: '15',
  birthHour: '02',
  birthMinute: '40',
  gender: 'male',
  school: 'traditional',
  clockMode: 'trueSolar',
  longitude: '75.900',
  timezoneOffset: '8',
  xiaoXianRule: 'yearBranch',
  liuNianRule: 'yearForward'
})

assert(chartResult.ok, 'computeZiweiChart should succeed for valid solar input')
const chart = chartResult.chart
assert(chart, 'chart must be returned when compute succeeds')
assert(chart.center.timeCorrectionText?.includes('总修正'), 'center must expose correction summary')
assert(typeof chart.center.shichenLabel === 'string' && chart.center.shichenLabel.length > 0, 'center must expose corrected shi chen label')
assert(chart.boardCells.some((cell) => typeof cell.isCurrentDaXian === 'boolean'), 'board cell should expose daxian active flag')

console.log('Ziwei compute tests passed')
