import { loadTsModule } from './helpers/load-ts-module.mjs'

const idCard = loadTsModule('src/features/id-tools/id-card.ts')
const uscc = loadTsModule('src/features/id-tools/uscc.ts')

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

assertEqual(idCard.calcIdCardCheckDigit('11010519491231002'), 'X', 'GB 11643 check digit must match known example')
assertEqual(idCard.parseYmdFromIsoDate('1990-06-15'), '19900615', 'ISO date must convert to YYYYMMDD')
assert(idCard.validateBirthYmd8('19900615', { maxDate: '2026-04-23' }), 'valid birth date must pass')
assert(!idCard.validateBirthYmd8('18991231', { maxDate: '2026-04-23' }), 'birth date before 1900 must fail')
assertEqual(idCard.randomSequenceByGender('male', () => 2), '003', 'male sequence must be odd')
assertEqual(idCard.randomSequenceByGender('female', () => 1), '002', 'female sequence must be even')

const base17 = '91350211M000100Y4'
const check = uscc.calcUsccCheckChar(base17)
assertEqual(uscc.validateUscc18(base17 + check, (code) => code === '350211').ok, true, 'generated USCC must validate')
assertEqual(uscc.calcOrgCodeCheckChar('MA00405D'), '7', 'organization code check char must be deterministic')
assertEqual(uscc.validateOrgCode('MA00405D-7').ok, true, 'organization code with hyphen must validate')
assertEqual(
  uscc.validateLegacy15('350211123456789', (code) => code === '350211').ok,
  true,
  'legacy 15-digit code must validate when region exists'
)

console.log('ID tools tests passed')
