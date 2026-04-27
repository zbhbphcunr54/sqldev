export const ID_CARD_CHECK_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2] as const
export const ID_CARD_CHECK_MAP = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'] as const

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false
  if (month < 1 || month > 12 || day < 1) return false

  const monthDays = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= monthDays[month - 1]
}

export function parseYmdFromIsoDate(value: unknown): string {
  const dateText = String(value || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return ''

  const [yearText, monthText, dayText] = dateText.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!isValidDateParts(year, month, day)) return ''
  return `${yearText}${monthText}${dayText}`
}

export function validateBirthYmd8(
  ymd8: unknown,
  options: { maxDate?: string | Date; minYear?: number } = {}
): boolean {
  const value = String(ymd8 || '')
  if (!/^\d{8}$/.test(value)) return false

  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6))
  const day = Number(value.slice(6, 8))
  if (!isValidDateParts(year, month, day)) return false

  const minYear = options.minYear ?? 1900
  const maxYear = new Date().getFullYear()
  if (year < minYear || year > maxYear) return false

  const maxDate =
    options.maxDate instanceof Date
      ? options.maxDate.toISOString().slice(0, 10)
      : String(options.maxDate || '')
  const maxYmd = /^\d{4}-\d{2}-\d{2}$/.test(maxDate)
    ? Number(maxDate.replace(/-/g, ''))
    : Number(new Date().toISOString().slice(0, 10).replace(/-/g, ''))

  return Number(value) <= maxYmd
}

export function calcIdCardCheckDigit(id17: unknown): string {
  const value = String(id17 || '')
  if (!/^\d{17}$/.test(value)) return ''

  const sum = value
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * ID_CARD_CHECK_WEIGHTS[index], 0)

  return ID_CARD_CHECK_MAP[sum % 11]
}

export function randomSequenceByGender(gender: unknown, randomInt = defaultRandomInt): string {
  let seqNum = randomInt(1, 999)
  const isFemale = gender === 'female'

  if (isFemale && seqNum % 2 !== 0) seqNum += 1
  if (!isFemale && seqNum % 2 === 0) seqNum += 1
  if (seqNum > 999) seqNum -= 2
  if (seqNum < 1) seqNum = isFemale ? 2 : 1

  return String(seqNum).padStart(3, '0')
}

function defaultRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
