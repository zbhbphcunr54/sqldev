type RecordLike = Record<string, unknown>

export interface ZiweiHistoryStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ZiweiHistoryStateInput {
  profileName?: unknown
  calendarType?: unknown
  solarYear?: unknown
  solarMonth?: unknown
  solarDay?: unknown
  lunarYear?: unknown
  lunarMonth?: unknown
  lunarDay?: unknown
  lunarLeap?: unknown
  birthHour?: unknown
  birthMinute?: unknown
  gender?: unknown
  clockMode?: unknown
  timezoneOffset?: unknown
  longitude?: unknown
  xiaoXianRule?: unknown
  liuNianRule?: unknown
  school?: unknown
}

function asRecord(value: unknown): RecordLike {
  return value && typeof value === 'object' ? (value as RecordLike) : {}
}

function asString(value: unknown): string {
  return String(value || '')
}

export function loadZiweiHistoryRecords(
  storage: ZiweiHistoryStorageLike,
  storageKey: string,
  maxItems = 30
): RecordLike[] {
  try {
    const raw = storage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => {
        const record = asRecord(item)
        return Boolean(record.id && record.createdAt)
      })
      .slice(0, maxItems)
  } catch {
    return []
  }
}

export function saveZiweiHistoryRecords(
  storage: ZiweiHistoryStorageLike,
  storageKey: string,
  historyList: unknown
): void {
  try {
    storage.setItem(storageKey, JSON.stringify(Array.isArray(historyList) ? historyList : []))
  } catch {
    // localStorage quota errors are ignored to preserve UX.
  }
}

export function buildZiweiHistoryLabel(input: {
  profileName?: unknown
  gender?: unknown
  solarYear?: unknown
  solarMonth?: unknown
  solarDay?: unknown
}): string {
  const base = asString(input.profileName).trim()
  if (base) return base
  const sex = input.gender === 'female' ? '女' : '男'
  const solar = `${asString(input.solarYear)}-${asString(input.solarMonth)}-${asString(input.solarDay)}`
  return `命例-${sex}-${solar}`
}

export function createZiweiHistoryRecord(
  stateValue: ZiweiHistoryStateInput,
  chartValue: unknown,
  options: { now?: () => number; random?: () => number } = {}
): RecordLike | null {
  const chart = asRecord(chartValue)
  const center = asRecord(chart.center)
  if (!Object.keys(center).length) return null

  const state = asRecord(stateValue)
  const now = options.now ? options.now() : Date.now()
  const random = options.random ? options.random() : Math.random()

  return {
    id: `zw-${now}-${Math.floor(random * 100000)}`,
    createdAt: now,
    label: buildZiweiHistoryLabel(state),
    profileName: asString(state.profileName).trim(),
    calendarType: state.calendarType === 'lunar' ? 'lunar' : 'solar',
    solarYear: asString(state.solarYear),
    solarMonth: asString(state.solarMonth),
    solarDay: asString(state.solarDay),
    lunarYear: asString(state.lunarYear),
    lunarMonth: asString(state.lunarMonth),
    lunarDay: asString(state.lunarDay),
    lunarLeap: Boolean(state.lunarLeap),
    birthHour: asString(state.birthHour),
    birthMinute: asString(state.birthMinute),
    gender: state.gender === 'female' ? 'female' : 'male',
    clockMode: state.clockMode === 'trueSolar' ? 'trueSolar' : 'standard',
    timezoneOffset: asString(state.timezoneOffset || '8'),
    longitude: asString(state.longitude || '120.000'),
    xiaoXianRule: state.xiaoXianRule === 'mingStart' ? 'mingStart' : 'yearBranch',
    liuNianRule: state.liuNianRule === 'followDaXian' ? 'followDaXian' : 'yearForward',
    school: state.school === 'flying' ? 'flying' : 'traditional',
    summary: {
      yearGanZhi: asString(center.yearGanZhi),
      bureau: asString(center.bureauLabel),
      mingBranch: asString(center.mingBranch),
      shenBranch: asString(center.shenBranch)
    }
  }
}
