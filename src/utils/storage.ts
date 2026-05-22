export function getJson<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : defaultVal
  } catch {
    return defaultVal
  }
}

export function setJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.warn('[storage] setJson failed:', e)
  }
}

export function removeJson(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (e) {
    console.warn('[storage] removeJson failed:', e)
  }
}
