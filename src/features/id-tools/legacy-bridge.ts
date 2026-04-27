import {
  calcIdCardCheckDigit,
  isLeapYear,
  isValidDateParts,
  parseYmdFromIsoDate,
  randomSequenceByGender,
  validateBirthYmd8
} from './id-card'
import {
  calcOrgCodeCheckChar,
  calcUsccCheckChar,
  generateLegacyThreeCert,
  randomOrgCodeBody,
  randomUsccBody,
  validateLegacy15,
  validateOrgCode,
  validateUscc18,
  validateUsccOrLegacyToken
} from './uscc'

declare global {
  interface Window {
    SQLDEV_ID_TOOL_UTILS?: {
      calcIdCardCheckDigit: typeof calcIdCardCheckDigit
      isLeapYear: typeof isLeapYear
      isValidDateParts: typeof isValidDateParts
      parseYmdFromIsoDate: typeof parseYmdFromIsoDate
      randomSequenceByGender: typeof randomSequenceByGender
      validateBirthYmd8: typeof validateBirthYmd8
      calcOrgCodeCheckChar: typeof calcOrgCodeCheckChar
      calcUsccCheckChar: typeof calcUsccCheckChar
      generateLegacyThreeCert: typeof generateLegacyThreeCert
      randomOrgCodeBody: typeof randomOrgCodeBody
      randomUsccBody: typeof randomUsccBody
      validateLegacy15: typeof validateLegacy15
      validateOrgCode: typeof validateOrgCode
      validateUscc18: typeof validateUscc18
      validateUsccOrLegacyToken: typeof validateUsccOrLegacyToken
    }
  }
}

window.SQLDEV_ID_TOOL_UTILS = Object.freeze({
  calcIdCardCheckDigit,
  isLeapYear,
  isValidDateParts,
  parseYmdFromIsoDate,
  randomSequenceByGender,
  validateBirthYmd8,
  calcOrgCodeCheckChar,
  calcUsccCheckChar,
  generateLegacyThreeCert,
  randomOrgCodeBody,
  randomUsccBody,
  validateLegacy15,
  validateOrgCode,
  validateUscc18,
  validateUsccOrLegacyToken
})
