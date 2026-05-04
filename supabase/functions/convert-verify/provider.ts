export interface VerifyAiProviderConfig {
  endpoint: string
  apiKey: string
  model: string
  timeoutMs: number
  maxTokens: number
  apiFormat?: 'openai_compat' | 'anthropic' | 'custom'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface VerifyResult {
  overallScore: number
  syntaxIssues: Array<{
    line: number
    severity: string
    message: string
    fix: string
  }>
  semanticIssues: Array<{
    severity: string
    message: string
    original: string
    converted: string
  }>
  logicRisks: Array<{
    category: string
    severity: string
    message: string
    impact: string
  }>
  suggestions: Array<{
    priority: string
    targetSql: string
    explanation: string
  }>
  summary: string
}

export async function requestAiVerify(
  config: VerifyAiProviderConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<VerifyResult> {
  if (!config.endpoint || !config.apiKey) {
    throw new Error('ai_backend_not_configured')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.timeoutMs)
  const apiFormat = config.apiFormat || 'openai_compat'

  try {
    const maxAttempts = 2
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        let res: Response

        if (apiFormat === 'anthropic') {
          // Anthropic Claude 格式
          res = await fetch(`${config.endpoint}/messages`, {
            method: 'POST',
            headers: {
              'x-api-key': config.apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: Math.min(config.maxTokens, 4096),
              messages: [{ role: 'user', content: `${systemPrompt}\n\n---\n\n${userPrompt}` }]
            }),
            signal: controller.signal
          })
        } else {
          // OpenAI 兼容格式（默认）
          res = await fetch(`${config.endpoint}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: config.model,
              temperature: 0.3,
              max_tokens: config.maxTokens,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
              ]
            }),
            signal: controller.signal
          })
        }

        if (!res.ok) {
          const retryable = res.status >= 500 || res.status === 408 || res.status === 504
          if (retryable && attempt < maxAttempts) {
            await sleep(220 * attempt)
            continue
          }
          const text = await res.text().catch(() => '')
          throw new Error(`ai_upstream_error: ${res.status} - ${text.slice(0, 200)}`)
        }

        const json = await res.json()
        let content: string

        if (apiFormat === 'anthropic') {
          content = json?.content?.[0]?.text
        } else {
          content = json?.choices?.[0]?.message?.content
        }

        if (!content) {
          throw new Error('ai_response_empty')
        }

        // Parse and validate the response
        const parsed = parseVerifyResponse(content)
        if (!parsed) {
          throw new Error('ai_response_invalid')
        }

        return parsed
      } catch (err) {
        if (attempt >= maxAttempts) throw err
        await sleep(220 * attempt)
      }
    }
    throw new Error('ai_request_failed')
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('ai_request_timeout')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function parseVerifyResponse(content: string): VerifyResult | null {
  try {
    // Try to extract JSON from the content (in case there's extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const data = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (typeof data.overallScore !== 'number') return null
    if (!Array.isArray(data.syntaxIssues)) return null
    if (!Array.isArray(data.semanticIssues)) return null
    if (!Array.isArray(data.logicRisks)) return null
    if (!Array.isArray(data.suggestions)) return null
    if (typeof data.summary !== 'string') return null

    return {
      overallScore: Math.max(0, Math.min(100, data.overallScore)),
      syntaxIssues: (data.syntaxIssues || []).map(normalizeSyntaxIssue),
      semanticIssues: (data.semanticIssues || []).map(normalizeSemanticIssue),
      logicRisks: (data.logicRisks || []).map(normalizeLogicRisk),
      suggestions: (data.suggestions || []).map(normalizeSuggestion),
      summary: String(data.summary || '').slice(0, 500)
    }
  } catch {
    return null
  }
}

function normalizeSyntaxIssue(item: unknown): { line: number; severity: string; message: string; fix: string } {
  const obj = item as Record<string, unknown>
  return {
    line: Number(obj.line) || 0,
    severity: String(obj.severity || 'warning'),
    message: String(obj.message || ''),
    fix: String(obj.fix || '')
  }
}

function normalizeSemanticIssue(item: unknown): { severity: string; message: string; original: string; converted: string } {
  const obj = item as Record<string, unknown>
  return {
    severity: String(obj.severity || 'warning'),
    message: String(obj.message || ''),
    original: String(obj.original || ''),
    converted: String(obj.converted || '')
  }
}

function normalizeLogicRisk(item: unknown): { category: string; severity: string; message: string; impact: string } {
  const obj = item as Record<string, unknown>
  return {
    category: String(obj.category || 'other'),
    severity: String(obj.severity || 'medium'),
    message: String(obj.message || ''),
    impact: String(obj.impact || '')
  }
}

function normalizeSuggestion(item: unknown): { priority: string; targetSql: string; explanation: string } {
  const obj = item as Record<string, unknown>
  return {
    priority: String(obj.priority || 'medium'),
    targetSql: String(obj.targetSql || ''),
    explanation: String(obj.explanation || '')
  }
}
