import { toSafeString } from './response-parser.ts'

function parseJsonArrayOfStrings(raw: string): string[] {
  const text = String(raw || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => toSafeString(item, 160)).filter(Boolean).slice(0, 12)
  } catch {
    return []
  }
}

export function buildQaConfig(suggestionsJson: string) {
  const suggestions = parseJsonArrayOfStrings(suggestionsJson)
  return { suggestions }
}

export function buildAnalysisSystemPrompt(style: 'simple' | 'pro', systemTemplate: string): string {
  return String(systemTemplate || '').replace(/\{\{style\}\}/g, style).trim()
}

export function buildAnalysisUserPrompt(
  userTemplate: string,
  style: 'simple' | 'pro',
  chartPayload: string
): string {
  const now = new Date()
  const todayText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return String(userTemplate || '')
    .replace(/\{\{current_date\}\}/g, todayText)
    .replace(/\{\{style\}\}/g, style)
    .replace(/\{\{chart_payload\}\}/g, chartPayload)
    .trim()
}

export function buildQaSystemPrompt(systemTemplate: string): string {
  return String(systemTemplate || '').trim()
}

export function buildQaUserPrompt(userTemplate: string, question: string, chartPayload: string): string {
  return String(userTemplate || '')
    .replace(/\{\{question\}\}/g, question)
    .replace(/\{\{chart_payload\}\}/g, chartPayload)
    .trim()
}
