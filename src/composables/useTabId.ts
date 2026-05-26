import { uuid } from '@/lib/uuid'

const SESSION_KEY = 'sqldev:tabId'

let cachedTabId: string | null = null

export function useTabId(): string {
  if (cachedTabId) return cachedTabId
  let tabId = sessionStorage.getItem(SESSION_KEY)
  if (!tabId) {
    tabId = uuid()
    sessionStorage.setItem(SESSION_KEY, tabId)
  }
  cachedTabId = tabId
  return tabId
}
