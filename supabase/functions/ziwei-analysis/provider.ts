import { buildAnalysisSystemPrompt, normalizeQaTemplate } from './prompt-template.ts'
import {
  buildAiUpstreamError,
  buildFallbackFromText,
  extractAiText,
  normalizeAnalysis,
  parseJsonLoose,
  toSafeString
} from './response-parser.ts'

export interface ZiweiAiProviderConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  analysisMaxTokens: number;
  qaMaxTokens: number;
  qaMaxQuestionChars: number;
  analysisTemplate: string;
  qaTemplate: string;
}

export function buildAiEndpoint(raw: string): string {
  const base = String(raw || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  if (/\/chat\/completions$/i.test(base)) return base
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAiChat(
  config: ZiweiAiProviderConfig,
  payload: Record<string, unknown>,
  signal: AbortSignal
): Promise<Record<string, unknown>> {
  const maxAttempts = 2
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    })

    if (!res.ok) {
      const retryable = res.status >= 500 || res.status === 408 || res.status === 504
      if (retryable && attempt < maxAttempts) {
        await sleep(220 * attempt)
        continue
      }
      throw buildAiUpstreamError(res.status)
    }

    const text = await res.text()
    const parsed = parseJsonLoose(text)
    if (parsed) return parsed

    if (attempt < maxAttempts) {
      await sleep(220 * attempt)
      continue
    }
    throw new Error('ai_upstream_bad_response')
  }
  throw new Error('ai_upstream_unavailable')
}

export async function requestAiAnalysis(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  style: 'simple' | 'pro'
): Promise<Record<string, unknown>> {
  if (!config.endpoint || !config.apiKey) throw new Error('ai_backend_not_configured')

  const now = new Date()
  const todayText = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const systemPrompt = buildAnalysisSystemPrompt(style, config.analysisTemplate)
  const userPrompt = [`Current date: ${todayText}`, 'Structured chart payload as JSON string:', chartPayload].join('\n\n')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const requestOnce = async (maxTokens: number) => {
      return await fetchAiChat(config, {
        model: config.model,
        temperature: 0.55,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      }, controller.signal)
    }

    let body = await requestOnce(config.analysisMaxTokens)
    let extracted = extractAiText(body)
    let normalized = normalizeAnalysis(parseJsonLoose(extracted.text))

    if (!normalized && extracted.finishReason === 'length') {
      const retryTokens = Math.min(2_200, Math.max(config.analysisMaxTokens + 500, Math.floor(config.analysisMaxTokens * 1.8)))
      body = await requestOnce(retryTokens)
      extracted = extractAiText(body)
      normalized = normalizeAnalysis(parseJsonLoose(extracted.text))
    }

    if (!normalized) normalized = buildFallbackFromText(extracted.text)
    if (!normalized) throw new Error('ai_response_invalid')
    return normalized
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function requestAiQa(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  question: string
): Promise<string> {
  if (!config.endpoint || !config.apiKey) throw new Error('ai_backend_not_configured')
  const q = toSafeString(question, config.qaMaxQuestionChars)
  if (!q) throw new Error('invalid_question')

  const template = normalizeQaTemplate(config.qaTemplate)
  const systemPrompt = template.includes('{{question}}')
    ? template.replace(/\{\{question\}\}/g, q)
    : `${template}\n\n[问题] ${q}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const body = await fetchAiChat(config, {
      model: config.model,
      temperature: 0.35,
      max_tokens: config.qaMaxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Structured chart payload as JSON string:\n\n${chartPayload}` }
      ]
    }, controller.signal)

    const extracted = extractAiText(body)
    const answer = toSafeString(extracted.text, 8_000)
    if (!answer) throw new Error('ai_response_empty')
    return answer
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
