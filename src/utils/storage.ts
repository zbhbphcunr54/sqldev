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
  } catch {
    // quota exceeded or storage disabled — silently ignore
  }
}

export function removeJson(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // silently ignore
  }
}
