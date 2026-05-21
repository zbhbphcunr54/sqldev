import {
  buildAnalysisSystemPrompt,
  buildAnalysisUserPrompt,
  buildQaSystemPrompt,
  buildQaUserPrompt
} from './prompt-template.ts'
import {
  buildAnalysisFallbackFromPartialJson,
  buildFallbackFromText,
  normalizeAnalysis,
  parseJsonLoose,
  toSafeString
} from './response-parser.ts'
import {
  callAiProvider,
  callAiProviderStream,
  type AiCallMessages
} from '../_shared/ai-client.ts'
import type { ResolvedAiConfig } from '../_shared/ai-resolver.ts'

export interface ZiweiAiProviderConfig {
  aiConfig: ResolvedAiConfig
  timeoutMs: number
  maxChartChars: number
  qaMaxQuestionChars: number
  analysisTemperature: number
  qaTemperature: number
  analysisSystemTemplate: string
  analysisUserTemplate: string
  qaSystemTemplate: string
  qaUserTemplate: string
}

function buildAiRequestUrl(baseUrl: string, providerSlug?: string | null): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (providerSlug === 'claude') return `${base}/messages`
  if (/\/v\d+/.test(base)) return `${base}/chat/completions`
  return `${base}/v1/chat/completions`
}

function createAiRequestConfig(config: ZiweiAiProviderConfig) {
  return {
    baseUrl: config.aiConfig.baseUrl,
    model: config.aiConfig.model,
    apiKey: config.aiConfig.apiKey,
    providerSlug: config.aiConfig.providerSlug,
    timeoutMs: config.timeoutMs
  }
}

export function buildZiweiAiRequestUrl(aiConfig: ResolvedAiConfig): string {
  return buildAiRequestUrl(aiConfig.baseUrl, aiConfig.providerSlug)
}

export function buildAnalysisMessages(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  style: 'simple' | 'pro'
): AiCallMessages[] {
  return [
    {
      role: 'system',
      content: buildAnalysisSystemPrompt(style, config.analysisSystemTemplate)
    },
    {
      role: 'user',
      content: buildAnalysisUserPrompt(config.analysisUserTemplate, style, chartPayload)
    }
  ]
}

export function buildQaMessages(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  question: string
): AiCallMessages[] {
  const safeQuestion = toSafeString(question, config.qaMaxQuestionChars)
  return [
    {
      role: 'system',
      content: buildQaSystemPrompt(config.qaSystemTemplate)
    },
    {
      role: 'user',
      content: buildQaUserPrompt(config.qaUserTemplate, safeQuestion, chartPayload)
    }
  ]
}

export async function requestAiAnalysis(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  style: 'simple' | 'pro'
): Promise<Record<string, unknown>> {
  if (!config.aiConfig.apiKey) throw new Error('ai_backend_not_configured')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const aiText = await callAiProvider(
      createAiRequestConfig(config),
      buildAnalysisMessages(config, chartPayload, style),
      {
        signal: controller.signal,
        temperature: config.analysisTemperature,
        extraBody: {
          response_format: { type: 'json_object' }
        }
      }
    )

    let normalized = normalizeAnalysis(parseJsonLoose(aiText))
    if (!normalized) normalized = buildAnalysisFallbackFromPartialJson(aiText)
    if (!normalized) normalized = buildFallbackFromText(aiText)
    if (!normalized) throw new Error('ai_response_invalid')
    return normalized
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function requestAiAnalysisStream(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  style: 'simple' | 'pro',
  onDelta?: (text: string) => void
): Promise<string> {
  if (!config.aiConfig.apiKey) throw new Error('ai_backend_not_configured')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    return await callAiProviderStream(
      createAiRequestConfig(config),
      buildAnalysisMessages(config, chartPayload, style),
      { onDelta },
      {
        signal: controller.signal,
        temperature: config.analysisTemperature,
        extraBody: {
          response_format: { type: 'json_object' }
        }
      }
    )
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
  if (!config.aiConfig.apiKey) throw new Error('ai_backend_not_configured')
  const q = toSafeString(question, config.qaMaxQuestionChars)
  if (!q) throw new Error('invalid_question')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    const answer = await callAiProvider(
      createAiRequestConfig(config),
      buildQaMessages(config, chartPayload, q),
      {
        signal: controller.signal,
        temperature: config.qaTemperature
      }
    )

    const safeAnswer = toSafeString(answer, 8_000)
    if (!safeAnswer) throw new Error('ai_response_empty')
    return safeAnswer
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function requestAiQaStream(
  config: ZiweiAiProviderConfig,
  chartPayload: string,
  question: string,
  onDelta?: (text: string) => void
): Promise<string> {
  if (!config.aiConfig.apiKey) throw new Error('ai_backend_not_configured')
  const q = toSafeString(question, config.qaMaxQuestionChars)
  if (!q) throw new Error('invalid_question')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  try {
    return await callAiProviderStream(
      createAiRequestConfig(config),
      buildQaMessages(config, chartPayload, q),
      { onDelta },
      {
        signal: controller.signal,
        temperature: config.qaTemperature
      }
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('ai_request_timeout')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
