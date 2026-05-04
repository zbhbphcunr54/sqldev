import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createCorsHelpers, DEFAULT_WEB_ORIGIN } from '../_shared/cors.ts'
import { jsonResponse, errorResponse, logEdgeError } from '../_shared/response.ts'

const { defaultCorsHeaders, buildCorsHeaders } = createCorsHelpers({
  defaultOrigin: DEFAULT_WEB_ORIGIN
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') || ''

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())
    return new Response('ok', { headers: corsHeaders })
  }
  if (!corsHeaders) return jsonResponse(403, { error: 'CORS origin not allowed' }, defaultCorsHeaders())

  try {
    // Verify cron secret for scheduled invocations (optional, pg_cron doesn't send auth)
    const authHeader = req.headers.get('authorization') || ''
    if (CRON_SECRET && authHeader) {
      const providedSecret = authHeader.replace('Bearer ', '')
      if (providedSecret && providedSecret !== CRON_SECRET) {
        return jsonResponse(401, { error: 'unauthorized' }, corsHeaders)
      }
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!SUPABASE_URL || !serviceRoleKey) {
      return jsonResponse(500, { error: 'server_not_ready' }, corsHeaders)
    }

    const adminClient = createClient(SUPABASE_URL, serviceRoleKey)

    // Parse cleanup type from body (for manual invocations)
    let cleanupAll = true
    const types: string[] = []

    try {
      const body = await req.json().catch(() => null)
      if (body?.cleanup_type && body.cleanup_type !== 'all') {
        cleanupAll = false
        types.push(body.cleanup_type)
      } else if (body?.cleanup_type === 'all') {
        cleanupAll = true
      }
    } catch {
      cleanupAll = true
    }

    const cleaned: string[] = []

    // Cleanup convert_cache (7 days)
    if (cleanupAll || types.includes('convert_cache')) {
      const { error: cacheError } = await adminClient.rpc('cleanup_convert_cache')
      if (cacheError) {
        logEdgeError('cleanup', 'convert_cache_cleanup_failed', cacheError)
      } else {
        cleaned.push('convert_cache')
      }
    }

    // Cleanup operation_logs (90 days)
    if (cleanupAll || types.includes('operation_logs')) {
      const { error: logsError } = await adminClient.rpc('cleanup_operation_logs')
      if (logsError) {
        logEdgeError('cleanup', 'operation_logs_cleanup_failed', logsError)
      } else {
        cleaned.push('operation_logs')
      }
    }

    // Cleanup convert_verify_results (30 days)
    if (cleanupAll || types.includes('convert_verify_results')) {
      const { error: verifyError } = await adminClient.rpc('cleanup_convert_verify_results')
      if (verifyError) {
        logEdgeError('cleanup', 'verify_results_cleanup_failed', verifyError)
      } else {
        cleaned.push('convert_verify_results')
      }
    }

    return jsonResponse(200, {
      ok: true,
      cleaned,
      message: cleaned.length > 0
        ? `Cleaned: ${cleaned.join(', ')}`
        : 'No cleanup performed'
    }, corsHeaders)
  } catch (err) {
    logEdgeError('cleanup', 'internal_error', err)
    return errorResponse(500, 'internal_error', corsHeaders)
  }
})
