import { toSafeString } from './response-parser.ts'

function parseJsonArrayOfStrings(raw: string): string[] {
  const text = String(raw || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => toSafeString(item, 160))
      .filter(Boolean)
      .slice(0, 12)
  } catch (_err) {
    return []
  }
}

export function buildQaConfig(suggestionsJson: string) {
  const suggestions = parseJsonArrayOfStrings(suggestionsJson)
  return { suggestions }
}

export function buildAnalysisSystemPrompt(style: 'simple' | 'pro', analysisTemplate: string): string {
  const baseLines = [
    'You are a professional Zi Wei Dou Shu analyst.',
    'Write all field contents in Simplified Chinese.',
    'Output strictly one JSON object. No markdown and no code fence.',
    'JSON schema:',
    '{',
    '  "overview": "80-220 chars summary",',
    '  "sections": [',
    '    {"title":"Core Personality","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Career and Finance","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Relationship and Collaboration","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Health and Rhythm","summary":"...","evidence":["..."],"advice":["..."]},',
    '    {"title":"Current Decade and Annual Focus","summary":"...","evidence":["..."],"advice":["..."]}',
    '  ],',
    '  "yearFocus":{"summary":"...","opportunities":["..."],"risks":["..."]},',
    '  "nextActions":["...","...","..."],',
    '  "disclaimer":"..."',
    '}',
    'Rules:',
    '1) Must reference concrete chart evidence (palaces/stars/hua/da-xian/liu-nian).',
    '2) Avoid generic one-size-fits-all wording.',
    '3) Keep tone practical and avoid absolute claims.',
    style === 'pro'
      ? '4) Pro mode: section summaries can be deeper.'
      : '4) Simple mode: section summaries should be concise.'
  ]
  if (!analysisTemplate) return baseLines.join('\n')
  const template = analysisTemplate.replace(/\{\{style\}\}/g, style)
  return [...baseLines, '', 'Template requirements configured on server:', template].join('\n')
}

export function normalizeQaTemplate(qaTemplate: string): string {
  if (qaTemplate) return qaTemplate
  return [
    'You are a professional Zi Wei Dou Shu consultant.',
    'Reply in Simplified Chinese only.',
    'Use chart evidence whenever possible (palace/star/hua/decade/year).',
    'Use this structure:',
    '[问题] {{question}}',
    '[核心结论] ...',
    '[命盘证据] ...',
    '[行动建议] ...',
    '[风险提示] ...'
  ].join('\n')
}
