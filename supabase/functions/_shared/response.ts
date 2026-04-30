export function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extra?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extra,
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
}

function sanitizeLogMessage(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : String(raw || '')
  return message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/(apikey|api_key|authorization|token|secret|password)=([^&\s]+)/gi, '$1=[redacted]')
    .replace(/(sb_secret_|sk-|ak-)[A-Za-z0-9._-]+/g, '$1[redacted]')
    .slice(0, 300)
}

export function logEdgeError(scope: string, stage: string, err: unknown): void {
  const name = err instanceof Error ? err.name : 'Error'
  const message = sanitizeLogMessage(err)
  console.error(`[${scope}] ${stage}`, { name, message })
}

export function errorResponse(
  status: number,
  error: string,
  corsHeaders: Record<string, string>,
  extra?: Record<string, string>
): Response {
  return jsonResponse(status, { ok: false, error }, corsHeaders, extra)
}
