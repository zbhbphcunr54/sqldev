import { parseBoolean } from './utils.ts'

const LOCAL_ORIGIN_RE = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i
export const DEFAULT_WEB_ORIGIN = 'https://gitzhengpeng.github.io'

export interface CorsOptions {
  defaultOrigin: string
  primaryOriginEnvKey?: string
  allowedOriginsEnvKey?: string
  allowLocalhostEnvKey?: string
  allowHeaders?: string
  allowMethods?: string
}

export function createCorsHelpers(options: CorsOptions) {
  const primaryOriginEnvKey = options.primaryOriginEnvKey || 'CORS_PRIMARY_ORIGIN'
  const allowedOriginsEnvKey = options.allowedOriginsEnvKey || 'CORS_ALLOWED_ORIGINS'
  const allowLocalhostEnvKey = options.allowLocalhostEnvKey || 'ALLOW_LOCALHOST_ORIGIN'
  const allowHeaders = options.allowHeaders || 'authorization, x-client-info, apikey, content-type'
  const allowMethods = options.allowMethods || 'POST, OPTIONS'

  const primaryOrigin =
    (Deno.env.get(primaryOriginEnvKey) || options.defaultOrigin).trim() || options.defaultOrigin
  const allowedOrigins = (Deno.env.get(allowedOriginsEnvKey) || primaryOrigin)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  const allowLocalhost = parseBoolean(Deno.env.get(allowLocalhostEnvKey))
  const allowSet = new Set(allowedOrigins.length > 0 ? allowedOrigins : [primaryOrigin])
  const corsBaseHeaders = {
    'Access-Control-Allow-Headers': allowHeaders,
    'Access-Control-Allow-Methods': allowMethods
  }

  function defaultCorsHeaders(): Record<string, string> {
    return {
      ...corsBaseHeaders,
      'Access-Control-Allow-Origin': primaryOrigin,
      Vary: 'Origin'
    }
  }

  function buildCorsHeaders(req: Request): Record<string, string> | null {
    const origin = (req.headers.get('origin') || '').trim()
    if (!origin) return defaultCorsHeaders()
    const localhostAllowed = allowLocalhost && LOCAL_ORIGIN_RE.test(origin)
    if (!allowSet.has(origin) && !localhostAllowed) return null
    return {
      ...corsBaseHeaders,
      'Access-Control-Allow-Origin': origin,
      Vary: 'Origin'
    }
  }

  return {
    defaultCorsHeaders,
    buildCorsHeaders
  }
}
